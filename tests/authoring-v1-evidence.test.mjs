// R42 compiler Gate 3: bidirectional evidence correspondence at every generated boundary.
// Enforced here, in the compiler suite; the runtime validator keeps renderer state opaque.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileAuthoringSource } from '../authoring/v1/compile-authoring.mjs';
import { evidenceCorrespondenceViolations } from '../authoring/v1/evidence-conformance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceText = readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.authoring.json'), 'utf8');
const doc = compileAuthoringSource(sourceText).document;
const authoredSegments = JSON.parse(sourceText).beats.flatMap((beat) => beat.explanation.segments);
const outputIds = (state) => new Set(state.transcript.flatMap((entry) => (entry.output ?? []).flatMap((line) => (line.id ? [line.id] : []))));

test('Gate 3: at all 18 boundaries, state.focus deep-equals commentary.evidence as an ordered list', () => {
  assert.equal(doc.steps.length, 18);
  for (const step of doc.steps) assert.deepEqual(step.state.focus, step.commentary.evidence ?? [], step.id);
});

test('Gate 3: boundaries without commentary evidence carry empty state focus', () => {
  const without = doc.steps.filter((s) => s.commentary.evidence === undefined);
  assert.equal(without.length, authoredSegments.filter((seg) => seg.focus === undefined).length);
  assert.equal(without.length, 9, 'eight command-anchored segments plus the stage-hunk response segment');
  for (const step of without) assert.deepEqual(step.state.focus, [], step.id);
});

test('Gate 3: every focus id names a real output line in that same boundary transcript', () => {
  let checked = 0;
  for (const step of doc.steps) {
    const ids = outputIds(step.state);
    for (const id of step.state.focus) { assert.ok(ids.has(id), `${step.id}: ${id}`); checked += 1; }
  }
  assert.equal(checked, authoredSegments.reduce((n, seg) => n + (seg.focus?.length ?? 0), 0));
  assert.equal(checked, 11, 'total focus references across the specimen');
});

test('Gate 3: the shared checker reports zero violations for the compiled specimen', () => {
  assert.deepEqual(evidenceCorrespondenceViolations(doc), []);
});

test('Gate 3: the checker is bidirectional and order-sensitive (mutation probes)', () => {
  const probe = (mutate) => { const d = structuredClone(doc); mutate(d); return evidenceCorrespondenceViolations(d).map((v) => v.rule); };
  const s = (id) => (d) => d.steps.find((x) => x.id === id);
  // evidence present in commentary but missing from focus
  assert.deepEqual(probe((d) => { s('stage-hunk--s02')(d).state.focus.pop(); }), ['ordered-equality']);
  // focus present but not attributable to commentary evidence
  assert.deepEqual(probe((d) => { s('stage-hunk--s02')(d).state.focus.push('hunk-prompt'); }), ['ordered-equality']);
  // same ids, different order
  assert.deepEqual(probe((d) => { s('stage-hunk--s02')(d).state.focus.reverse(); }), ['ordered-equality']);
  // stray focus on a boundary without evidence
  assert.deepEqual(probe((d) => { s('stage-hunk--s01')(d).state.focus.push('hunk-added'); }), ['empty-without-evidence', 'focus-names-visible-line']);
  // focus and evidence agree, but name a line that is not visible at that boundary
  assert.deepEqual(probe((d) => { const x = s('check-status--s02')(d); x.state.focus = ['ghost']; x.commentary.evidence = ['ghost']; }), ['focus-names-visible-line']);
});
