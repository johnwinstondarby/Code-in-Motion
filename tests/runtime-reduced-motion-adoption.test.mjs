import test from 'node:test';
import assert from 'node:assert/strict';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experienceFixture({ id = 'runtime-reduced-motion', dwellMs = 0 } = {}) {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id,
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        dwell_ms: dwellMs,
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
      },
      {
        id: 'step-02',
        label: 'Two',
        commentary: { text: 'Two', links: [] },
        state: { node: 'C' }
      }
    ]
  });
}

function clockFixture() {
  let now = 0;
  let nextHandle = 0;
  const work = new Map();

  function dueEntries() {
    return [...work.entries()]
      .filter(([, item]) => item.kind === 'timer' && item.at <= now)
      .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
  }

  const clock = Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      work.set(handle, { kind: 'timer', at: now + ms, fn });
      return handle;
    },
    cancel(handle) {
      return work.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      work.set(handle, { kind: 'frame', fn });
      return handle;
    }
  });

  return {
    clock,
    advance(ms) {
      now += ms;
      while (true) {
        const due = dueEntries();
        if (due.length === 0) break;
        for (const [handle, item] of due) {
          if (!work.delete(handle)) continue;
          item.fn();
        }
      }
    }
  };
}

function rendererHarness({ deferredCalls = [] } = {}) {
  const deferredSet = new Set(deferredCalls);
  const contexts = [];
  const pending = new Map();
  let renderCall = 0;

  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      const call = ++renderCall;
      contexts.push(context);
      if (!deferredSet.has(call)) return Promise.resolve();
      return new Promise((resolve, reject) => {
        pending.set(call, { resolve, reject });
      });
    },
    dispose() {}
  });

  return {
    renderer,
    contexts,
    resolve(call) {
      const item = pending.get(call);
      assert.ok(item, `render call ${call} must be pending`);
      pending.delete(call);
      item.resolve();
    },
    reject(call, error = new Error(`render-${call}-failed`)) {
      const item = pending.get(call);
      assert.ok(item, `render call ${call} must be pending`);
      pending.delete(call);
      item.reject(error);
    }
  };
}

function instanceFixture({
  instanceId = 'runtime-reduced-motion-instance',
  experience = experienceFixture(),
  reducedMotion = false,
  clockHarness = clockFixture(),
  recording = rendererHarness()
} = {}) {
  return {
    instance: createCiMInstance({
      instanceId,
      experience,
      clock: clockHarness.clock,
      renderer: recording.renderer,
      rendererRoot: {},
      reducedMotion
    }),
    clockHarness,
    recording
  };
}

async function waitFor(predicate, message) {
  for (let index = 0; index < 25; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

test('Runtime adoption result is exact frozen data and same-value adoption is a no-change fact', () => {
  const { instance } = instanceFixture();

  const unchanged = instance.adoptReducedMotion(false);
  assert.ok(Object.isFrozen(unchanged));
  assert.deepEqual(Object.keys(unchanged), ['changed', 'reducedMotion']);
  assert.deepEqual(unchanged, { changed: false, reducedMotion: false });

  const changed = instance.adoptReducedMotion(true);
  assert.ok(Object.isFrozen(changed));
  assert.deepEqual(Object.keys(changed), ['changed', 'reducedMotion']);
  assert.deepEqual(changed, { changed: true, reducedMotion: true });
});

test('adoption before initialization is sampled by the initial renderer context', async () => {
  const { instance, recording } = instanceFixture();

  instance.adoptReducedMotion(true);
  await instance.initialize();

  assert.equal(recording.contexts.length, 1);
  assert.equal(recording.contexts[0].reducedMotion, true);
});

test('stable Runtime adoption changes the next renderer context without rerendering the stable boundary', async () => {
  const { instance, recording } = instanceFixture();
  await instance.initialize();
  assert.equal(recording.contexts[0].reducedMotion, false);

  const before = instance.read.snapshot();
  const events = [];
  const unsubscribe = instance.events.subscribe((event) => events.push(event));
  instance.adoptReducedMotion(true);
  const after = instance.read.snapshot();

  assert.deepEqual(after, before);
  assert.equal(events.length, 0);
  assert.equal(recording.contexts.length, 1);

  await instance.next('transport');
  assert.equal(recording.contexts.length, 2);
  assert.equal(recording.contexts[1].reducedMotion, true);
  unsubscribe();
});

test('active and paused renderer work keeps its captured preference while the following render sees the adopted value', async () => {
  const recording = rendererHarness({ deferredCalls: [2] });
  const { instance } = instanceFixture({ recording });
  await instance.initialize();

  const playOutcome = await instance.play('transport');
  assert.equal(playOutcome.result, 'success');
  assert.equal(recording.contexts.length, 2);
  assert.equal(recording.contexts[1].animate, true);
  assert.equal(recording.contexts[1].reducedMotion, false);

  const pauseOutcome = instance.pause('transport');
  assert.equal(pauseOutcome.result, 'success');
  instance.adoptReducedMotion(true);

  assert.equal(recording.contexts[1].reducedMotion, false);
  recording.resolve(2);
  await Promise.resolve();
  assert.equal(recording.contexts.length, 2);

  const resumeOutcome = await instance.play('transport');
  assert.equal(resumeOutcome.result, 'success');
  await waitFor(
    () => recording.contexts.length >= 3,
    'playback must start the following renderer context after resumed settlement'
  );
  assert.equal(recording.contexts[2].reducedMotion, true);
});

test('adoption during dwell preserves dwell timing and applies to the following playback render', async () => {
  const clockHarness = clockFixture();
  const recording = rendererHarness();
  const { instance } = instanceFixture({
    experience: experienceFixture({ id: 'runtime-reduced-motion-dwell', dwellMs: 50 }),
    clockHarness,
    recording
  });
  await instance.initialize();

  await instance.play('transport');
  await waitFor(
    () => instance.read.snapshot().operational.dwellRemainingMs === 50,
    'playback must enter authored dwell after the first step settles'
  );
  assert.equal(recording.contexts.length, 2);

  instance.adoptReducedMotion(true);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 50);
  clockHarness.advance(49);
  assert.equal(recording.contexts.length, 2);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 1);

  clockHarness.advance(1);
  await waitFor(
    () => recording.contexts.length >= 3,
    'dwell completion must start the following playback render'
  );
  assert.equal(recording.contexts[2].reducedMotion, true);
});

test('active recovery keeps its captured preference and later work uses the adopted value', async () => {
  const recording = rendererHarness({ deferredCalls: [2, 3] });
  const { instance } = instanceFixture({
    instanceId: 'runtime-reduced-motion-recovery',
    recording
  });
  await instance.initialize();

  const navigation = instance.next('transport');
  await waitFor(() => recording.contexts.length === 2, 'destination render must start');
  recording.reject(2, new Error('destination failed'));
  await waitFor(() => recording.contexts.length === 3, 'recovery render must start');

  assert.equal(recording.contexts[2].animate, false);
  assert.equal(recording.contexts[2].reducedMotion, false);
  instance.adoptReducedMotion(true);
  assert.equal(recording.contexts[2].reducedMotion, false);

  recording.resolve(3);
  await assert.rejects(navigation, /destination failed/);

  await instance.next('transport');
  assert.equal(recording.contexts.length, 4);
  assert.equal(recording.contexts[3].reducedMotion, true);
});

test('Runtime adoption rejects non-boolean values without changing the active preference', async () => {
  const { instance, recording } = instanceFixture();

  for (const value of [undefined, null, 0, 1, 'true', {}, []]) {
    assert.throws(
      () => instance.adoptReducedMotion(value),
      /reducedMotion must be boolean/
    );
  }

  await instance.initialize();
  await instance.next('transport');
  assert.equal(recording.contexts[0].reducedMotion, false);
  assert.equal(recording.contexts[1].reducedMotion, false);
});

test('disposed Runtime rejects later preference adoption and creates no new renderer work', async () => {
  const { instance, recording } = instanceFixture();
  await instance.initialize();
  await instance.dispose();
  const calls = recording.contexts.length;

  assert.throws(
    () => instance.adoptReducedMotion(true),
    /disposed CiMInstance cannot adopt reduced motion/
  );
  assert.equal(recording.contexts.length, calls);
});