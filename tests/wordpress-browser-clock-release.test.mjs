import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createWordPressClockFactory } from '../src/host/wordpress-browser-bindings.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experience() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'wordpress-clock-release',
    renderer: 'synthetic/v1',
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'Step 1',
        commentary: { text: 'Advance to B.', links: [] },
        state: { node: 'B' }
      }
    ]
  });
}

async function flush() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function hiddenBrowserTiming() {
  let nowValue = 0;
  let nextTimer = 0;
  let nextFrame = 1000;
  let firedFrames = 0;
  let cancelledFrames = 0;
  let clearedTimers = 0;
  const timers = new Map();
  const frames = new Map();
  const scheduledDelays = [];

  function runDueTimers() {
    let progressed = true;
    while (progressed) {
      progressed = false;
      const due = [...timers.entries()]
        .filter(([, entry]) => entry.at <= nowValue)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0]);
      for (const [id, entry] of due) {
        if (!timers.delete(id)) continue;
        progressed = true;
        entry.fn();
      }
    }
  }

  return {
    options: {
      now: () => nowValue,
      setTimeout(fn, ms) {
        const id = ++nextTimer;
        scheduledDelays.push(ms);
        timers.set(id, { fn, at: nowValue + ms, ms });
        return id;
      },
      clearTimeout(id) {
        if (timers.delete(id)) clearedTimers += 1;
      },
      requestAnimationFrame(fn) {
        const id = ++nextFrame;
        frames.set(id, fn);
        return id;
      },
      cancelAnimationFrame(id) {
        if (frames.delete(id)) cancelledFrames += 1;
      }
    },
    advance(ms) {
      nowValue += ms;
      runDueTimers();
    },
    setNow(value) {
      nowValue = value;
    },
    fireOneFrame() {
      const first = frames.entries().next();
      if (first.done) return false;
      const [id, fn] = first.value;
      frames.delete(id);
      firedFrames += 1;
      fn(nowValue);
      return true;
    },
    pendingTimers: () => timers.size,
    pendingFrames: () => frames.size,
    firedFrames: () => firedFrames,
    cancelledFrames: () => cancelledFrames,
    clearedTimers: () => clearedTimers,
    scheduledDelays: () => [...scheduledDelays]
  };
}

const root = {};

test('R1 browser clock enforces monotonic source time and source-specific cancellation', () => {
  const timing = hiddenBrowserTiming();
  const factory = createWordPressClockFactory(timing.options);
  const clock = factory.create();

  timing.setNow(10);
  assert.equal(clock.now(), 10);
  timing.setNow(11);
  assert.equal(clock.now(), 11);
  timing.setNow(10.5);
  assert.throws(() => clock.now(), /must be monotonic/);

  timing.setNow(12);
  let delayedCalls = 0;
  const delayHandle = clock.schedule(() => { delayedCalls += 1; }, 25);
  assert.equal(timing.pendingTimers(), 1);
  assert.equal(clock.cancel(delayHandle), true);
  assert.equal(timing.pendingTimers(), 0);
  assert.equal(timing.clearedTimers(), 1);
  timing.advance(25);
  assert.equal(delayedCalls, 0);

  let frameCalls = 0;
  const frameHandle = clock.onFrame(() => { frameCalls += 1; });
  assert.equal(timing.pendingFrames(), 1);
  assert.equal(clock.cancel(frameHandle), true);
  assert.equal(timing.pendingFrames(), 0);
  assert.equal(timing.cancelledFrames(), 1);
  assert.equal(timing.fireOneFrame(), false);
  assert.equal(frameCalls, 0);
});

test('R2 disposal reaches terminal state when render-abort acknowledgement times out with rAF frozen', async () => {
  const timing = hiddenBrowserTiming();
  const clock = createWordPressClockFactory(timing.options).create();
  let disposeCount = 0;

  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      if (!context.animate) return Promise.resolve();
      context.clock.onFrame(() => {
        throw new Error('hidden-page frame callback must not run during this proof.');
      });
      return new Promise(() => {});
    },
    dispose() { disposeCount += 1; }
  });

  const instance = createCiMInstance({
    instanceId: 'wp-hidden-abort-ack',
    experience: experience(),
    clock,
    renderer,
    rendererRoot: root
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  await flush();
  assert.equal(timing.pendingFrames(), 1);
  assert.equal(timing.firedFrames(), 0);

  let settled = false;
  const disposal = instance.dispose().then((snapshot) => {
    settled = true;
    return snapshot;
  });
  await flush();

  assert.equal(settled, false);
  assert.equal(timing.pendingFrames(), 0);
  assert.equal(timing.cancelledFrames(), 1);
  assert.ok(timing.scheduledDelays().includes(1000));

  timing.advance(999);
  await flush();
  assert.equal(settled, false);
  assert.equal(timing.firedFrames(), 0);

  timing.advance(1);
  const snapshot = await disposal;
  assert.equal(snapshot.canonical.status, 'disposed');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(disposeCount, 1);
  assert.equal(timing.firedFrames(), 0);

  const timeout = events.find(
    (event) => event.event === EVENT_NAME.RENDERER_ERROR && event.error_code === 'CIM-RND-002'
  );
  assert.ok(timeout);
  assert.equal(timeout.details.operation, 'abort_acknowledgement');
  assert.equal(timeout.details.timeout_ms, 1000);
});

test('R2 renderer-dispose acknowledgement reaches terminal settlement with rAF frozen', async () => {
  const timing = hiddenBrowserTiming();
  const clock = createWordPressClockFactory(timing.options).create();
  let releaseDispose;

  const renderer = Object.freeze({
    mount() {},
    render() { return Promise.resolve(); },
    dispose() {
      return new Promise((resolve) => {
        releaseDispose = resolve;
      });
    }
  });

  const instance = createCiMInstance({
    instanceId: 'wp-hidden-dispose-ack',
    experience: experience(),
    clock,
    renderer,
    rendererRoot: root
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();

  let settled = false;
  const disposal = instance.dispose().then((snapshot) => {
    settled = true;
    return snapshot;
  });
  await flush();

  assert.equal(instance.read.snapshot().canonical.status, 'disposed');
  assert.equal(settled, false);
  assert.ok(timing.scheduledDelays().includes(1000));
  assert.equal(timing.firedFrames(), 0);

  timing.advance(999);
  await flush();
  assert.equal(settled, false);

  timing.advance(1);
  const snapshot = await disposal;
  assert.equal(snapshot.canonical.status, 'disposed');
  assert.equal(timing.firedFrames(), 0);

  const timeout = events.find(
    (event) => event.event === EVENT_NAME.RENDERER_ERROR && event.error_code === 'CIM-RND-003'
  );
  assert.ok(timeout);
  assert.equal(timeout.details.operation, 'dispose_acknowledgement');
  assert.equal(timeout.details.timeout_ms, 1000);

  const eventCount = events.length;
  releaseDispose();
  await flush();
  assert.equal(events.length, eventCount);
});
