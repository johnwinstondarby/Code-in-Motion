import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,resolve,join,basename} from 'node:path';
import {runAttempt,INSTALL_LIMITS} from './webkit-install.mjs';

const args=process.argv.slice(2),full=args[0]==='--full';if(full)args.shift();
if(args.length!==2||args[0]!=='--out')throw new Error('Usage: probe-webkit-deadline.mjs [--full] --out evidence.json');
const output=resolve(args[1]),temporaryRoot=await realpath(tmpdir()),cache=await mkdtemp(join(temporaryRoot,'cim-webkit-stall-'));
const sockets=new Set();let requests=0;
const server=createServer(()=>{requests++;});server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const logs=[],results=[],timeoutMs=full?INSTALL_LIMITS.browser:5000,killGraceMs=full?INSTALL_LIMITS.grace:100;
const env={...process.env,PLAYWRIGHT_DOWNLOAD_HOST:'http://127.0.0.1:'+server.address().port,PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:'600000',PLAYWRIGHT_BROWSERS_PATH:cache,CI:'1'};
delete env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
const npx=process.platform==='win32'?resolve(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js'):resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npx-cli.js');
try{
 for(const attempt of [1,2]){
  const wall=Date.now();const result=await runAttempt({phase:'browser',attempt,command:process.execPath,args:[npx,'--no-install','playwright','install','--force','webkit'],env,timeoutMs,killGraceMs,log:line=>{logs.push(line);console.log(line);}});
  result.wallMs=Date.now()-wall;results.push(result);
  assert.equal(result.ok,false);assert.equal(result.timedOut,true);assert.equal(result.code,124);
  assert(result.wallMs<(full?5*60000:10000),'attempt exceeded its outer step deadline');
 }
 assert(requests>=2,'both actual Playwright installers must reach the stalled HTTP endpoint');
 assert.equal(logs.filter(x=>x.includes('RETRY')).length,1);
 await writeFile(output,JSON.stringify({fullDuration:full,command:'npx --no-install playwright install --force webkit',endpoint:'loopback HTTP connection accepted, no response',requests,timeoutMs,killGraceMs,outerStepLimitMs:full?300000:10000,results,logs,terminalCode:124},null,2)+'\n',{flag:'wx'});
 console.log('Expected terminal download failure: both deadlines enforced, one retry logged.');process.exitCode=124;
}finally{
 for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));
 const final=await realpath(cache);if(dirname(final)!==temporaryRoot||!basename(final).startsWith('cim-webkit-stall-'))throw new Error('Refusing cleanup outside the dedicated probe cache.');
 await rm(final,{recursive:true,force:true});
}
