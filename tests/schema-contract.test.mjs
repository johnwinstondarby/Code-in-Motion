import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateAgainstPublishedSchema,
  validateExperience
} from '../tools/check-schema-fixtures.mjs';

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
  return [...new Set(errors.map((error) => error.code))];
}

function expectSchemaFailure(experience) {
  assert.ok(validateAgainstPublishedSchema(experience).length > 0);
}

test('valid experience passes published schema and semantic checks', () => {
  assert.deepEqual(validateAgainstPublishedSchema(validExperience()), []);
  assert.deepEqual(validateExperience(validExperience()), []);
});

test('published schema requires at least one step', () => {
  const experience = validExperience();
  experience.steps = [];
  expectSchemaFailure(experience);
});

test('published schema constrains renderer identifiers', () => {
  const experience = validExperience();
  experience.renderer = 'anything goes';
  expectSchemaFailure(experience);
});

test('published schema requires commentary links array', () => {
  const experience = validExperience();
  delete experience.steps[0].commentary.links;
  expectSchemaFailure(experience);
});

test('published schema independently rejects executable link schemes', () => {
  const experience = validExperience();
  experience.steps[0].commentary.links = [
    { id: 'unsafe', label: 'Unsafe', href: 'javascript:alert(1)' }
  ];
  expectSchemaFailure(experience);
});

test('opaque non-null state is not interpreted by shared validation', () => {
  const experience = validExperience();
  experience.initial_state = ['renderer', 'owned', 1];
  experience.steps[0].state = false;
  assert.deepEqual(validateExperience(experience), []);
});

test('null initial and step states are rejected', () => {
  const initial = validExperience();
  initial.initial_state = null;
  assert.ok(codes(validateExperience(initial)).includes('CIM-EXP-002'));

  const step = validExperience();
  step.steps[0].state = null;
  assert.ok(codes(validateExperience(step)).includes('CIM-EXP-002'));
});

test('reserved initial step id is rejected with CIM-EXP-004', () => {
  const experience = validExperience();
  experience.steps[0].id = 'initial';
  assert.deepEqual(codes(validateExperience(experience)), ['CIM-EXP-004']);
});

test('duplicate step ids are rejected with CIM-EXP-003', () => {
  const experience = validExperience();
  experience.steps.push({ ...experience.steps[0] });
  assert.deepEqual(codes(validateExperience(experience)), ['CIM-EXP-003']);
});

test('negative dwell is rejected with CIM-EXP-005', () => {
  const experience = validExperience();
  experience.steps[0].dwell_ms = -1;
  assert.deepEqual(codes(validateExperience(experience)), ['CIM-EXP-005']);
});

test('supported link forms pass the allowlist', () => {
  const experience = validExperience();
  experience.steps[0].commentary.links = [
    { id: 'http', label: 'HTTP', href: 'http://example.com' },
    { id: 'https', label: 'HTTPS', href: 'https://example.com' },
    { id: 'mail', label: 'Mail', href: 'mailto:docs@example.com' },
    { id: 'root', label: 'Root', href: '/reference' },
    { id: 'fragment', label: 'Fragment', href: '#section' }
  ];
  assert.deepEqual(validateExperience(experience), []);
});

test('obfuscated and non-allowlisted links are rejected with CIM-EXP-006', () => {
  for (const href of [
    'java\tscript:alert(1)',
    '\u0001javascript:alert(1)',
    'blob:https://evil.example/x',
    'not a url at all'
  ]) {
    const experience = validExperience();
    experience.steps[0].commentary.links = [
      { id: 'unsafe', label: 'Unsafe', href }
    ];
    assert.deepEqual(codes(validateExperience(experience)), ['CIM-EXP-006']);
  }
});
