import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE, EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'runtime-recovery',
    renderer: 'synthetic/v1',
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
      }
    ]
  });
}

function schedulerFixture() {
  let now = 0;
  let nextHandle = 0;
  const scheduled = new Map();
  return Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      scheduled.set(handle, { fn, at: now + ms });
      return handle;
    },
    cancel(handle) {
      return scheduled.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      scheduled.set(handle, { fn, at: Number.POSITIVE_INFINITY });
      return handle;
    }
  });
}

function scriptedRenderer(script) {
  let call = 0;
  const renders = [];
  const renderer = Object.freeze({
    mount() {},
    render(state, context) {
      renders.push({ state, context });
      const action = script[call++] ?? 'resolve';
      if (action instanceof Error) return Promise.reject(action);
      if (typeof action === 'function') return action({ state, context });
      return Promise.resolve();
    },
    dispose() {}
  });
  return { renderer, renders };
}

async function flush() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

test('destination renderer failure records recover context, restores the committed anchor, and clears the fault', async () => {
  const scripted = scriptedRenderer([
    'resolve',
    new Error('destination failed'),
    'resolve',
    'resolve'
  ]);
  const instance = createCiMInstance({
    instanceId: 'recover-success',
    experience: experienceFixture(),
    clock: schedulerFixture(),
    renderer: scripted.renderer,
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();

  await assert.rejects(
    instance.next(COMMAND_SOURCE.TRANSPORT),
    /destination failed/
  );

  let snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'idle');
  assert.equal(snapshot.canonical.error, null);
  assert.equal(snapshot.operational.transitionId, null);
  assert.equal(snapshot.operational.transitionPhase, 'idle');

  assert.equal(scripted.renders.length, 3);
  const restoration = scripted.renders[2];
  assert.equal(restoration.context.animate, false);
  assert.equal(restoration.context.fromState, null);
  assert.equal(restoration.context.fromStepId, null);
  assert.equal(restoration.context.stepId, 'initial');

  const rendererError = events.find((event) => event.event === EVENT_NAME.RENDERER_ERROR);
  const recoveryStarted = events.find((event) => event.event === EVENT_NAME.RECOVERY_STARTED);
  const recoverySucceeded = events.find((event) => event.event === EVENT_NAME.RECOVERY_SUCCEEDED);
  assert.equal(rendererError.error_code, 'CIM-RND-004');
  assert.equal(recoveryStarted.error_code, 'CIM-RND-004');
  assert.equal(recoverySucceeded.error_code, 'CIM-RND-004');
  assert.equal(recoverySucceeded.recovered, true);
  assert.ok(rendererError.sequence < recoveryStarted.sequence);
  assert.ok(recoveryStarted.sequence < recoverySucceeded.sequence);
  assert.equal(events.some((event) => event.event === EVENT_NAME.STEP_CHANGED), false);

  const retry = await instance.next(COMMAND_SOURCE.TRANSPORT);
  assert.equal(retry.result, 'success');
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-01');
});

test('commands are rejected while recoverable restoration is active and Core exposes a null target recovery anchor', async () => {
  let resolveRecovery;
  const scripted = scriptedRenderer([
    'resolve',
    new Error('destination failed'),
    () => new Promise((resolve) => { resolveRecovery = resolve; })
  ]);
  const instance = createCiMInstance({
    instanceId: 'recover-active',
    experience: experienceFixture(),
    clock: schedulerFixture(),
    renderer: scripted.renderer,
    rendererRoot: {}
  });
  await instance.initialize();

  const failedCommand = instance.next(COMMAND_SOURCE.TRANSPORT);
  await flush();

  const duringRecovery = instance.read.snapshot();
  assert.equal(duringRecovery.canonical.currentStepId, 'initial');
  assert.equal(duringRecovery.canonical.targetStepId, null);
  assert.deepEqual(duringRecovery.canonical.error, {
    code: 'CIM-RND-004',
    component: 'renderer',
    recoveryClass: 'recover'
  });
  assert.equal(duringRecovery.canonical.status, 'transitioning');

  const blocked = await instance.next(COMMAND_SOURCE.TRANSPORT);
  assert.equal(blocked.result, 'rejected');
  assert.equal(blocked.reason, 'invalid_state');

  resolveRecovery();
  await assert.rejects(failedCommand, /destination failed/);
  assert.equal(instance.read.snapshot().canonical.error, null);
});

test('failed restoration escalates recover to fallback only after operational state is cleared', async () => {
  const scripted = scriptedRenderer([
    'resolve',
    new Error('destination failed'),
    new Error('restoration failed')
  ]);
  const instance = createCiMInstance({
    instanceId: 'recover-fallback',
    experience: experienceFixture(),
    clock: schedulerFixture(),
    renderer: scripted.renderer,
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();

  await assert.rejects(
    instance.next(COMMAND_SOURCE.TRANSPORT),
    /destination failed/
  );

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'faulted');
  assert.deepEqual(snapshot.canonical.error, {
    code: 'CIM-RND-006',
    component: 'renderer',
    recoveryClass: 'fallback'
  });
  assert.equal(snapshot.operational.playbackIntent, false);
  assert.equal(snapshot.operational.transitionId, null);
  assert.equal(snapshot.operational.transitionPhase, 'idle');
  assert.equal(snapshot.operational.dwellRemainingMs, 0);
  assert.equal(snapshot.operational.activeAbortState, null);

  const recoveryFailed = events.find((event) => event.event === EVENT_NAME.RECOVERY_FAILED);
  const faulted = events.find((event) => event.event === EVENT_NAME.INSTANCE_FAULTED);
  assert.equal(recoveryFailed.error_code, 'CIM-RND-006');
  assert.equal(faulted.error_code, 'CIM-RND-006');
  assert.equal(faulted.recovered, false);
  assert.ok(recoveryFailed.sequence < faulted.sequence);

  const rejected = await instance.next(COMMAND_SOURCE.TRANSPORT);
  assert.equal(rejected.result, 'rejected');
  assert.equal(rejected.reason, 'faulted');
});
