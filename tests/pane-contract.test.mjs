import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createPaneLifecycle, paneBoundary, paneTransition, PANE_METHODS } from '../src/contracts/pane.mjs';
import { createConsoleRenderer } from '../src/renderers/subjects/console/renderer.mjs';
import { RendererCancelledError } from '../src/renderers/interface.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { virtualScheduler } from './conformance/console-test-support.mjs';

function transition() {
  const scheduler = virtualScheduler(), listeners = new Set(), captured = [];
  let aborted = false, reason = null;
  const context = {stepId:'b1',stepRendererConfig:null,fromState:{value:0},animate:true,reducedMotion:false,
    host:{commands:{seek(){}}},core:{apply(){}},runtime:{play(){}},
    clock:{now:scheduler.now,schedule:(fn,ms)=>{captured.push(fn);return scheduler.schedule(fn,ms);},cancel:scheduler.cancel},
    abortSignal:{get aborted(){return aborted;},get reason(){return reason;},onAbort(fn){listeners.add(fn);return ()=>listeners.delete(fn);}}};
  return {context,scheduler,listeners,captured,abort(){aborted=true;reason='navigation';for(const fn of [...listeners])fn(reason);}};
}
function harness(overrides = {}) {
  const writes = [], seen = [];
  const pane = createPaneLifecycle({validate(){},frames:()=>[{delayMs:0,value:1},{delayMs:10,value:2},{delayMs:10,value:3}],
    settle:(container,state,config,context,identity)=>{writes.push(state.value);seen.push({state,config,context,identity});},
    frame:(container,frame)=>writes.push(frame.value),...overrides});
  pane.mount({}, {title:'test'}, {id:'test',type:'test/v1'});
  return {pane,writes,seen};
}

test('pane contract: bundled lessons page 3227 and canonical evidence stay byte-identical', () => {
  const baseline=JSON.parse(readFileSync(new URL('./fixtures/pane-contract-legacy-files.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(baseline.files)) assert.equal(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),hash,file);
});

test('pane contract: stale completion after cancellation is inert and releases listeners', async () => {
  const h=harness(),t=transition();
  const pending=h.pane.play({value:3},paneTransition(t.context));
  assert.deepEqual(h.writes,[1]);
  t.abort();
  assert.equal((await pending).status,'cancelled');
  assert.equal(t.listeners.size,0);assert.equal(t.scheduler.pending(),0);
  const before=[...h.writes];
  for(const callback of t.captured)callback(); // Host deliberately delivers cancelled work late.
  assert.deepEqual(h.writes,before);
});

test('pane contract: projection cannot expose core host or runtime authority', async () => {
  const h=harness(),t=transition();
  const boundary=paneBoundary(t.context),context=paneTransition(t.context);
  assert.deepEqual(Object.keys(boundary),['stepId','stepRendererConfig']);
  assert.deepEqual(Object.keys(context),['stepId','stepRendererConfig','fromState','animate','reducedMotion','clock','cancellation']);
  for(const value of [boundary,context,context.clock,context.cancellation]){
    assert(Object.isFrozen(value));
    for(const key of ['core','host','runtime','commands'])assert.equal(value[key],undefined);
  }
  assert.deepEqual(Object.keys(context.clock),['now','schedule','cancel']);
  assert.throws(()=>h.pane.settle({callback(){}},boundary),/plain JSON/);
  h.pane.settle({value:2},boundary);
  const seen=h.seen[0];
  for(const value of [seen.state,seen.config,seen.context,seen.identity])assert(Object.isFrozen(value));
  assert.deepEqual(Object.keys(seen.context),['stepId','stepRendererConfig']);
  assert.deepEqual(Object.keys(seen.identity),['id','type']);
  assert.throws(()=>createPaneLifecycle({}).mount({}, {}, {id:'x',type:'x/v1',host:t.context.host}),/identity/);
  assert.throws(()=>paneBoundary({...t.context,stepId:t.context.host}),/identity/);
});

test('pane contract: dispose finishes active work and removes every subscription', async () => {
  const h=harness(),t=transition();
  const pending=h.pane.play({value:3},paneTransition(t.context));
  assert.equal(t.listeners.size,1);
  h.pane.dispose();h.pane.dispose();
  assert.equal(t.listeners.size,0);assert.equal(t.scheduler.pending(),0);
  assert.equal((await pending).status,'cancelled');
  for(const callback of t.captured)callback();
  assert.deepEqual(h.writes,[1]);
  assert.throws(()=>h.pane.settle({value:4},paneBoundary(t.context)),/disposed/);
});

test('pane contract: finite plans use only the shared clock and settle to absolute state', async () => {
  const h=harness(),t=transition();
  assert.deepEqual(Object.keys(h.pane),PANE_METHODS);
  const pending=h.pane.play({value:3},paneTransition(t.context));
  assert.deepEqual(h.writes,[1]); // Paused shared clock: no autonomous progression.
  t.scheduler.advanceTo(9);assert.deepEqual(h.writes,[1]);
  t.scheduler.advanceTo(10);assert.deepEqual(h.writes,[1,2]);
  t.scheduler.advanceTo(20);assert.equal((await pending).status,'settled');
  assert.deepEqual(h.writes,[1,2,3]);assert.equal(t.listeners.size,0);
  const invalid=harness({frames:()=>[{delayMs:Infinity}]});
  assert.equal((await invalid.pane.play({value:3},paneTransition(t.context))).status,'failed');
  const broken=harness({frame(){throw new Error('draw failed');}});
  assert.equal((await broken.pane.play({value:3},paneTransition(t.context))).status,'failed');
  assert.equal(t.listeners.size,0);
});

test('pane contract: settle supersedes animation and reduced motion schedules nothing', async () => {
  const h=harness(),t=transition();
  const pending=h.pane.play({value:3},paneTransition(t.context));
  h.pane.settle({value:9},paneBoundary(t.context));
  assert.equal((await pending).status,'cancelled');
  for(const callback of t.captured)callback();
  assert.deepEqual(h.writes,[1,9]);
  t.context.reducedMotion=true;
  assert.equal((await h.pane.play({value:4},paneTransition(t.context))).status,'settled');
  assert.deepEqual(h.writes,[1,9,4]);assert.equal(t.scheduler.pending(),0);
});

test('pane contract: renderer disposal forwards to the Console pane', async () => {
  const lesson=JSON.parse(readFileSync(new URL('../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));
  const {root}=createMinimalRoot(),renderer=createConsoleRenderer(),t=transition();
  renderer.mount({root,instanceId:'disposal'});
  Object.assign(t.context,{rendererConfig:lesson.renderer_config,fromState:lesson.initial_state,stepId:lesson.steps[0].id,fromStepId:'initial',transitionId:'dispose-test'});
  const pending=renderer.render(lesson.steps[0].state,t.context);
  renderer.dispose();
  assert.equal(t.listeners.size,0);assert.equal(t.scheduler.pending(),0);
  await assert.rejects(pending,RendererCancelledError);
});

test('pane contract: invalid superseding render freezes the prior DOM and cancels its work', async () => {
  const lesson=JSON.parse(readFileSync(new URL('../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));
  const {root}=createMinimalRoot(),renderer=createConsoleRenderer(),t=transition();
  renderer.mount({root,instanceId:'invalid-supersede'});
  Object.assign(t.context,{rendererConfig:lesson.renderer_config,fromState:lesson.initial_state,stepId:lesson.steps[0].id,fromStepId:'initial',transitionId:'supersede-test'});
  const pending=renderer.render(lesson.steps[0].state,t.context);
  const nodes=[...root.childNodes];
  const cancelled=assert.rejects(pending,RendererCancelledError);
  await assert.rejects(renderer.render({transcript:[],focus:['missing']},t.context));
  assert.equal(t.listeners.size,0);assert.equal(t.scheduler.pending(),0);
  for(const callback of t.captured)callback();
  assert.deepEqual(root.childNodes,nodes);
  await cancelled;
});
