// R42 compiler failure semantics (A2R §14): fail closed, no partial output, CIM-COMP-* diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AuthoringCompilationError, assertGeneratedIdentifiers, compileAuthoringSource, DIAGNOSTICS } from '../authoring/v1/compile-authoring.mjs';
import { DIAGNOSTICS as AUTHORING_DIAGNOSTICS } from '../authoring/v1/validate-authoring.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specimen = () => JSON.parse(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.authoring.json'), 'utf8'));
const seen = new Set();

function expectFailure(run, code) {
  let caught;
  assert.throws(run, (error) => { caught = error; return error instanceof AuthoringCompilationError; });
  assert.equal(caught.code, code);
  caught.diagnostics.forEach((d) => seen.add(d.code));
  return caught;
}

test('fails on an unsupported authoring schema before validation', () => {
  const d = specimen(); d.schema = 'localis.cim/authoring/v2';
  expectFailure(() => compileAuthoringSource(JSON.stringify(d)), 'CIM-COMP-UNSUPPORTED-SCHEMA');
});

test('fails on an unsupported runtime target', () => {
  expectFailure(() => compileAuthoringSource(JSON.stringify(specimen()), { target: 'localis.cim/v1' }), 'CIM-COMP-TARGET-UNSUPPORTED');
});

test('fails on authoring validation errors and carries CIM-AUTH-* causes', () => {
  const d = specimen(); d.beats[0].id = 'initial';
  const error = expectFailure(() => compileAuthoringSource(JSON.stringify(d)), 'CIM-COMP-AUTHORING-INVALID');
  assert.ok(error.diagnostics[0].causes.some((c) => c.id === 'CIM-AUTH-RESERVED-ID'));
  for (const cause of error.diagnostics[0].causes) assert.ok(cause.id in AUTHORING_DIAGNOSTICS);
});

test('fails on duplicate keys rather than compiling a silently truncated document', () => {
  const text = readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.authoring.json'), 'utf8')
    .replace('"command": "git status",', '"command": "git reset --hard HEAD~1",\n        "command": "git status",');
  const error = expectFailure(() => compileAuthoringSource(text), 'CIM-COMP-AUTHORING-INVALID');
  assert.ok(error.diagnostics[0].causes.some((c) => c.id === 'CIM-AUTH-DUPLICATE-KEY'));
});

test('fails on more than 99 segments in one beat', () => {
  const d = specimen();
  const segments = d.beats[2].explanation.segments;
  while (segments.length < 100) segments.splice(1, 0, { at: 'output', text: 'Repeated observation.' });
  expectFailure(() => compileAuthoringSource(JSON.stringify(d)), 'CIM-COMP-SEGMENT-LIMIT');
});

test('C1: the removed presentation preferences are unknown authoring fields, not compiler-accommodated content', () => {
  for (const [key, value] of [['explanationTitle', 'Explanation'], ['showCopy', true], ['showRisk', false]]) {
    const d = specimen(); d.presentation[key] = value;
    const error = expectFailure(() => compileAuthoringSource(JSON.stringify(d)), 'CIM-COMP-AUTHORING-INVALID');
    assert.ok(error.diagnostics[0].causes.some((c) => c.id === 'CIM-AUTH-UNKNOWN-FIELD' && c.path === `$.presentation.${key}`), key);
  }
});

test('fails when the layout has no renderer mapping and never substitutes a fallback renderer', () => {
  expectFailure(() => compileAuthoringSource(JSON.stringify(specimen()), { rendererMap: {} }), 'CIM-COMP-RENDERER-MAPPING');
});

test('fails when compiled output does not pass runtime validation', () => {
  const runtimeValidator = () => [{ code: 'CIM-EXP-002', path: '$', message: 'injected', source: 'schema' }];
  const error = expectFailure(() => compileAuthoringSource(JSON.stringify(specimen()), { runtimeValidator }), 'CIM-COMP-RUNTIME-INVALID');
  assert.equal(error.diagnostics[0].causes[0].code, 'CIM-EXP-002');
});

test('fails on generated-id collisions and reserved or non-generated identifiers', () => {
  expectFailure(() => assertGeneratedIdentifiers(['a--s01', 'a--s01']), 'CIM-COMP-ID-COLLISION');
  expectFailure(() => assertGeneratedIdentifiers(['initial']), 'CIM-COMP-ID-COLLISION');
  expectFailure(() => assertGeneratedIdentifiers(['plain-id']), 'CIM-COMP-ID-COLLISION');
  expectFailure(() => assertGeneratedIdentifiers(['a--s00']), 'CIM-COMP-ID-COLLISION');
});

test('every CIM-COMP-* diagnostic in the inventory is exercised by this suite', () => {
  assert.deepEqual([...seen].sort(), Object.keys(DIAGNOSTICS).sort());
});
