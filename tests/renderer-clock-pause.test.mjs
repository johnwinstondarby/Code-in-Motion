import test from 'node:test';
import assert from 'node:assert/strict';
import { createRendererClockCapability } from '../src/runtime/renderer-capabilities.mjs';

function schedulerFixture() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  const scheduler = {
    now: () => now,
    schedule(fn, ms) { const h=++id; timers.set(h,{at:now+ms,fn}); return h; },
    cancel(h) { return timers.delete(h) || frames.delete(h); },
    onFrame(fn) { const h=++id; frames.set(h,fn); return h; }
  };
  function advance(ms) {
    now += ms;
    const due=[...timers.entries()].filter(([,e])=>e.at<=now).sort((a,b)=>a[1].at-b[1].at);
    for (const [h,e] of due) { if (timers.delete(h)) e.fn(); }
    for (const fn of [...frames.values()]) fn();
  }
  return { scheduler, advance, get now(){return now;}, counts(){return {timers:timers.size,frames:frames.size};} };
}

test('pause freezes renderer callbacks and semantic now, resume preserves remaining delay', () => {
  const f=schedulerFixture();
  const c=createRendererClockCapability({transitionId:'txn-1',scheduler:f.scheduler});
  let delayed=0; let frames=0;
  c.facade.schedule(()=>delayed++,100);
  c.facade.onFrame(()=>frames++);
  f.advance(40);
  assert.equal(frames,1);
  assert.equal(c.facade.now(),40);
  const p=c.controller.pause();
  assert.equal(p.changed,true);
  const frozen=c.facade.now();
  f.advance(1000);
  assert.equal(c.facade.now(),frozen);
  assert.equal(delayed,0);
  assert.equal(frames,1);
  const r=c.controller.resume();
  assert.equal(r.changed,true);
  assert.equal(c.facade.now(),40);
  f.advance(59);
  assert.equal(delayed,0);
  f.advance(1);
  assert.equal(delayed,1);
  assert.ok(frames>1);
});

test('schedule and frame registration while paused stay dormant until resume', () => {
  const f=schedulerFixture();
  const c=createRendererClockCapability({transitionId:'txn-2',scheduler:f.scheduler});
  c.controller.pause();
  let delay=0; let frame=0;
  c.facade.schedule(()=>delay++,10);
  c.facade.onFrame(()=>frame++);
  f.advance(100);
  assert.equal(delay,0); assert.equal(frame,0);
  c.controller.resume();
  f.advance(9); assert.equal(delay,0);
  f.advance(1); assert.equal(delay,1); assert.equal(frame,2);
});
