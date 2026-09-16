import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE, EVENT_NAME, EVENT_RESULT } from '../src/contracts/events.mjs';
import { COMMAND_RESULT, INITIAL_BOUNDARY_ID, NAVIGATION_REASON } from '../src/contracts/session.mjs';
import { createBoundaryModel } from '../src/core/boundary-model.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experience() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'same-boundary-navigation-consistency',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
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

function clock() {
  let handle = 0;
  return Object.freeze({
    now: () => 0,
    schedule: () => ++handle,
    cancel: () => true,
    onFrame: () => ++handle
  });
}

function makeRuntime() {
  const renders = [];
  const events = [];
  const renderer = Object.freeze({
    mount() {},
    render(state, context) {
      renders.push({ state, context });
      return Promise.resolve();
    },
    dispose() {}
  });
  const instance = createCiMInstance({
    instanceId: 'same-boundary-navigation-instance',
    experience: experience(),
    clock: clock(),
    renderer,
    rendererRoot: {}
  });
  instance.events.subscribe((event) => events.push(event));
  return { instance, renders, events };
}

function assertQuietNoChange({ outcome, renders, renderCount, events, source }) {
  assert.equal(outcome.result, COMMAND_RESULT.NO_CHANGE);
  assert.equal(outcome.reason, NAVIGATION_REASON.ALREADY_AT_BOUNDARY);
  assert.equal(outcome.transitionId, null);
  assert.equal(renders.length, renderCount);
  const commandEvents = events.filter((event) => event.command_id === outcome.commandId);
  assert.deepEqual(commandEvents.map((event) => event.event), [EVENT_NAME.COMMAND_ACCEPTED]);
  assert.equal(commandEvents[0].result, EVENT_RESULT.NO_CHANGE);
  assert.equal(commandEvents[0].details.source, source);
  assert.equal(commandEvents[0].details.reason, NAVIGATION_REASON.ALREADY_AT_BOUNDARY);
}

test('Core resolves same-boundary home and end through the shared already_at_boundary reason', () => {
  const boundaries = createBoundaryModel(['step-01', 'step-02']);

  assert.deepEqual(
    boundaries.resolve(INITIAL_BOUNDARY_ID, null, { command: 'home' }),
    {
      command: 'home',
      result: COMMAND_RESULT.NO_CHANGE,
      fromStepId: INITIAL_BOUNDARY_ID,
      toStepId: INITIAL_BOUNDARY_ID,
      reason: NAVIGATION_REASON.ALREADY_AT_BOUNDARY
    }
  );

  assert.deepEqual(
    boundaries.resolve('step-02', null, { command: 'end' }),
    {
      command: 'end',
      result: COMMAND_RESULT.NO_CHANGE,
      fromStepId: 'step-02',
      toStepId: 'step-02',
      reason: NAVIGATION_REASON.ALREADY_AT_BOUNDARY
    }
  );
});

test('Home at initial is accepted quietly before renderer work', async () => {
  const runtime = makeRuntime();
  await runtime.instance.initialize();
  const renderCount = runtime.renders.length;

  const outcome = await runtime.instance.home(COMMAND_SOURCE.TRANSPORT);

  assertQuietNoChange({
    outcome,
    renders: runtime.renders,
    renderCount,
    events: runtime.events,
    source: COMMAND_SOURCE.TRANSPORT
  });
});

test('End at final is accepted quietly before renderer work', async () => {
  const runtime = makeRuntime();
  await runtime.instance.initialize();
  await runtime.instance.end(COMMAND_SOURCE.TRANSPORT);
  const renderCount = runtime.renders.length;

  const outcome = await runtime.instance.end(COMMAND_SOURCE.TRANSPORT);

  assertQuietNoChange({
    outcome,
    renders: runtime.renders,
    renderCount,
    events: runtime.events,
    source: COMMAND_SOURCE.TRANSPORT
  });
});

test('Marker activation on the current authored step uses the same quiet seek path', async () => {
  const runtime = makeRuntime();
  await runtime.instance.initialize();
  await runtime.instance.seek('step-01', COMMAND_SOURCE.MARKER);
  const renderCount = runtime.renders.length;

  const outcome = await runtime.instance.seek('step-01', COMMAND_SOURCE.MARKER);

  assertQuietNoChange({
    outcome,
    renders: runtime.renders,
    renderCount,
    events: runtime.events,
    source: COMMAND_SOURCE.MARKER
  });
});

test('Restart remains semantically distinct because it may reset frontier state at initial', () => {
  const boundaries = createBoundaryModel(['step-01', 'step-02']);
  assert.deepEqual(
    boundaries.resolve(INITIAL_BOUNDARY_ID, null, { command: 'restart' }),
    {
      command: 'restart',
      result: COMMAND_RESULT.SUCCESS,
      fromStepId: INITIAL_BOUNDARY_ID,
      toStepId: INITIAL_BOUNDARY_ID,
      reason: null
    }
  );
});
