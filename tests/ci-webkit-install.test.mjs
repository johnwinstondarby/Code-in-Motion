import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {runAttempt,makeCacheKey,INSTALL_LIMITS} from '../tools/ci/webkit-install.mjs';

const identity={version:'1.63.0',os:'Linux',arch:'X64',imageOS:'ubuntu24',imageVersion:'20261019.1.0'};
test('WebKit cache identity is exact and rejects missing/ambiguous components',()=>{
 assert.equal(makeCacheKey(identity),'playwright-1.63.0-webkit-Linux-X64-ubuntu24-20261019.1.0');
 assert.notEqual(makeCacheKey(identity),makeCacheKey({...identity,imageVersion:'20261020.1.0'}));
 assert.notEqual(makeCacheKey(identity),makeCacheKey({...identity,arch:'ARM64'}));
 for(const change of [{version:'1.62.0'},{imageVersion:''},{imageOS:'ubuntu24\nunsafe'}])assert.throws(()=>makeCacheKey({...identity,...change}));
});
test('a successful attempt reports its phase, result and elapsed time without a retry',async()=>{
 const logs=[];const result=await runAttempt({phase:'browser',attempt:1,command:process.execPath,args:['-e','process.exit(0)'],timeoutMs:2000,killGraceMs:50,log:x=>logs.push(x)});
 assert.equal(result.ok,true);assert.equal(result.code,0);assert.equal(result.timedOut,false);
 assert(logs.some(x=>x.includes('phase=browser')&&x.includes('attempt=1')));assert(logs.some(x=>x.includes('result=success')));
 assert(!logs.some(x=>x.includes('RETRY')));assert(result.elapsedMs>0);
});
test('a download failure retains its exit code and a second attempt is labelled once',async()=>{
 const logs=[];const result=await runAttempt({phase:'deps',attempt:2,command:process.execPath,args:['-e','process.exit(7)'],timeoutMs:2000,killGraceMs:50,log:x=>logs.push(x)});
 assert.equal(result.ok,false);assert.equal(result.code,7);assert.equal(result.timedOut,false);
 assert.equal(logs.filter(x=>x.includes('RETRY')).length,1);assert(logs.some(x=>x.includes('result=failed')));
});
test('a stalled HTTP download is killed within each bound, retries once, then fails', {timeout:15000},async t=>{
 const sockets=new Set();let requests=0;
 const server=createServer(()=>{requests++;});server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));});
 const url='http://127.0.0.1:'+server.address().port,logs=[],results=[];
 const code=`process.on('SIGTERM',()=>{});require('node:http').get(${JSON.stringify(url)}).on('error',()=>{});setInterval(()=>{},1000);`;
 for(const attempt of [1,2])results.push(await runAttempt({phase:'browser',attempt,command:process.execPath,args:['-e',code],timeoutMs:2000,killGraceMs:50,log:x=>logs.push(x)}));
 for(const result of results){assert.equal(result.ok,false);assert.equal(result.timedOut,true);assert.equal(result.code,124);assert(result.elapsedMs>=2000&&result.elapsedMs<5000);}
 assert.equal(requests,2);assert.equal(logs.filter(x=>x.includes('RETRY')).length,1);
 assert.equal(logs.filter(x=>x.includes('result=timeout')).length,2);
});
test('attempt count, deadlines and cancellation cannot become an unbounded retry',async()=>{
 assert(INSTALL_LIMITS.deps+INSTALL_LIMITS.grace+500<8*60000);
 assert(INSTALL_LIMITS.browser+INSTALL_LIMITS.grace+500<5*60000);
 for(const change of [{attempt:3},{phase:'test'},{timeoutMs:INSTALL_LIMITS.browser+1}])await assert.rejects(runAttempt({phase:'browser',attempt:1,command:process.execPath,args:['-e','process.exit(0)'],...change}));
 const controller=new AbortController();controller.abort();
 const result=await runAttempt({phase:'browser',attempt:1,command:process.execPath,args:['-e','process.exit(0)'],signal:controller.signal});
 assert.equal(result.cancelled,true);assert.equal(result.ok,false);assert.equal(result.timedOut,false);
});
test('only WebKit install steps get retries/cache; all other jobs and test commands stay frozen',async()=>{
 const current=parse(await readFile('.github/workflows/wordpress-e2e.yml','utf8'));
 const baseline=parse(await readFile('tests/fixtures/ci/wordpress-e2e-3304428.yml','utf8'));
 const job=current.jobs['browser-family-matrix'],steps=job.steps;
 const ids=['webkit-deps-first','webkit-deps-retry','webkit-browser-first','webkit-browser-retry'];
 for(const id of ids){const s=steps.find(s=>s.id===id);assert(s,'missing bounded install step '+id);assert.equal(s['timeout-minutes'],id.includes('deps')?8:5);assert.equal(s['continue-on-error']===true,id.endsWith('first'));assert(s.if.includes("matrix.browser == 'webkit'"));}
 for(const phase of ['deps','browser']){const retry=steps.find(s=>s.id===`webkit-${phase}-retry`);assert(retry.if.includes('!cancelled()'));assert(retry.if.includes(`steps.webkit-${phase}-first.outcome == 'failure'`));}
 const cache=steps.find(s=>s.id==='webkit-browser-cache');assert(cache);assert.equal(cache.with.path,'~/.cache/ms-playwright');assert(!cache.with['restore-keys']);assert(cache.with.key.includes('webkit-cache-key.outputs.key'));
 for(const id of ids.filter(x=>x.includes('browser'))){assert(steps.find(s=>s.id===id).if.includes("steps.webkit-browser-cache.outputs.cache-hit != 'true'"));}
 const mirror=steps.filter(s=>s.run?.includes('ubuntu-apt-mirror.mjs'));assert.equal(mirror.length,0,'no unproven mirror rewrite');
 const normalized=structuredClone(current);normalized.jobs['browser-family-matrix'].steps=steps.filter(s=>!s.id?.startsWith('webkit-')).map(s=>{const copy=structuredClone(s);if(copy.name==='Install selected browser for Playwright'){assert.equal(copy.if,"matrix.browser != 'webkit'");delete copy.if;}return copy;});
 assert.deepEqual(normalized,baseline);
});

test('only WebKit gets the exact APT connection limits before either dependency attempt',async()=>{
 const workflow=parse(await readFile('.github/workflows/wordpress-e2e.yml','utf8'));
 const steps=workflow.jobs['browser-family-matrix'].steps,config=steps.find(s=>s.id==='webkit-apt-network');
 assert(config,'missing APT connection timeout configuration');assert.equal(config.if,"matrix.browser == 'webkit'");assert.equal(config['timeout-minutes'],1);
 assert(steps.indexOf(config)<steps.findIndex(s=>s.id==='webkit-deps-first'));
 assert.equal(config.run,`printf '%s\\n' '' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' 'Acquire::Retries "3";' | sudo tee -a /etc/apt/apt.conf > /dev/null
apt-config dump | grep -E '^Acquire::(http::Timeout|https::Timeout|Retries) '
test "$(apt-config shell VALUE Acquire::http::Timeout)" = "VALUE='30'"
test "$(apt-config shell VALUE Acquire::https::Timeout)" = "VALUE='30'"
test "$(apt-config shell VALUE Acquire::Retries)" = "VALUE='3'"
`);
});
