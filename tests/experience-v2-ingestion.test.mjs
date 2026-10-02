import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ingestExperience } from '../src/experience/ingest-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (name) => JSON.parse(readFileSync(resolve(ROOT, 'schemas', 'fixtures', 'valid', name), 'utf8'));

function assertDeepFrozen(value, path = '$') {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], `${path}.${key}`);
}

test('R42 ingestExperience accepts localis.cim/v2 and preserves presentation, beat, and commentary semantics exactly', () => {
  const source = fixture('compiled-console-v2.json');
  const ingested = ingestExperience(source);
  assert.notEqual(ingested, source, 'ingestion must rebuild rather than forward the source graph');
  assert.deepEqual(JSON.parse(JSON.stringify(ingested)), source);
  assert.equal(ingested.schema, 'localis.cim/v2');
  assert.deepEqual(ingested.presentation, source.presentation);
  assert.deepEqual(ingested.steps.map((step) => step.beat), source.steps.map((step) => step.beat));
  assert.deepEqual(ingested.steps[2].commentary.evidence, ['hunk-removed', 'hunk-added']);
  assert.deepEqual(ingested.steps[4].commentary.risk, source.steps[4].commentary.risk);
});

test('R42 ingestExperience deep-freezes every v2 addition, including nested beat, evidence, and risk data', () => {
  const ingested = ingestExperience(fixture('compiled-console-v2.json'));
  assertDeepFrozen(ingested);
  assert.throws(() => { 'use strict'; ingested.presentation.beat_count = 99; }, TypeError);
  assert.throws(() => { 'use strict'; ingested.steps[1].beat.final = true; }, TypeError);
  assert.throws(() => { 'use strict'; ingested.steps[2].commentary.evidence.push('extra'); }, TypeError);
  assert.throws(() => { 'use strict'; ingested.steps[4].commentary.risk.level = 'cannot-be-undone'; }, TypeError);
});

test('R42 ingestExperience does not interpret v2 presentation, beat, state, or renderer_config', () => {
  const source = fixture('compiled-console-v2.json');
  // Values Runtime would treat as meaningful if ingestion interpreted them are passed through unchanged.
  source.renderer_config = { opaque: { anything: [1, 'two', { three: null }] } };
  source.steps[0].state = { arbitrary: 'renderer-owned', nested: { list: [true, false] } };
  const ingested = ingestExperience(source);
  assert.deepEqual(JSON.parse(JSON.stringify(ingested.renderer_config)), source.renderer_config);
  assert.deepEqual(JSON.parse(JSON.stringify(ingested.steps[0].state)), source.steps[0].state);
  assert.deepEqual(Object.keys(ingested), Object.keys(source));
});

test('R42 v1 ingestion is unchanged and still rejects v2-only fields', () => {
  const v1 = fixture('synthetic-basic.json');
  assert.equal(ingestExperience(v1).schema, 'localis.cim/v1');
  const withEvidence = fixture('synthetic-basic.json');
  withEvidence.steps[0].commentary.evidence = ['value'];
  assert.throws(() => ingestExperience(withEvidence), (error) => error.code === 'CIM-EXP-002');
});
