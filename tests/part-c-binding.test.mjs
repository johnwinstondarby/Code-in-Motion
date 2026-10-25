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
