import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE, EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../src/renderers/interface.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experienceFixture({ dwell = 0, steps = 3 } = {}) {
  const authored = [
    {
      id: 'step-01',
      label: 'One',
      commentary: { text: 'One', links: [] },
      state: { node: 'B' },
      ...(dwell > 0 ? { dwell_ms: dwell } : {})
    },
    {
      id: 'step-02',
      label: 'Observe',
      commentary: { text: 'Observe', links: [] },
      state: { node: 'B' }
    },
    {
      id: 'step-03',
      label: 'Three',
      commentary: { text: 'Three', links: [] },
      state: { node: 'C' }
    }
  ].slice(0, steps);

  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'runtime-playback',
    renderer: 'synthetic/v1',
    renderer_config: { prefix: '>' },
    initial_state: { node: 'A' },
    steps: authored
  });
}

function virtualScheduler(start = 0) {
  let now = start;
  let nextHandle = 0;
  const timers = new Map();

  const scheduler = Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      timers.set(handle, { at: now + ms, fn });
      return handle;
    },
    cancel(handle) {
      return timers.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      timers.set(handle, { at: Number.POSITIVE_INFINITY, fn });
      return handle;
    }
  });

  function runDue() {
    let ran = true;
    while (ran) {
      ran = false;
      const due = [...timers.entries()]
        .filter(([, entry]) => entry.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      for (const [handle, entry] of due) {
        if (!timers.has(handle)) continue;
        timers.delete(handle);
        entry.fn();
        ran = true;
      }
    }
  }

  return {
    scheduler,
    advance(ms) {
      now += ms;
      runDue();
    }
  };
}

function controlledRenderer() {
  const renders = [];
  const pending = [];

  return {
    renderer: Object.freeze({
      mount() {},
      render(state, context) {
        renders.push({ state, context });
        if (!context.animate) return Promise.resolve();

        return new Promise((resolve, reject) => {
          let settled = false;
          const unsubscribe = context.abortSignal.onAbort((reason) => {
            if (settled) return;
            settled = true;
            unsubscribe();
            reject(new RendererCancelledError(reason));
          });
          pending.push({
            context,
            resolve() {
              if (settled) return false;
              settled = true;
              unsubscribe();
              resolve();
              return true;
            },
            reject(error = new Error('renderer failed')) {
              if (settled) return false;
              settled = true;
              unsubscribe();
              reject(error);
              return true;
            }
          });
        });
      },
      dispose() {}
    }),
    renders,
    pending
  };
}

function rootFixture() {
  return {};
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function eventNames(events) {
  return events.map((event) => event.event);
}

test('play starts animated continuity and automatically advances through zero-dwell steps', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  const outcome = await instance.play(COMMAND_SOURCE.TRANSPORT);

  assert.equal(outcome.command, 'play');
  assert.equal(outcome.result, 'success');
  assert.equal(outcome.transitionId, 'txn-2');
  assert.equal(controlled.pending.length, 1);
  assert.equal(controlled.pending[0].context.animate, true);
  assert.equal(controlled.pending[0].context.fromStepId, 'initial');
  assert.deepEqual(controlled.pending[0].context.fromState, { node: 'A' });
  assert.equal(controlled.pending[0].context.stepId, 'step-01');

  let snapshot = instance.read.snapshot();
  assert.equal(snapshot.operational.playbackIntent, true);
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, 'step-01');
  assert.equal(snapshot.canonical.status, 'transitioning');

  controlled.pending[0].resolve();
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-01');
  assert.equal(snapshot.canonical.targetStepId, 'step-02');
  assert.equal(controlled.pending.length, 2);
  assert.equal(controlled.pending[1].context.fromStepId, 'step-01');
  assert.equal(controlled.pending[1].context.stepId, 'step-02');

  controlled.pending[1].resolve();
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-02');
  assert.equal(snapshot.canonical.targetStepId, 'step-03');
  assert.equal(controlled.pending.length, 3);

  controlled.pending[2].resolve();
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-03');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'idle');
  assert.equal(snapshot.operational.playbackIntent, false);

  const transitions = events.filter((event) => event.event === EVENT_NAME.TRANSITION_STARTED);
  assert.deepEqual(transitions.map((event) => event.command_id), ['cmd-1', 'cmd-1', 'cmd-1']);
  assert.deepEqual(transitions.map((event) => event.transition_id), ['txn-2', 'txn-3', 'txn-4']);

  const changed = events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED);
  assert.deepEqual(changed.map((event) => event.step_id), ['step-01', 'step-02', 'step-03']);

  const names = eventNames(events);
  assert.ok(names.indexOf(EVENT_NAME.PLAYBACK_STARTED) < names.indexOf(EVENT_NAME.TRANSITION_STARTED));
  assert.ok(names.lastIndexOf(EVENT_NAME.STEP_CHANGED) < names.indexOf(EVENT_NAME.PLAYBACK_STOPPED));
  const stopped = events.findLast((event) => event.event === EVENT_NAME.PLAYBACK_STOPPED);
  assert.equal(stopped.details.reason, 'at_end');
});

test('equal subject state does not suppress semantic advancement during playback', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture({ steps: 2 }),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  controlled.pending[0].resolve();
  await flush();
  controlled.pending[1].resolve();
  await flush();

  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-02');
  assert.deepEqual(
    events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).map((event) => event.step_id),
    ['step-01', 'step-02']
  );
});

test('non-zero dwell delays automatic continuation and updates remaining dwell from virtual time', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture({ dwell: 100, steps: 2 }),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  controlled.pending[0].resolve();
  await flush();

  let snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-01');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'playing');
  assert.equal(snapshot.operational.dwellRemainingMs, 100);
  assert.equal(controlled.pending.length, 1);

  time.advance(99);
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.operational.dwellRemainingMs, 1);
  assert.equal(controlled.pending.length, 1);

  time.advance(1);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.operational.dwellRemainingMs, 0);
  assert.equal(snapshot.canonical.targetStepId, 'step-02');
  assert.equal(controlled.pending.length, 2);

  controlled.pending[1].resolve();
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-02');

  const dwellStarted = events.find((event) => event.event === EVENT_NAME.DWELL_STARTED);
  const dwellCompleted = events.find((event) => event.event === EVENT_NAME.DWELL_COMPLETED);
  assert.equal(dwellStarted.details.dwell_ms, 100);
  assert.equal(dwellCompleted.details.dwell_ms, 100);
  assert.ok(dwellStarted.sequence < dwellCompleted.sequence);
});

test('navigation during dwell cancels dwell, clears playback intent, and then settles navigation', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture({ dwell: 100, steps: 2 }),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play(COMMAND_SOURCE.TRANSPORT);
  controlled.pending[0].resolve();
  await flush();
  time.advance(40);

  const home = await instance.home(COMMAND_SOURCE.TRANSPORT);
  assert.equal(home.result, 'success');

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.operational.playbackIntent, false);
  assert.equal(snapshot.operational.dwellRemainingMs, 0);

  const cancelled = events.find((event) => event.event === EVENT_NAME.DWELL_CANCELLED);
  const stopped = events.find((event) => event.event === EVENT_NAME.PLAYBACK_STOPPED && event.details.reason === 'navigation');
  assert.equal(cancelled.details.dwell_remaining_ms, 60);
  assert.ok(cancelled.sequence < stopped.sequence);
});

test('play at final boundary is accepted no_change and does not start playback', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture({ steps: 2 }),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.end();
  const outcome = await instance.play(COMMAND_SOURCE.TRANSPORT);

  assert.equal(outcome.result, 'no_change');
  assert.equal(outcome.reason, 'at_end');
  assert.equal(instance.read.snapshot().operational.playbackIntent, false);

  const started = events.filter((event) => event.event === EVENT_NAME.PLAYBACK_STARTED);
  assert.equal(started.length, 0);
});

test('a second play during active playback is rejected without replacing the transition', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });

  await instance.initialize();
  const first = await instance.play();
  const second = await instance.play();

  assert.equal(first.result, 'success');
  assert.equal(second.result, 'rejected');
  assert.equal(second.reason, 'invalid_state');
  assert.equal(instance.read.snapshot().canonical.targetStepId, 'step-01');
  assert.equal(controlled.pending.length, 1);
});

test('discrete navigation supersedes an active playback transition and prevents stale commit', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play(COMMAND_SOURCE.TRANSPORT);
  assert.equal(instance.read.snapshot().canonical.targetStepId, 'step-01');

  const previous = await instance.previous(COMMAND_SOURCE.TRANSPORT);
  assert.equal(previous.result, 'no_change');

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.operational.playbackIntent, false);

  assert.ok(events.some((event) => event.event === EVENT_NAME.TRANSITION_CANCELLED));
  assert.ok(events.some((event) => event.event === EVENT_NAME.RENDERER_CANCELLED));
  assert.ok(events.some((event) => event.event === EVENT_NAME.PLAYBACK_STOPPED && event.details.reason === 'navigation'));
  assert.equal(events.some((event) => event.event === EVENT_NAME.STEP_CHANGED), false);
});

test('renderer failure during continuous playback preserves the last committed boundary and stops playback', async () => {
  const time = virtualScheduler();
  const controlled = controlledRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: controlled.renderer,
    rendererRoot: rootFixture()
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  controlled.pending[0].reject(new Error('boom'));
  await flush();

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'idle');
  assert.equal(snapshot.operational.playbackIntent, false);

  assert.ok(events.some((event) => event.event === EVENT_NAME.RENDERER_ERROR));
  assert.ok(events.some((event) => event.event === EVENT_NAME.TRANSITION_FAILED));
  assert.ok(events.some((event) => event.event === EVENT_NAME.PLAYBACK_STOPPED && event.details.reason === 'fault'));
});
