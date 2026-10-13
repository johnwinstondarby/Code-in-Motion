import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsoleCopyBinding} from '../wordpress/assets/console-copy-binding.mjs';

function harness(writeText) {
  const listeners=new Set();
  const button={getAttribute:()=> 'git status --short',closest:()=>button};
  const status={textContent:''};
  const viewport={ownerDocument:{defaultView:{navigator:{clipboard:writeText?{writeText}:undefined}}},
    contains:target=>target===button,
    addEventListener:(type,listener)=>{assert.equal(type,'click');listeners.add(listener);},
    removeEventListener:(type,listener)=>listeners.delete(listener)};
  const binding=createConsoleCopyBinding({viewport,status});
  return {binding,status,button,listeners,click:(event={target:button})=>{for(const listener of listeners) listener(event);}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('copy writes exact authored value and announces it only after success',async()=>{
  let resolve;const values=[];const h=harness(value=>{values.push(value);return new Promise(done=>{resolve=done;});});
  h.click();assert.deepEqual(values,['git status --short']);assert.equal(h.status.textContent,'');
  resolve();await settle();assert.equal(h.status.textContent,'Copied command: git status --short');
});
test('clipboard denial, absence and synchronous failure give manual copy guidance',async()=>{
  for(const write of [undefined,()=>Promise.reject(new Error('denied')),()=>{throw new Error('failed');}]) {
    const h=harness(write);h.click();await settle();assert.match(h.status.textContent,/Could not copy.*Select the command text.*git status --short/);
  }
});
test('late writes cannot announce after disposal or overwrite a newer copy result',async()=>{
  const resolves=[];const h=harness(()=>new Promise(resolve=>resolves.push(resolve)));
  h.click();h.click();resolves[1]();await settle();h.status.textContent='newer';resolves[0]();await settle();assert.equal(h.status.textContent,'newer');
  h.click();const stale=[...h.listeners][0];h.binding.dispose();h.binding.dispose();resolves[2]();await settle();stale({target:h.button});
  assert.equal(h.status.textContent,'');assert.equal(h.listeners.size,0);assert.equal(resolves.length,3);
});
test('prevented events, sibling buttons and unrelated targets cannot write',()=>{
  let calls=0;const h=harness(()=>{calls++;});
  h.click({target:h.button,defaultPrevented:true});h.click({target:{closest:()=>({})}});h.click({target:{}});assert.equal(calls,0);
});
test('failed listener cleanup stays inert and can be retried',()=>{
  // Exercise the real listener removal path with a transient native target failure.
  const listeners=new Set();let failure=true;let calls=0;
  const button={getAttribute:()=> 'git status',closest:()=>button};
  const viewport={ownerDocument:{defaultView:{navigator:{clipboard:{writeText:()=>{calls++;}}}}},contains:()=>true,
    addEventListener:(_type,listener)=>listeners.add(listener),removeEventListener:(_type,listener)=>{if(failure){failure=false;throw new Error('transient');}listeners.delete(listener);}};
  const binding=createConsoleCopyBinding({viewport,status:{textContent:''}});
  assert.throws(()=>binding.dispose(),/transient/);
  for(const listener of listeners) listener({target:button});assert.equal(calls,0);
  binding.dispose();assert.equal(listeners.size,0);
});
