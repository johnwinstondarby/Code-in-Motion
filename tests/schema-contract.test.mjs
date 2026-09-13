import test from 'node:test';
import assert from 'node:assert/strict';

import { validateExperience } from '../tools/check-schema-fixtures.mjs';

function validExperience() {
  return {
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'synthetic-test',
    renderer: 'synthetic/v1',
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

function codes(errors) {
  return errors.map((error) => error.code);
}

test('valid experience passes shared contract validation', () => {
  assert.deepEqual(validateExperience(validExperience()), []);
});

test('opaque state is not interpreted by the shared contract checker', () => {
  const experience = validExperience();
  experience.initial_state = ['renderer', 'owned', 1];
  experience.steps[0].state = null;
  assert.deepEqual(validateExperience(experience), []);
});

test('reserved initial step id is rejected with CIM-EXP-004', () => {
  const experience = validExperience();
  experience.steps[0].id = 'initial';
  assert.ok(codes(validateExperience(experience)).includes('CIM-EXP-004'));
});

test('duplicate step ids are rejected with CIM-EXP-003', () => {
  const experience = validExperience();
  experience.steps.push({ ...experience.steps[0] });
  assert.ok(codes(validateExperience(experience)).includes('CIM-EXP-003'));
});

test('negative dwell is rejected with CIM-EXP-005', () => {
  const experience = validExperience();
  experience.steps[0].dwell_ms = -1;
  assert.ok(codes(validateExperience(experience)).includes('CIM-EXP-005'));
});

test('executable commentary link scheme is rejected with CIM-EXP-006', () => {
  const experience = validExperience();
  experience.steps[0].commentary.links = [
    { id: 'unsafe', label: 'Unsafe', href: 'JaVaScRiPt:alert(1)' }
  ];
  assert.ok(codes(validateExperience(experience)).includes('CIM-EXP-006'));
});
