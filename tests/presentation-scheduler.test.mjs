import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertPlaybackRate,
  createPresentationScheduler
} from '../src/runtime/presentation-scheduler.mjs';

function createVirtualSourceScheduler() {
  let now = 0;
  let sequence = 0;
  const delays = new Map();
  const frames = new Map();

  function nextHandle(kind) {
    sequence += 1;
    return `${kind}-${sequence}`;
  }

  function fireDue() {
    let fired;
    do {
      fired = false;
      const due = [...delays.entries()]
        .filter(([, entry]) => entry.due <= now)
        .sort((a, b) => a[1].due - b[1].due || a[1].sequence - b[1].sequence);
      for (const [handle, entry] of due) {
        if (!delays.has(handle)) continue;
        delays.delete(handle);
        entry.fn(now);
        fired = true;
      }
    } while (fired);
  }

  return {
    now() {
      return now;
    },

    schedule(fn, ms) {
      const handle = nextHandle('delay');
      delays.set(handle, { fn, due: now + ms, sequence });
      return handle;
    },

    cancel(handle) {
      return delays.delete(handle) || frames.delete(handle);
    },

    onFrame(fn) {
      const handle = nextHandle('frame');
      frames.set(handle, fn);
      return handle;
    },

    advance(ms) {
      now += ms;
      fireDue();
    },

    emitFrame() {
      for (const fn of [...frames.values()]) fn(now);
    },

    pendingDelayCount() {
      return delays.size;
    }
  };
}

for (const [rate, expectedSourceMs] of [[0.5, 2000], [1, 1000], [2, 500]]) {
  test(`presentation delay dilates source time at ${rate}x`, () => {
    const sourceScheduler = createVirtualSourceScheduler();
    const { scheduler } = createPresentationScheduler({ sourceScheduler, initialRate: rate });
    const seen = [];

    scheduler.schedule((at) => seen.push(at), 1000);
    sourceScheduler.advance(expectedSourceMs - 1);
    assert.deepEqual(seen, []);
    sourceScheduler.advance(1);
    assert.deepEqual(seen, [1000]);
  });
}

test('rate change re-anchors semantic time and re-arms only the remaining presentation interval', () => {
  const sourceScheduler = createVirtualSourceScheduler();
  const { scheduler, control } = createPresentationScheduler({ sourceScheduler, initialRate: 1 });
  const seen = [];

  scheduler.schedule((at) => seen.push(at), 1000);
  sourceScheduler.advance(400);
  assert.equal(scheduler.now(), 400);

  assert.deepEqual(control.setRate(2), { changed: true, fromRate: 1, toRate: 2 });
  assert.equal(scheduler.now(), 400, 'rate change preserves the current presentation instant');
  assert.equal(sourceScheduler.pendingDelayCount(), 1, 'the pending delay is re-armed rather than duplicated');

  sourceScheduler.advance(299);
  assert.deepEqual(seen, []);
  assert.equal(scheduler.now(), 998);
  sourceScheduler.advance(1);
  assert.deepEqual(seen, [1000]);
});

test('slowing mid-flight preserves presentation progress and expands only the remainder', () => {
  const sourceScheduler = createVirtualSourceScheduler();
  const { scheduler, control } = createPresentationScheduler({ sourceScheduler, initialRate: 1 });
  let firedAt = null;

  scheduler.schedule((at) => { firedAt = at; }, 1000);
  sourceScheduler.advance(400);
  control.setRate(0.5);
  sourceScheduler.advance(1199);
  assert.equal(firedAt, null);
  sourceScheduler.advance(1);
  assert.equal(firedAt, 1000);
});

test('onFrame remains source-frame paced while callback time is presentation time', () => {
  const sourceScheduler = createVirtualSourceScheduler();
  const { scheduler, control } = createPresentationScheduler({ sourceScheduler, initialRate: 1 });
  const frames = [];

  const handle = scheduler.onFrame((at) => frames.push(at));
  sourceScheduler.emitFrame();
  sourceScheduler.advance(10);
  sourceScheduler.emitFrame();
  control.setRate(2);
  sourceScheduler.advance(10);
  sourceScheduler.emitFrame();

  assert.deepEqual(frames, [0, 10, 30]);
  assert.equal(scheduler.cancel(handle), true);
  sourceScheduler.emitFrame();
  assert.deepEqual(frames, [0, 10, 30]);
});

test('setting the current rate is a no-op and leaves armed work untouched', () => {
  const sourceScheduler = createVirtualSourceScheduler();
  const { scheduler, control } = createPresentationScheduler({ sourceScheduler, initialRate: 1 });
  scheduler.schedule(() => {}, 100);

  assert.deepEqual(control.setRate(1), { changed: false, fromRate: 1, toRate: 1 });
  assert.equal(sourceScheduler.pendingDelayCount(), 1);
});

test('rate validation accepts the closed interval and rejects invalid inputs', () => {
  assert.equal(assertPlaybackRate(0.5), 0.5);
  assert.equal(assertPlaybackRate(2), 2);
  for (const value of [0.49, 2.01, NaN, Infinity, -Infinity, '1', null, undefined]) {
    assert.throws(() => assertPlaybackRate(value), RangeError);
  }
});

test('delay validation and cancellation preserve scheduler ownership', () => {
  const sourceScheduler = createVirtualSourceScheduler();
  const { scheduler } = createPresentationScheduler({ sourceScheduler });
  const seen = [];

  assert.throws(() => scheduler.schedule(() => {}, -1), RangeError);
  const handle = scheduler.schedule(() => seen.push('fired'), 25);
  assert.equal(scheduler.cancel(handle), true);
  assert.equal(scheduler.cancel(handle), false);
  sourceScheduler.advance(100);
  assert.deepEqual(seen, []);
});
