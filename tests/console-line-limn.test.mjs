import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsoleLineLimn} from '../wordpress/assets/console-line-limn.mjs';

function fixture(reduced=false) {
  const frames=new Map(),timers=new Map(); let next=0;
  const line=(role,id=null)=>({attrs:new Map(),getAttribute(name){return name==='data-output-id'?id:this.attrs.get(name);},
    setAttribute(name,value){this.attrs.set(name,value);},removeAttribute(name){this.attrs.delete(name);},
    getBoundingClientRect:()=>({top:150,height:20})});
  const command=line('command-line'), output=line('output-line','a'), other=line('output-line','b'), response=line('output-line','prompt');
  const entry={getAttribute:()=> 'beat',querySelector(selector){return selector.includes('command-line')?command:{closest:()=>response};},
    querySelectorAll:()=>[output,other,response]};
  const view={location:{href:'https://example.invalid/'},matchMedia:()=>({matches:reduced}),
    requestAnimationFrame(callback){frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout(callback,delay){assert.equal(delay,1200);timers.set(++next,callback);return next;},clearTimeout:id=>timers.delete(id)};
  const root={ownerDocument:{defaultView:view,querySelectorAll:()=>[]},querySelectorAll:()=>[entry],
    querySelector:()=>({getBoundingClientRect:()=>({height:20})})};
  const viewport={scrollTop:300,getBoundingClientRect:()=>({top:100})};
  const errors=[]; const binding=createConsoleLineLimn({rendererRoot:root,viewport,onError:e=>errors.push(e)});
  const fire=map=>{const [id,callback]=map.entries().next().value;map.delete(id);callback();};
  const show=(anchor,evidence=[])=>binding.show({beatId:'beat',stepId:'step',instruction:{anchor,evidence}});
  return {binding,show,frames,timers,fire,command,output,other,response,viewport,errors};
}

test('line limn resolves command and response without evidence and output by exact IDs',()=>{
  const f=fixture();
  for(const [anchor,evidence,nodes] of [['command',[],[f.command]],['output',['a','b'],[f.output,f.other]],['response',[],[f.response]]]) {
    f.show(anchor,evidence);f.fire(f.frames);
    for(const node of nodes)assert.equal(node.attrs.get('data-cim-line-limn'),'flash');
  }
  f.binding.dispose();
});

test('line limn starts after repositioning and decays on its own timer without a playback clock',()=>{
  const f=fixture();f.show('command');
  assert.equal(f.viewport.scrollTop,322);assert.equal(f.command.attrs.size,0);assert.equal(f.timers.size,0);
  f.fire(f.frames);assert.equal(f.command.attrs.get('data-cim-line-limn'),'flash');
  f.fire(f.timers);assert.equal(f.command.attrs.get('data-cim-line-limn'),'quiet');
  f.binding.dispose();
});

test('line limn repeats withdraw stale timers and navigation clears emphasis and cancels decay',()=>{
  const f=fixture();f.show('command');f.fire(f.frames);
  const stale=f.timers.values().next().value;
  f.show('command');assert.equal(f.timers.size,0);f.fire(f.frames);stale();
  assert.equal(f.command.attrs.get('data-cim-line-limn'),'flash');assert.equal(f.timers.size,1);
  f.binding.refresh('another-step');assert.equal(f.timers.size,0);assert.equal(f.command.attrs.size,0);
  f.binding.dispose();
});

test('line limn reduced motion stays steady without scheduling a fade',()=>{
  const f=fixture(true);f.show('command');f.fire(f.frames);
  assert.equal(f.command.attrs.get('data-cim-line-limn'),'steady');assert.equal(f.timers.size,0);
  f.binding.dispose();assert.equal(f.command.attrs.size,0);
});

test('line limn disposal withdraws pending frames and stale callbacks cannot reapply emphasis',()=>{
  const f=fixture();f.show('command');const stale=f.frames.values().next().value;
  f.binding.dispose();assert.equal(f.frames.size,0);stale();f.show('command');
  assert.equal(f.command.attrs.size,0);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.deepEqual(f.errors,[]);
});
