import {spawn,spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {readFile,writeFile,mkdir,readdir,appendFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const INSTALL_LIMITS=Object.freeze({deps:470000,browser:290000,grace:5000});
export function makeCacheKey({version,os,arch,imageOS,imageVersion}){
 if(version!=='1.63.0')throw new Error('WebKit cache requires exactly Playwright 1.63.0.');
 for(const value of [os,arch,imageOS,imageVersion])if(typeof value!=='string'||!/^[A-Za-z0-9._-]{1,100}$/.test(value))throw new Error('Missing or ambiguous runner OS image identity; refusing a partial cache key.');
 return `playwright-${version}-webkit-${os}-${arch}-${imageOS}-${imageVersion}`;
}

/** One bounded installation attempt; GitHub owns the sole conditional retry. */
export async function runAttempt({phase,attempt,command,args=[],timeoutMs=INSTALL_LIMITS[phase],killGraceMs=INSTALL_LIMITS.grace,signal,env=process.env,log=console.log}){
 if(!['deps','browser'].includes(phase)||![1,2].includes(attempt))throw new TypeError('Only deps/browser attempts 1 and 2 are allowed.');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>INSTALL_LIMITS[phase]||!Number.isSafeInteger(killGraceMs)||killGraceMs<0||killGraceMs>INSTALL_LIMITS.grace)throw new RangeError('Installation deadline exceeds its phase limit.');
 if(typeof command!=='string'||!Array.isArray(args)||args.some(a=>typeof a!=='string'))throw new TypeError('A command and explicit argument array are required.');
 const start=performance.now(),startedAt=new Date().toISOString();
 if(signal?.aborted)return{phase,attempt,ok:false,code:130,timedOut:false,cancelled:true,elapsedMs:0,timeoutMs,startedAt};
 if(attempt===2)log(`RETRY phase=${phase} attempt=2/2 (one retry only)`);
 log(`START phase=${phase} attempt=${attempt}/2 timeoutMs=${timeoutMs}`);
 return new Promise(resolveResult=>{
  let child,closed=false,exitCode=null,exitSignal=null,timer,forceTimer,finishTimer,stopping=null,forced=false,done=false,killError=null;
  function kill(sig){
   if(!child?.pid)return;
   try{
    if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:1000});
    else process.kill(-child.pid,sig);
   }catch(error){if(error.code!=='ESRCH'){killError=error.code;log(`CLEANUP phase=${phase} signal=${sig} error=${error.code}`);}}
  }
  function finish(){
   if(done)return;done=true;clearTimeout(timer);clearTimeout(forceTimer);clearTimeout(finishTimer);signal?.removeEventListener('abort',abort);
   const code=stopping==='timeout'?124:stopping==='cancelled'?130:exitCode??127;
   const result={phase,attempt,ok:code===0&&!stopping,code,signal:exitSignal,timedOut:stopping==='timeout',cancelled:stopping==='cancelled',elapsedMs:Math.ceil(performance.now()-start),timeoutMs,killGraceMs,startedAt,finishedAt:new Date().toISOString(),...(killError?{killError}: {})};
   const outcome=result.timedOut?'timeout':result.cancelled?'cancelled':result.ok?'success':'failed';
   log(`END phase=${phase} attempt=${attempt}/2 result=${outcome} exitCode=${code} elapsedMs=${result.elapsedMs}`);resolveResult(result);
  }
  function stop(reason){
   if(done||stopping)return;stopping=reason;clearTimeout(timer);log(`STOP phase=${phase} attempt=${attempt}/2 reason=${reason}`);kill('SIGTERM');
   forceTimer=setTimeout(()=>{forced=true;kill('SIGKILL');if(closed)finish();else finishTimer=setTimeout(()=>{child?.unref();finish();},500);},killGraceMs);
  }
  const abort=()=>stop('cancelled');
  child=spawn(command,args,{detached:process.platform!=='win32',windowsHide:true,stdio:'inherit',env:{...env,PATH:dirname(process.execPath)+(process.platform==='win32'?';':':')+(env.PATH??'')}});
  child.on('error',error=>{log(`SPAWN phase=${phase} error=${error.code}`);closed=true;exitCode=127;if(!stopping||forced)finish();});
  child.on('close',(code,sig)=>{closed=true;exitCode=code;exitSignal=sig;if(!stopping||forced)finish();});
  timer=setTimeout(()=>stop('timeout'),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
}

async function evidenceDirectory(){
 if(!process.env.RUNNER_TEMP)throw new Error('RUNNER_TEMP is required for CI installation records.');
 const directory=resolve(process.env.RUNNER_TEMP,'cim-webkit-install');await mkdir(directory,{recursive:true});return directory;
}
async function record(name,value){await writeFile(resolve(await evidenceDirectory(),name+'.json'),JSON.stringify(value,null,2)+'\n');}
async function installedVersion(){const {version}=JSON.parse(await readFile(new URL('../../node_modules/@playwright/test/package.json',import.meta.url),'utf8'));if(version!=='1.63.0')throw new Error('Expected the pinned Playwright 1.63.0 before installation.');return version;}
async function main(){
 const [phase,rawAttempt,...extra]=process.argv.slice(2);if(extra.length)throw new Error('Unexpected installation arguments.');
 if(phase==='cache-key'&&!rawAttempt){
  const key=makeCacheKey({version:await installedVersion(),os:process.env.RUNNER_OS,arch:process.env.RUNNER_ARCH,imageOS:process.env.ImageOS,imageVersion:process.env.ImageVersion});
  if(!process.env.GITHUB_OUTPUT)throw new Error('GITHUB_OUTPUT is required.');await appendFile(process.env.GITHUB_OUTPUT,'key='+key+'\n');await record('cache-key',{key});console.log('WebKit browser cache key: '+key);return;
 }
 if(phase==='cache-hit'&&!rawAttempt){await record('cache-hit',{phase:'browser',cacheHit:true,skipped:true,elapsedMs:0});console.log('WebKit exact cache hit: browser download skipped entirely.');return;}
 if(phase==='summary'&&!rawAttempt){
  const directory=await evidenceDirectory(),rows=[];
  for(const file of (await readdir(directory)).sort())if(/^(?:deps|browser)-[12]\.json$/.test(file)){const r=JSON.parse(await readFile(resolve(directory,file),'utf8'));rows.push(`| ${r.phase} | ${r.attempt} | ${r.ok?'success':r.timedOut?'timeout':'failed'} | ${r.elapsedMs} | ${r.timeoutMs} |`);}
  const text='### WebKit installation attempts\n\n| Phase | Attempt | Result | Elapsed ms | Command deadline ms |\n|---|---:|---|---:|---:|\n'+rows.join('\n')+'\n';
  console.log(text);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);return;
 }
 if(!['deps','browser'].includes(phase)||!['1','2'].includes(rawAttempt))throw new Error('Usage: webkit-install.mjs deps|browser 1|2, or cache-key|cache-hit|summary.');
 await installedVersion();
 const npx=process.platform==='win32'?resolve(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js'):resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npx-cli.js');
 const abort=new AbortController(),cancel=()=>abort.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
 console.log('COMMAND npx --no-install playwright '+(phase==='deps'?'install-deps':'install')+' webkit');
 const result=await runAttempt({phase,attempt:Number(rawAttempt),command:process.execPath,args:[npx,'--no-install','playwright',phase==='deps'?'install-deps':'install','webkit'],signal:abort.signal});
 process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);await record(phase+'-'+rawAttempt,result);process.exitCode=result.code;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
