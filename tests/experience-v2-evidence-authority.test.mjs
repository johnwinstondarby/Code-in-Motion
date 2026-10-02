import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateExperience } from '../src/experience/validate-experience.mjs';

// R42 authority boundary (EXPERIENCE-SCHEMA-v2 §9): runtime validation checks the shape of
// commentary.evidence but never inspects opaque step state to resolve evidence identifiers.
// Correspondence between evidence and renderer state is a compiler-conformance obligation.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiled = () => JSON.parse(readFileSync(resolve(ROOT, 'schemas', 'fixtures', 'valid', 'compiled-console-v2.json'), 'utf8'));
const signature = (errors) => errors.map((error) => `${error.code} ${error.path}`).sort();

function untouchable(label) {
  const touched = (trap) => { throw new Error(`validator inspected opaque ${label} via ${trap}`); };
  return new Proxy({}, {
    get: () => touched('get'), has: () => touched('has'), ownKeys: () => touched('ownKeys'),
    getOwnPropertyDescriptor: () => touched('getOwnPropertyDescriptor'), getPrototypeOf: () => touched('getPrototypeOf'),
    set: () => touched('set'), defineProperty: () => touched('defineProperty'), deleteProperty: () => touched('deleteProperty')
  });
}

test('R42 evidence validation never reads opaque step or initial state', () => {
  const experience = compiled();
  experience.initial_state = untouchable('initial_state');
  experience.steps.forEach((step, index) => { step.state = untouchable(`steps[${index}].state`); });
  let errors;
  assert.doesNotThrow(() => { errors = validateExperience(experience); });
  assert.deepEqual(errors, []);
});

test('R42 evidence identifiers absent from state still validate; state contents never change the result', () => {
  const unrelated = compiled();
  unrelated.steps.forEach((step) => { step.state = { value: 'no evidence identifiers here' }; });
  const matching = compiled();
  matching.steps.forEach((step) => { step.state = { focus: step.commentary.evidence ?? [] }; });
  const contradicting = compiled();
  contradicting.steps.forEach((step) => { step.state = { focus: ['some-other-id'] }; });
  assert.deepEqual(validateExperience(unrelated), []);
  assert.deepEqual(signature(validateExperience(matching)), signature(validateExperience(unrelated)));
  assert.deepEqual(signature(validateExperience(contradicting)), signature(validateExperience(unrelated)));
});

test('R42 malformed evidence fails on shape alone, independent of state', () => {
  const experience = compiled();
  experience.steps[2].commentary.evidence = ['Hunk_Removed'];
  experience.steps.forEach((step, index) => { step.state = untouchable(`steps[${index}].state`); });
  const codes = [...new Set(validateExperience(experience).map((error) => error.code))];
  assert.deepEqual(codes, ['CIM-EXP-013']);
});
