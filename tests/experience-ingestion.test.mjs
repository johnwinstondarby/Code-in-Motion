import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ExperienceValidationError,
  ingestExperience
} from '../src/experience/ingest-experience.mjs';

function validExperience() {
  return {
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'synthetic-test',
    renderer: 'synthetic/v1',
    renderer_config: { mode: 'test' },
    initial_state: { value: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'Step 1',
        commentary: { text: 'Instructional text.', links: [] },
        state: { value: 'B' }
      }
    ]
  };
}

test('ingestExperience validates, rebuilds, and deep-freezes runtime data', () => {
  const source = validExperience();
  const ingested = ingestExperience(source);

  assert.notEqual(ingested, source);
  assert.notEqual(ingested.initial_state, source.initial_state);
  assert.notEqual(ingested.steps, source.steps);
  assert.notEqual(ingested.steps[0], source.steps[0]);

  assert.equal(Object.isFrozen(ingested), true);
  assert.equal(Object.isFrozen(ingested.renderer_config), true);
  assert.equal(Object.isFrozen(ingested.initial_state), true);
  assert.equal(Object.isFrozen(ingested.steps), true);
  assert.equal(Object.isFrozen(ingested.steps[0]), true);
  assert.equal(Object.isFrozen(ingested.steps[0].commentary), true);
  assert.equal(Object.isFrozen(ingested.steps[0].commentary.links), true);

  source.initial_state.value = 'mutated';
  source.steps[0].state.value = 'mutated';
  assert.equal(ingested.initial_state.value, 'A');
  assert.equal(ingested.steps[0].state.value, 'B');
});

test('ingestExperience rejects invalid raw data before runtime consumption', () => {
  const source = validExperience();
  source.schema = 'localis.cim/v2';

  assert.throws(
    () => ingestExperience(source),
    (error) => {
      assert.equal(error instanceof ExperienceValidationError, true);
      assert.equal(error.code, 'CIM-EXP-001');
      assert.equal(Object.isFrozen(error.errors), true);
      assert.equal(Object.isFrozen(error.errors[0]), true);
      return true;
    }
  );
});

test('ingestExperience preserves opaque non-null renderer-owned state', () => {
  const source = validExperience();
  source.initial_state = ['A', 1, false];
  source.steps[0].state = 'B';

  const ingested = ingestExperience(source);
  assert.deepEqual(ingested.initial_state, ['A', 1, false]);
  assert.equal(ingested.steps[0].state, 'B');
});
