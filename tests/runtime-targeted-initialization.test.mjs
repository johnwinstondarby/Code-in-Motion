import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMAND_SOURCE,
  EVENT_NAME
} from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../src/renderers/interface.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'runtime-targeted-entry',
    renderer: 'synthetic/v1',
    renderer_config: { prefix: '>' },
    initial_state: { node: 'A' },
    steps: [
      { id: 'step-01', label: 'One', commentary: { text: 'One', links: [] }, state: { node: 'B' }, renderer_config: { suffix: '1' } },
      { id: 'step-02', label: 'Observe', commentary: { text: 'Observe', links: [] }, state: { node: 'B' }, renderer_config: { suffix: 'obs' } },
      { id: 'step-03', label: 'Three', commentary: { text: 'Three', links: [] }, state: { node: 'C' }, renderer_config: { suffix: '3' }, dwell_ms: 75 },
      { id: 'step-04', label: 'Four', commentary: { text: 'Four', links: [] }, state: { node: 'D' } }
    ]
  });
}

function virtualScheduler() {
  let now = 0;
  let nextHandle = 0;
  const timers = new Map();
  const scheduler = Object.freeze({
    now: () => now,
    schedule(fn, ms) { const handle = ++nextHandle; timers.set(handle, { at: now + ms, fn }); return handle; },
    cancel(handle) { return timers.delete(handle); },
    onFrame(fn) { const handle = ++nextHandle; timers.set(handle, { at: Number.POSITIVE_INFINITY, fn }); return handle; }
  });
  return { scheduler };
}

function recordingRenderer({ failStepId = null, holdStepId = null } = {}) {
  const mounts = [];
  const renders = [];
  let disposeCount = 0;
  const renderer = Object.freeze({
    mount(context) { mounts.push(context); },
    render(state, context) {
      renders.push({ state, context });
      if (context.stepId === failStepId) return Promise.reject(new Error(`render failed: ${failStepId}`));
      if (context.stepId !== holdStepId) return Promise.resolve();
      return new Promise((_resolve, reject) => {
        context.abortSignal.onAbort((reason) => reject(new RendererCancelledError(reason)));
      });
    },
    dispose() { disposeCount += 1; }
  });
  return { renderer, mounts, renders, disposeCount: () => disposeCount };
}

function makeInstance({ instanceId = 'targeted-entry', experience = experienceFixture(), recording = recordingRenderer(), time = virtualScheduler() } = {}) {
  const events = [];
  const instance = createCiMInstance({ instanceId, experience, clock: time.scheduler, renderer: recording.renderer, rendererRoot: {}, reducedMotion: false });
  instance.events.subscribe((event) => events.push(event));
  return { instance, events, recording, time, experience };
}

async function flush() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test('default initialize enters initial once with host provenance', async () => {
  const { instance, events, recording } = makeInstance();
  const snapshot = await instance.initialize();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.revealFrontier, 'initial');
  assert.equal(recording.renders.length, 1);
  const entries = events.filter((event) => event.event === EVENT_NAME.STEP_INITIAL);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].step_id, 'initial');
  assert.equal(entries[0].details.source, 'host');
  assert.equal(events.some((event) => event.event === EVENT_NAME.STEP_CHANGED), false);
});

test('targeted initialize renders exactly the requested boundary and records deep-link entry provenance', async () => {
  const { instance, events, recording } = makeInstance();
  const snapshot = await instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK });
  assert.equal(recording.mounts.length, 1);
  assert.equal(recording.renders.length, 1);
  const [{ state, context }] = recording.renders;
  assert.deepEqual(state, { node: 'C' });
  assert.deepEqual(Object.keys(context).sort(), ['abortSignal','animate','clock','fromState','fromStepId','reducedMotion','rendererConfig','stepId','stepRendererConfig','transitionId']);
  assert.equal(context.stepId, 'step-03');
  assert.equal(context.animate, false);
  assert.equal(context.fromState, null);
  assert.equal(context.fromStepId, null);
  assert.deepEqual(context.rendererConfig, { prefix: '>' });
  assert.deepEqual(context.stepRendererConfig, { suffix: '3' });
  assert.equal(snapshot.canonical.currentStepId, 'step-03');
  assert.equal(snapshot.canonical.revealFrontier, 'step-03');
  assert.equal(snapshot.canonical.targetStepId, null);
  const entries = events.filter((event) => event.event === EVENT_NAME.STEP_INITIAL);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].step_id, 'step-03');
  assert.equal(entries[0].details.source, 'deep_link');
  assert.equal('command_id' in entries[0], false);
  assert.equal(events.some((event) => event.event === EVENT_NAME.STEP_CHANGED), false);
  assert.equal(events.some((event) => event.event === EVENT_NAME.DWELL_STARTED), false);
});

test('unknown targeted entry fails synchronously before renderer mount and leaves initialization retryable', async () => {
  const { instance, events, recording } = makeInstance();
  assert.throws(() => instance.initialize({ stepId: 'missing-step', source: COMMAND_SOURCE.DEEP_LINK }), /known semantic boundary/);
  assert.equal(recording.mounts.length, 0);
  assert.equal(recording.renders.length, 0);
  assert.equal(events.length, 0);
  const snapshot = await instance.initialize({ stepId: 'step-01', source: COMMAND_SOURCE.HOST });
  assert.equal(snapshot.canonical.currentStepId, 'step-01');
});

test('initialization provenance rejects non-entry command sources before renderer mount', () => {
  const { instance, events, recording } = makeInstance();
  assert.throws(() => instance.initialize({ stepId: 'step-01', source: COMMAND_SOURCE.TRANSPORT }), /initialization source/);
  assert.equal(recording.mounts.length, 0);
  assert.equal(recording.renders.length, 0);
  assert.equal(events.length, 0);
});

test('restart after targeted entry resets both semantic position and reveal frontier to initial', async () => {
  const { instance } = makeInstance();
  await instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK });
  await instance.restart(COMMAND_SOURCE.TRANSPORT);
  const after = instance.read.snapshot();
  assert.equal(after.canonical.currentStepId, 'initial');
  assert.equal(after.canonical.revealFrontier, 'initial');
});

test('play after targeted entry skips entry dwell and begins the following transition immediately', async () => {
  const { instance, events, recording } = makeInstance();
  await instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK });
  const result = await instance.play(COMMAND_SOURCE.TRANSPORT);
  assert.equal(result.toStepId, 'step-04');
  assert.equal(recording.renders[1].context.stepId, 'step-04');
  assert.equal(events.some((event) => event.event === EVENT_NAME.DWELL_STARTED && event.step_id === 'step-03'), false);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-04');
});

test('play from a final targeted entry is accepted at_end without dwell or renderer work', async () => {
  const { instance, events, recording } = makeInstance();
  await instance.initialize({ stepId: 'step-04', source: COMMAND_SOURCE.DEEP_LINK });
  const renderCount = recording.renders.length;
  const result = await instance.play(COMMAND_SOURCE.TRANSPORT);
  assert.equal(result.result, 'no_change');
  assert.equal(result.reason, 'at_end');
  assert.equal(recording.renders.length, renderCount);
  assert.equal(events.some((event) => event.event === EVENT_NAME.DWELL_STARTED), false);
});

test('targeted initialization renderer failure abandons the pending target and emits no entry event', async () => {
  const recording = recordingRenderer({ failStepId: 'step-03' });
  const { instance, events } = makeInstance({ recording });
  await assert.rejects(instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK }), /render failed: step-03/);
  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.revealFrontier, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.status, 'idle');
  assert.ok(events.some((event) => event.event === EVENT_NAME.RENDERER_ERROR));
  assert.equal(events.some((event) => event.event === EVENT_NAME.STEP_INITIAL), false);
});

test('disposal during targeted initialization closes the requested entry lifecycle', async () => {
  const recording = recordingRenderer({ holdStepId: 'step-03' });
  const { instance, events } = makeInstance({ recording });
  const initialization = instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK });
  await flush();
  const disposal = instance.dispose();
  await assert.rejects(initialization, /initialization cancelled by disposal/);
  await disposal;
  const cancelled = events.find((event) => event.event === EVENT_NAME.INITIALIZATION_CANCELLED);
  assert.equal(cancelled.step_id, 'step-03');
  assert.equal(cancelled.details.reason, 'dispose');
  assert.ok(events.some((event) => event.event === EVENT_NAME.RENDERER_CANCELLED));
});

test('reentrant disposal after renderer settlement prevents targeted entry commit', async () => {
  const { instance, events } = makeInstance();
  let disposal = null;
  instance.events.subscribe((event) => {
    if (event.event === EVENT_NAME.RENDERER_SETTLED && event.step_id === 'step-03' && disposal === null) disposal = instance.dispose();
  });
  await assert.rejects(instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK }), /initialization cancelled by disposal/);
  await disposal;
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');
  assert.equal(instance.read.snapshot().canonical.status, 'disposed');
  assert.equal(events.some((event) => event.event === EVENT_NAME.STEP_INITIAL), false);
});

test('instances sharing one frozen experience object keep targeted entry and later commands isolated', async () => {
  const sharedExperience = experienceFixture();
  const firstRecording = recordingRenderer();
  const secondRecording = recordingRenderer();
  const first = makeInstance({ instanceId: 'entry-a', experience: sharedExperience, recording: firstRecording });
  const second = makeInstance({ instanceId: 'entry-b', experience: sharedExperience, recording: secondRecording });
  await Promise.all([
    first.instance.initialize({ stepId: 'step-01', source: COMMAND_SOURCE.HOST }),
    second.instance.initialize({ stepId: 'step-03', source: COMMAND_SOURCE.DEEP_LINK })
  ]);
  assert.equal(first.instance.read.snapshot().canonical.currentStepId, 'step-01');
  assert.equal(second.instance.read.snapshot().canonical.currentStepId, 'step-03');
  assert.equal(first.events[0].sequence, 1);
  assert.equal(second.events[0].sequence, 1);
  await first.instance.next(COMMAND_SOURCE.TRANSPORT);
  assert.equal(first.instance.read.snapshot().canonical.currentStepId, 'step-02');
  assert.equal(second.instance.read.snapshot().canonical.currentStepId, 'step-03');
  assert.equal(secondRecording.renders.length, 1);
});
