import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE, EVENT_NAME, EVENT_RESULT } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experience() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'same-boundary-seek',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [{
      id: 'step-01',
      label: 'One',
      commentary: { text: 'One', links: [] },
      state: { node: 'B' }
    }]
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

test('stable same-boundary scrub seek is quiet', async () => {
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
    instanceId: 'same-boundary-instance',
    experience: experience(),
    clock: clock(),
    renderer,
    rendererRoot: {}
  });
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();
  const renderCount = renders.length;

  const outcome = await instance.seek('initial', COMMAND_SOURCE.SCRUB);

  assert.equal(outcome.result, 'no_change');
  assert.equal(outcome.reason, 'already_at_boundary');
  assert.equal(outcome.transitionId, null);
  assert.equal(renders.length, renderCount);
  const commandEvents = events.filter((event) => event.command_id === outcome.commandId);
  assert.deepEqual(commandEvents.map((event) => event.event), [EVENT_NAME.COMMAND_ACCEPTED]);
  assert.equal(commandEvents[0].result, EVENT_RESULT.NO_CHANGE);
  assert.equal(commandEvents[0].details.source, COMMAND_SOURCE.SCRUB);
  assert.equal(commandEvents[0].details.reason, 'already_at_boundary');
});
