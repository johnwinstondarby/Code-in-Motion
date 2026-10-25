import test from 'node:test';
import assert from 'node:assert/strict';
import * as binding from '../wordpress/assets/panes-binding.mjs';
const {readVerifiedPackJSON}=binding,DEADLINE=()=>binding.PANES_FETCH_TIMEOUT_MS;

// PR #111 review, finding 2: a stalled pack response must end in the fallback, never hold the page.
const baseURI='https://example.test/lesson/';
const href='/wp-content/plugins/p/capture.json?cim-sha256='+'a'.repeat(64);
function timers(){const pending=new Map();let next=1;return{setTimeout:(fn,ms)=>{const id=next++;pending.set(id,{fn,ms});return id;},clearTimeout:id=>{pending.delete(id);},fire(){const all=[...pending.values()];pending.clear();for(const t of all)t.fn();},pending};}
const settled=async promise=>{let state='pending';promise.then(()=>{state='resolved';},()=>{state='rejected';});await new Promise(r=>setImmediate(r));return state;};

test('[PC-14] a pack response that never arrives is abandoned at the deadline',async()=>{
 assert.equal(typeof DEADLINE(),'number','a deadline constant is exported');assert.ok(DEADLINE()>0&&DEADLINE()<=30000);
 const clock=timers();let signal;
 const reading=readVerifiedPackJSON(href,{baseURI,fetch:(url,init)=>{signal=init.signal;return new Promise(()=>{});},...clock});
 assert.equal(await settled(reading),'pending');
 assert.ok([...clock.pending.values()].some(t=>t.ms===DEADLINE()),'a deadline is scheduled');
 clock.fire();
 assert.equal(await settled(reading),'rejected','the read ends when the deadline passes');
 await assert.rejects(reading,/did not arrive/);
 assert.equal(signal?.aborted,true,'the request is aborted, not left open');
});

test('[PC-15] a pack body that stalls mid-stream is abandoned at the deadline',async()=>{
 const clock=timers();let cancelled=false;
 const body={getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled=true;},releaseLock(){}})};
 const reading=readVerifiedPackJSON(href,{baseURI,fetch:async()=>({ok:true,redirected:false,body,headers:{get:()=>null}}),...clock});
 assert.equal(await settled(reading),'pending');
 clock.fire();
 assert.equal(await settled(reading),'rejected','the read ends when the deadline passes');
 await assert.rejects(reading,/did not arrive/);
 assert.equal(cancelled,true,'the stalled body is cancelled');
});

test('[PC-17] one deadline covers fetching and reading; arriving chunks never extend it',async()=>{
 const clock=timers();let pendingRead=null,cancelled=false,signal;const scheduled=[];
 const setTimeout=(fn,ms)=>{scheduled.push(ms);return clock.setTimeout(fn,ms);};
 const body={getReader:()=>({read:()=>new Promise(resolve=>{pendingRead=resolve;}),cancel:async()=>{cancelled=true;},releaseLock(){}})};
 const reading=readVerifiedPackJSON(href,{baseURI,fetch:async(url,init)=>{signal=init.signal;return{ok:true,redirected:false,body,headers:{get:()=>null}};},setTimeout,clearTimeout:clock.clearTimeout});
 // A slow trickle: each chunk arrives in time, but the whole read must still end at the one deadline.
 for(let i=0;i<5;i++){await new Promise(r=>setImmediate(r));assert.equal(typeof pendingRead,'function','the reader is waiting for a chunk');const deliver=pendingRead;pendingRead=null;deliver({value:new Uint8Array([32]),done:false});}
 await new Promise(r=>setImmediate(r));
 assert.equal(scheduled.length,1,'exactly one deadline for the whole read: '+JSON.stringify(scheduled));
 assert.equal(scheduled[0],DEADLINE());
 assert.equal(await settled(reading),'pending');
 clock.fire();
 assert.equal(await settled(reading),'rejected','the read ends at the deadline despite arriving chunks');
 await assert.rejects(reading,/did not arrive/);
 assert.equal(cancelled,true,'the reader is cancelled');
 assert.equal(signal.aborted,true,'the request is aborted');
});
