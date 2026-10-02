// R42 compiler Gate 1: authoring v1 -> compiler -> localis.cim/v2 -> production runtime validator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileAuthoringSource, COMPILATION_CONSTANTS, RENDERER_BY_LAYOUT } from '../authoring/v1/compile-authoring.mjs';
import { validateExperience } from '../src/experience/validate-experience.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { REGISTRABLE_RUNTIME_SCHEMAS } from '../tools/check-wordpress-experience-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = resolve(ROOT, 'experiences/git/git-repository-practice.authoring.json');
const sourceText = readFileSync(SOURCE_PATH, 'utf8');
const source = JSON.parse(sourceText);
const compiled = compileAuthoringSource(sourceText);
const doc = compiled.document;

const EXPECTED_IDS = [
  'check-status--s01', 'check-status--s02',
  'stage-hunk--s01', 'stage-hunk--s02', 'stage-hunk--s03', 'stage-hunk--s04',
  'review-staged--s01', 'review-staged--s02', 'commit--s01', 'commit--s02', 'push--s01', 'push--s02',
  'discard-commit--s01', 'discard-commit--s02', 'find-in-reflog--s01', 'find-in-reflog--s02',
  'recover-from-reflog--s01', 'recover-from-reflog--s02'
];

test('Gate 1: the eight-beat Git specimen compiles to exactly 18 boundaries with the expected generated ids', () => {
  assert.equal(doc.schema, 'localis.cim/v2');
  assert.equal(doc.steps.length, 18);
  assert.deepEqual(doc.steps.map((s) => s.id), EXPECTED_IDS);
  assert.equal(compiled.provenance.boundaries, 18);
});

test('Gate 1: compiled output passes the production runtime validator with zero errors and ingests', () => {
  assert.deepEqual(validateExperience(doc), []);
  assert.equal(ingestExperience(doc).steps.length, 18);
});

test('Gate 1: the committed compiled specimen is byte-identical to a fresh compilation', () => {
  assert.equal(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8'), compiled.text);
  assert.equal(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.provenance.json'), 'utf8'), compiled.provenanceText);
});

test('Gate 1: the compiled specimen remains closed to WordPress production registration (R42 gate)', () => {
  assert.ok(!REGISTRABLE_RUNTIME_SCHEMAS.includes(doc.schema));
});

test('A2R §4/§6: one boundary per segment, contiguous grouping, heading as label, exactly one final per beat', () => {
  source.beats.forEach((beat, bi) => {
    const steps = doc.steps.filter((s) => s.beat.id === beat.id);
    assert.equal(steps.length, beat.explanation.segments.length, beat.id);
    steps.forEach((step, si) => {
      assert.equal(step.label, beat.explanation.heading);
      assert.deepEqual(step.beat, { id: beat.id, ordinal: bi + 1, heading: beat.explanation.heading,
        segment_ordinal: si + 1, segment_count: steps.length, final: si === steps.length - 1 });
    });
  });
  assert.equal(doc.presentation.beat_count, source.beats.length);
});

test('A2R §8/§10/§12: experience metadata, renderer mapping, versions, and initial state', () => {
  assert.equal(doc.renderer, RENDERER_BY_LAYOUT['console-explanation']);
  assert.equal(doc.engine_min, COMPILATION_CONSTANTS.engineMin);
  assert.equal(doc.experience_version, source.version);
  assert.equal(doc.id, source.id);
  assert.deepEqual(doc.renderer_config, { title: source.console.title, prompt: source.console.prompt });
  assert.deepEqual(doc.presentation, { title: source.title, description: source.description, subject: source.subject,
    beat_count: 8, default_playback_rate: source.presentation.defaultPlaybackRate });
  assert.deepEqual(doc.initial_state, { transcript: [], focus: [] });
});

test('A2R §11: non-final boundaries dwell 900 ms; final boundaries carry the authored beat dwell', () => {
  for (const step of doc.steps) {
    const beat = source.beats.find((b) => b.id === step.beat.id);
    assert.equal(step.dwell_ms, step.beat.final ? beat.dwell : COMPILATION_CONSTANTS.intraBeatDwellMs, step.id);
  }
});

test('A2R §9: commentary text, anchor, and evidence per segment; risk and ref-NN links only on final boundaries', () => {
  for (const step of doc.steps) {
    const beat = source.beats.find((b) => b.id === step.beat.id);
    const segment = beat.explanation.segments[step.beat.segment_ordinal - 1];
    assert.equal(step.commentary.text, segment.text);
    assert.equal(step.commentary.anchor, segment.at);
    assert.deepEqual(step.commentary.evidence, segment.focus);
    if (step.beat.final) {
      assert.deepEqual(step.commentary.risk, beat.risk);
      assert.deepEqual(step.commentary.links, (beat.explanation.references ?? []).map((r, i) =>
        ({ id: `ref-${String(i + 1).padStart(2, '0')}`, label: r.label, href: r.url })));
    } else {
      assert.equal(step.commentary.risk, undefined);
      assert.deepEqual(step.commentary.links, []);
    }
  }
});

test('A2R §3/§5/§8: absolute Console state accumulates completed beats plus the current beat through its anchor', () => {
  const stage = (n) => doc.steps.find((s) => s.id === `stage-hunk--s0${n}`).state.transcript.at(-1);
  assert.equal(stage(1).output, undefined);                       // command anchor: typed, no output yet
  assert.equal(stage(2).awaiting_response, true);                 // output anchor on a response beat
  assert.equal(stage(2).response, undefined);
  assert.equal(stage(4).response, 'y');                           // final boundary is complete
  assert.equal(stage(4).awaiting_response, undefined);
  doc.steps.forEach((step) => assert.equal(step.state.transcript.length, step.beat.ordinal, step.id));
  const recover = doc.steps.at(-1).state.transcript.at(-1);
  assert.equal(recover.command, 'git reset --hard 7a3c91d');
  assert.equal(recover.copy, 'git reset --hard <sha-from-your-reflog>');
  assert.equal(recover.risk, 'cannot-be-undone');
  const status = doc.steps.at(-1).state.transcript[0];
  assert.equal(status.copy, status.command);                      // copy resolves to the command when absent
});
