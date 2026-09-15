import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../src/renderers/interface.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experienceFixture({ dwellMs = 0 } = {}) {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'runtime-pause-resume',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' },
        ...(dwellMs > 0 ? { dwell_ms: dwellMs } : {})
      }
    ]
  });
}

function virtualScheduler() {
  let now = 0;
  let nextHandle = 0;
  const timers = new Map();
  const frames = new Map();

  const scheduler = Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      timers.set(handle, { fn, due: now + ms });
      return handle;
    },
    cancel(handle) {
      return timers.delete(handle) || frames.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      frames.set(handle, fn);
      return handle;
    }
  });

  function advance(ms) {
    now += ms;
    const due = [...timers.entries()]
      .filter(([, entry]) => entry.due <= now)
      .sort((a, b) => a[1].due - b[1].due || a[0] - b[0]);
    for (const [handle, entry] of due) {
      if (timers.delete(handle)) entry.fn();
    }
    for (const fn of [...frames.values()]) fn();
  }

  return { scheduler, advance };
}

function clockedRenderer(metrics) {
  return Object.freeze({
    mount() {},
    render(_state, context) {
      metrics.contexts.push(context);
      if (!context.animate) return Promise.resolve();

      return new Promise((resolve, reject) => {
        let frameCount = 0;
        let delayDone = false;
        let settled = false;
        let frameHandle = null;
        let delayHandle = null;
        let unsubscribe = () => false;

        const cleanup = () => {
          if (frameHandle !== null) context.clock.cancel(frameHandle);
          if (delayHandle !== null) context.clock.cancel(delayHandle);
          unsubscribe();
        };
        const finish = () => {
          if (settled || frameCount < 2 || !delayDone) return;
          settled = true;
          cleanup();
          resolve();
        };

        frameHandle = context.clock.onFrame(() => {
          metrics.frames += 1;
          frameCount += 1;
          finish();
        });
        delayHandle = context.clock.schedule(() => {
          metrics.delays += 1;
          delayDone = true;
          finish();
        }, 100);
        unsubscribe = context.abortSignal.onAbort((reason) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new RendererCancelledError(reason));
        });
      });
    },
    dispose() {}
  });
}

function immediateRenderer() {
  return Object.freeze({
    mount() {},
    render() { return Promise.resolve(); },
    dispose() {}
  });
}

const root = Object.freeze({ nodeType: 1 });

async function flush() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

test('pause freezes renderer time in place while preserving transition identity and Core target', async () => {
  const time = virtualScheduler();
  const metrics = { frames: 0, delays: 0, contexts: [] };
  const instance = createCiMInstance({
    instanceId: 'pause-transition',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: clockedRenderer(metrics),
    rendererRoot: root
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  await flush();

  const beforePause = instance.read.snapshot();
  assert.equal(beforePause.canonical.status, 'transitioning');
  assert.equal(beforePause.canonical.currentStepId, 'initial');
  assert.equal(beforePause.canonical.targetStepId, 'step-01');
  assert.equal(beforePause.operational.transitionPhase, 'in_flight');
  const transitionId = beforePause.operational.transitionId;

  const paused = instance.pause();
  assert.equal(paused.result, 'success');
  const pausedSnapshot = instance.read.snapshot();
  assert.equal(pausedSnapshot.canonical.status, 'paused');
  assert.equal(pausedSnapshot.canonical.targetStepId, 'step-01');
  assert.equal(pausedSnapshot.operational.transitionId, transitionId);
  assert.equal(pausedSnapshot.operational.transitionPhase, 'in_flight');

  const framesAtPause = metrics.frames;
  const delaysAtPause = metrics.delays;
  time.advance(5000);
  await flush();

  const stillPaused = instance.read.snapshot();
  assert.equal(metrics.frames, framesAtPause);
  assert.equal(metrics.delays, delaysAtPause);
  assert.equal(stillPaused.operational.transitionId, transitionId);
  assert.equal(stillPaused.canonical.targetStepId, 'step-01');
  assert.equal(events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).length, 0);

  const resumed = await instance.play();
  assert.equal(resumed.transitionId, transitionId);
  assert.equal(instance.read.snapshot().canonical.status, 'transitioning');

  time.advance(100);
  time.advance(0);
  await flush();

  const settled = instance.read.snapshot();
  assert.equal(settled.canonical.currentStepId, 'step-01');
  assert.equal(settled.canonical.targetStepId, null);
  assert.equal(settled.operational.transitionId, null);
  assert.equal(settled.operational.transitionPhase, 'idle');
  assert.equal(events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).length, 1);
});

test('paused dwell preserves exact remaining time and resumes only the remainder', async () => {
  const time = virtualScheduler();
  const instance = createCiMInstance({
    instanceId: 'pause-dwell',
    experience: experienceFixture({ dwellMs: 100 }),
    clock: time.scheduler,
    renderer: immediateRenderer(),
    rendererRoot: root
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  await flush();

  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-01');
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 100);

  time.advance(40);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 60);

  const paused = instance.pause();
  assert.equal(paused.result, 'success');
  assert.equal(instance.read.snapshot().canonical.status, 'paused');
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 60);

  time.advance(5000);
  await flush();
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 60);
  assert.equal(events.filter((event) => event.event === EVENT_NAME.DWELL_COMPLETED).length, 0);

  await instance.play();
  assert.equal(instance.read.snapshot().canonical.status, 'playing');
  time.advance(59);
  await flush();
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 1);
  assert.equal(events.filter((event) => event.event === EVENT_NAME.DWELL_COMPLETED).length, 0);

  time.advance(1);
  await flush();
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 0);
  assert.equal(events.filter((event) => event.event === EVENT_NAME.DWELL_COMPLETED).length, 1);

  const completedIndex = events.findIndex((event) => event.event === EVENT_NAME.DWELL_COMPLETED);
  const stoppedIndex = events.findIndex(
    (event) => event.event === EVENT_NAME.PLAYBACK_STOPPED && event.details?.reason === 'at_end'
  );
  assert.ok(completedIndex >= 0 && stoppedIndex > completedIndex);
});

test('pause with no active transition or dwell is an accepted no_change', async () => {
  const time = virtualScheduler();
  const instance = createCiMInstance({
    instanceId: 'pause-idle',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: immediateRenderer(),
    rendererRoot: root
  });

  await instance.initialize();
  const outcome = instance.pause();
  assert.equal(outcome.result, 'no_change');
  assert.equal(instance.read.snapshot().canonical.status, 'idle');
});
