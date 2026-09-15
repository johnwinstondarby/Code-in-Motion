import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMAND_SOURCE,
  EVENT_COMPONENT,
  EVENT_NAME,
  EVENT_RESULT
} from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../src/renderers/interface.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'runtime-navigation',
    renderer: 'synthetic/v1',
    renderer_config: { prefix: '>' },
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' },
        renderer_config: { suffix: '1' }
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
    ]
  });
}

function virtualScheduler(start = 0) {
  let now = start;
  let nextHandle = 0;
  const scheduled = new Map();

  const scheduler = Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      scheduled.set(handle, { kind: 'delay', fn, at: now + ms });
      return handle;
    },
    cancel(handle) {
      return scheduled.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      scheduled.set(handle, { kind: 'frame', fn });
      return handle;
    }
  });

  return {
    scheduler,
    set(value) {
      now = value;
    }
  };
}

function recordingRenderer({ holdStepId = null } = {}) {
  const mounts = [];
  const renders = [];
  let held = null;

  const renderer = Object.freeze({
    mount(context) {
      mounts.push(context);
    },

    render(state, context) {
      renders.push({ state, context });
      if (context.stepId !== holdStepId || held !== null) return Promise.resolve();

      return new Promise((resolve, reject) => {
        let unsubscribe = () => false;
        unsubscribe = context.abortSignal.onAbort((reason) => {
          unsubscribe();
          reject(new RendererCancelledError(reason));
        });
        held = { resolve, reject, context };
      });
    },

    dispose() {}
  });

  return { renderer, mounts, renders, held: () => held };
}

async function makeInitialized(options = {}) {
  const time = virtualScheduler();
  const recording = recordingRenderer(options);
  const events = [];
  const instance = createCiMInstance({
    instanceId: 'instance-nav',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: recording.renderer,
    rendererRoot: {},
    reducedMotion: false
  });
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();
  return { instance, events, recording, time };
}

test('initialize mounts the renderer and settles initial absolutely before commands are accepted', async () => {
  const time = virtualScheduler();
  const recording = recordingRenderer();
  const instance = createCiMInstance({
    instanceId: 'instance-nav',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer: recording.renderer,
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  const before = await instance.next(COMMAND_SOURCE.TRANSPORT);
  assert.equal(before.result, 'rejected');
  assert.equal(before.reason, 'invalid_state');

  const initialized = await instance.initialize();
  assert.equal(initialized.canonical.currentStepId, 'initial');
  assert.equal(initialized.canonical.status, 'idle');
  assert.equal(initialized.operational.transitionId, null);

  assert.equal(recording.mounts.length, 1);
  assert.equal(Object.isFrozen(recording.mounts[0]), true);
  assert.equal(recording.mounts[0].instanceId, 'instance-nav');
  assert.equal(recording.renders.length, 1);

  const initial = recording.renders[0];
  assert.deepEqual(initial.state, { node: 'A' });
  assert.equal(initial.context.animate, false);
  assert.equal(initial.context.fromState, null);
  assert.equal(initial.context.fromStepId, null);
  assert.equal(initial.context.stepId, 'initial');
  assert.equal(initial.context.transitionId, 'txn-1');
  assert.deepEqual(initial.context.rendererConfig, { prefix: '>' });
  assert.equal(initial.context.stepRendererConfig, null);

  assert.deepEqual(
    events.map((event) => [event.event, event.result]),
    [
      [EVENT_NAME.COMMAND_REJECTED, EVENT_RESULT.REJECTED],
      [EVENT_NAME.RENDERER_MOUNTED, EVENT_RESULT.SUCCESS],
      [EVENT_NAME.RENDERER_SETTLED, EVENT_RESULT.SUCCESS],
      [EVENT_NAME.STEP_INITIAL, EVENT_RESULT.SUCCESS]
    ]
  );
});

test('next performs absolute settlement before Core commits and emits ordered evidence', async () => {
  const { instance, events, recording } = await makeInitialized();

  const result = await instance.next(COMMAND_SOURCE.TRANSPORT);

  assert.deepEqual(result, {
    commandId: 'cmd-1',
    command: 'next',
    result: 'success',
    fromStepId: 'initial',
    toStepId: 'step-01',
    reason: null,
    transitionId: 'txn-2'
  });
  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-01');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.revealFrontier, 'step-01');
  assert.equal(snapshot.canonical.status, 'idle');
  assert.equal(snapshot.operational.transitionId, null);

  const render = recording.renders[1];
  assert.deepEqual(render.state, { node: 'B' });
  assert.equal(render.context.animate, false);
  assert.equal(render.context.fromState, null);
  assert.equal(render.context.fromStepId, null);
  assert.equal(render.context.stepId, 'step-01');
  assert.equal(render.context.transitionId, 'txn-2');
  assert.deepEqual(render.context.stepRendererConfig, { suffix: '1' });

  const commandEvents = events.filter((event) => event.command_id === 'cmd-1');
  assert.deepEqual(
    commandEvents.map((event) => event.event),
    [
      EVENT_NAME.COMMAND_ACCEPTED,
      EVENT_NAME.TRANSITION_STARTED,
      EVENT_NAME.RENDERER_SETTLED,
      EVENT_NAME.TRANSITION_SETTLED,
      EVENT_NAME.STEP_CHANGED
    ]
  );
  assert.equal(commandEvents[4].component, EVENT_COMPONENT.CORE);
  assert.equal(commandEvents[4].from_step, 'initial');
  assert.equal(commandEvents[4].to_step, 'step-01');
});

test('equivalent subject state does not suppress semantic commit or step.changed', async () => {
  const { instance, events } = await makeInitialized();
  await instance.next(COMMAND_SOURCE.TRANSPORT);
  const second = await instance.next(COMMAND_SOURCE.TRANSPORT);

  assert.equal(second.toStepId, 'step-02');
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-02');

  const secondStepEvents = events.filter(
    (event) => event.command_id === second.commandId && event.event === EVENT_NAME.STEP_CHANGED
  );
  assert.equal(secondStepEvents.length, 1);
  assert.equal(secondStepEvents[0].from_step, 'step-01');
  assert.equal(secondStepEvents[0].to_step, 'step-02');
});

test('unknown seek rejects without renderer work or canonical mutation', async () => {
  const { instance, events, recording } = await makeInitialized();
  const renderCount = recording.renders.length;

  const result = await instance.seek('missing-step', COMMAND_SOURCE.COMMENTARY);

  assert.equal(result.result, 'rejected');
  assert.equal(result.reason, 'unknown_step');
  assert.equal(result.transitionId, null);
  assert.equal(recording.renders.length, renderCount);
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');

  const event = events.find((entry) => entry.command_id === result.commandId);
  assert.equal(event.event, EVENT_NAME.COMMAND_REJECTED);
  assert.equal(event.details.source, 'commentary');
  assert.equal(event.details.reason, 'unknown_step');
});

test('stable boundary exhaustion is accepted no_change and does not render', async () => {
  const { instance, events, recording } = await makeInitialized();

  const atStart = await instance.previous(COMMAND_SOURCE.TRANSPORT);
  assert.equal(atStart.result, 'no_change');
  assert.equal(atStart.reason, 'at_start');
  assert.equal(atStart.transitionId, null);
  assert.equal(recording.renders.length, 1);

  await instance.end(COMMAND_SOURCE.TRANSPORT);
  const renderCount = recording.renders.length;
  const atEnd = await instance.next(COMMAND_SOURCE.TRANSPORT);

  assert.equal(atEnd.result, 'no_change');
  assert.equal(atEnd.reason, 'at_end');
  assert.equal(atEnd.transitionId, null);
  assert.equal(recording.renders.length, renderCount);

  const accepted = events.filter(
    (event) => event.command_id === atEnd.commandId && event.event === EVENT_NAME.COMMAND_ACCEPTED
  );
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].result, EVENT_RESULT.NO_CHANGE);
});

test('home preserves reveal frontier while restart resets it after initial settles', async () => {
  const { instance } = await makeInitialized();

  await instance.end(COMMAND_SOURCE.TRANSPORT);
  assert.equal(instance.read.snapshot().canonical.revealFrontier, 'step-03');

  await instance.home(COMMAND_SOURCE.TRANSPORT);
  let snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.revealFrontier, 'step-03');

  await instance.restart(COMMAND_SOURCE.TRANSPORT);
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.revealFrontier, 'initial');
});

test('a newer navigation command supersedes pending work instead of queueing it', async () => {
  const { instance, events, recording } = await makeInitialized({ holdStepId: 'step-01' });

  const firstPromise = instance.next(COMMAND_SOURCE.TRANSPORT);

  // Let the first render enter its pending promise.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(recording.held()?.context.stepId, 'step-01');
  assert.equal(instance.read.snapshot().canonical.targetStepId, 'step-01');

  const secondPromise = instance.previous(COMMAND_SOURCE.TRANSPORT);
  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(first.result, 'cancelled');
  assert.equal(first.transitionId, 'txn-2');
  assert.equal(second.result, 'no_change');
  assert.equal(second.fromStepId, 'initial');
  assert.equal(second.toStepId, 'initial');
  assert.equal(second.transitionId, 'txn-3');

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'idle');

  const firstEvents = events.filter((event) => event.command_id === first.commandId);
  assert.equal(firstEvents.some((event) => event.event === EVENT_NAME.TRANSITION_CANCELLED), true);
  assert.equal(firstEvents.some((event) => event.event === EVENT_NAME.RENDERER_CANCELLED), true);
  assert.equal(firstEvents.some((event) => event.event === EVENT_NAME.STEP_CHANGED), false);

  const secondEvents = events.filter((event) => event.command_id === second.commandId);
  assert.deepEqual(
    secondEvents.map((event) => event.event),
    [
      EVENT_NAME.COMMAND_ACCEPTED,
      EVENT_NAME.TRANSITION_STARTED,
      EVENT_NAME.RENDERER_SETTLED,
      EVENT_NAME.TRANSITION_SETTLED
    ]
  );
});

test('renderer failure clears the pending target and leaves the last committed boundary canonical', async () => {
  const time = virtualScheduler();
  let renderCount = 0;
  const renderer = Object.freeze({
    mount() {},
    render() {
      renderCount += 1;
      if (renderCount === 2) return Promise.reject(new Error('synthetic failure'));
      return Promise.resolve();
    },
    dispose() {}
  });

  const events = [];
  const instance = createCiMInstance({
    instanceId: 'instance-nav',
    experience: experienceFixture(),
    clock: time.scheduler,
    renderer,
    rendererRoot: {}
  });
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();

  await assert.rejects(
    instance.next(COMMAND_SOURCE.TRANSPORT),
    /synthetic failure/
  );

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'idle');
  assert.equal(snapshot.canonical.error, null);
  assert.equal(renderCount, 3, 'failed destination is followed by one absolute restoration render');
  assert.equal(
    events.some((event) => event.event === EVENT_NAME.TRANSITION_FAILED),
    true
  );
  assert.equal(
    events.some((event) => event.event === EVENT_NAME.RECOVERY_STARTED),
    true
  );
  assert.equal(
    events.some((event) => event.event === EVENT_NAME.RECOVERY_SUCCEEDED),
    true
  );
  assert.equal(
    events.some((event) => event.event === EVENT_NAME.STEP_CHANGED),
    false
  );
});
