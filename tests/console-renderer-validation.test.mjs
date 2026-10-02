// console/v1 renderer-owned validation (CONSOLE-RENDERER-v1 §6).
// Central proof: the renderer-side validator and the producer-side compiler checker are two
// enforcement points of one contract, so they must agree on every probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertConsoleRendererInput,
  ConsoleRendererInputError,
  CONSOLE_VALIDATION_RULES,
  consoleRendererInputViolations
} from '../src/renderers/subjects/console/validate-console-input.mjs';
import { consoleStateViolations } from '../authoring/v1/console-state-conformance.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specimen = () => JSON.parse(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8'));

// The renderer sees one state per render; a document is valid for the renderer when every
// state it can receive (initial plus each step) passes with the step's renderer config.
function rendererViolations(doc) {
  const config = doc.renderer_config ?? null;
  const states = [['initial', doc.initial_state, null], ...doc.steps.map((s) => [s.id, s.state, s.renderer_config ?? null])];
  return states.flatMap(([, state, stepConfig]) => consoleRendererInputViolations(state, config, stepConfig));
}

test('§6: every state the renderer can receive from the 18-boundary specimen validates', () => {
  const doc = specimen();
  assert.equal(doc.steps.length, 18);
  assert.deepEqual(rendererViolations(doc), []);
});

test('§6: validation runs against the deep-frozen ingested experience without mutating it', () => {
  const ingested = ingestExperience(specimen());
  assert.ok(Object.isFrozen(ingested.steps[5].state.transcript[1].output));
  for (const step of ingested.steps) assert.doesNotThrow(() => assertConsoleRendererInput(step.state, ingested.renderer_config, null));
});

const PROBES = {
  // invalid: both enforcement points must reject
  'unknown state key': [(d) => { d.steps[0].state.extra = 1; }, false],
  'unknown entry key': [(d) => { d.steps.at(-1).state.transcript[0].label = 'x'; }, false],
  'missing copy': [(d) => { delete d.steps.at(-1).state.transcript[0].copy; }, false],
  'typing true': [(d) => { d.steps.at(-1).state.transcript[0].typing = true; }, false],
  'unknown risk': [(d) => { d.steps.at(-1).state.transcript.at(-1).risk = 'caution'; }, false],
  'unknown tone': [(d) => { d.steps.at(-1).state.transcript[0].output[0].tone = 'red'; }, false],
  'tab in output': [(d) => { d.steps.at(-1).state.transcript[0].output[0].text = '\tx'; }, false],
  'line break in command': [(d) => { d.steps.at(-1).state.transcript[0].command = 'a\nb'; }, false],
  'line break in response': [(d) => { d.steps.find((s) => s.id === 'stage-hunk--s04').state.transcript.at(-1).response = 'y\n'; }, false],
  'awaiting and response together': [(d) => { d.steps.find((s) => s.id === 'stage-hunk--s04').state.transcript.at(-1).awaiting_response = true; }, false],
  'response without output': [(d) => { delete d.steps.find((s) => s.id === 'stage-hunk--s04').state.transcript.at(-1).output; }, false],
  'empty output array': [(d) => { d.steps.find((s) => s.id === 'stage-hunk--s02').state.transcript.at(-1).output = []; }, false],
  'malformed output id': [(d) => { d.steps.at(-1).state.transcript[0].output[1].id = 'Up_To_Date'; }, false],
  'duplicate output id': [(d) => { d.steps.at(-1).state.transcript[1].output[0].id = 'status-modified'; }, false],
  'focus names invisible line': [(d) => { d.steps[0].state.focus = ['status-modified']; }, false],
  'duplicate focus id': [(d) => { const s = d.steps.find((x) => x.id === 'stage-hunk--s02'); s.state.focus = ['hunk-added', 'hunk-added']; }, false],
  'step-level renderer_config': [(d) => { d.steps[0].renderer_config = {}; }, false],
  'no prompt anywhere': [(d) => { delete d.renderer_config.prompt; }, false],
  'non-string config title': [(d) => { d.renderer_config.title = 7; }, false],
  'unknown config key': [(d) => { d.renderer_config.theme = 'dark'; }, false],
  'non-empty initial focus without lines': [(d) => { d.initial_state.focus = ['x']; }, false],
  'missing focus key': [(d) => { delete d.steps[3].state.focus; }, false],
  'empty config prompt': [(d) => { d.renderer_config.prompt = ''; }, false],
  'config prompt with line break': [(d) => { d.renderer_config.prompt = '~/a\n$'; }, false],
  'empty entry prompt override': [(d) => { d.steps[0].state.transcript[0].prompt = ''; }, false],
  'output line text not a string': [(d) => { d.steps.at(-1).state.transcript[0].output[0].text = 7; }, false],
  // valid variants: both enforcement points must accept
  'beat prompt overrides with no config prompt': [(d) => {
    delete d.renderer_config.prompt;
    for (const s of d.steps) for (const e of s.state.transcript) e.prompt = '~/fixture (main) $';
  }, true],
  'typing false': [(d) => { d.steps.at(-1).state.transcript[0].typing = false; }, true],
  'blank output line': [(d) => { d.steps.at(-1).state.transcript[0].output[2].text = ''; }, true],
  'config without title': [(d) => { delete d.renderer_config.title; }, true],
  'title with em dash and spaces': [(d) => { d.renderer_config.title = 'git — a  b'; }, true]
};

test('differential: renderer-side validation and producer-side conformance agree on every probe', () => {
  for (const [name, [mutate, expectValid]] of Object.entries(PROBES)) {
    const doc = specimen(); mutate(doc);
    const renderer = rendererViolations(doc).length === 0;
    const producer = consoleStateViolations(doc).length === 0;
    assert.equal(renderer, expectValid, `renderer: ${name}`);
    assert.equal(producer, expectValid, `producer: ${name}`);
  }
});

test('every renderer validation rule is reachable and reported with a stable rule id', () => {
  const doc = specimen();
  const base = doc.steps.find((s) => s.id === 'stage-hunk--s02').state;
  const config = doc.renderer_config;
  const seen = new Set();
  const hit = (state, cfg = config, stepCfg = null) => consoleRendererInputViolations(state, cfg, stepCfg).forEach((v) => seen.add(v.rule));
  const clone = () => structuredClone(base);
  hit(clone(), 'not-an-object');
  hit(clone(), { theme: 'x' });
  hit(clone(), { prompt: '' });
  hit(clone(), config, {});
  hit([]);
  hit({ ...clone(), extra: 1 });
  hit({ transcript: [] });
  hit({ transcript: 'x', focus: [] });
  hit({ transcript: [7], focus: [] });
  { const s = clone(); s.transcript[0].label = 'x'; delete s.transcript[0].copy; s.transcript[0].typing = true; hit(s); }
  { const s = clone(); delete s.transcript[0].prompt; hit(s, {}); }
  { const s = clone(); s.transcript.at(-1).response = 'y'; hit(s); }
  { const s = clone(); delete s.transcript.at(-1).output; hit(s); }
  { const s = clone(); s.transcript.at(-1).output.push(7); hit(s); }
  { const s = clone(); const line = s.transcript.at(-1).output[0]; line.extra = 1; delete line.tone; hit(s); }
  { const s = clone(); s.transcript.at(-1).output[0].text = 'a\tb'; hit(s); }
  { const s = clone(); s.transcript.at(-1).output[1].id = s.transcript[0].output[6].id; hit(s); }
  { const s = clone(); s.focus = 'x'; hit(s); }
  { const s = clone(); s.focus = [s.focus[0], s.focus[0], 'ghost']; hit(s); }
  assert.deepEqual([...seen].sort(), [...CONSOLE_VALIDATION_RULES].sort());
});

test('assert throws a ConsoleRendererInputError carrying frozen violations; valid input does not throw', () => {
  const doc = specimen();
  const state = structuredClone(doc.steps[1].state);
  state.focus = ['ghost'];
  let caught;
  assert.throws(() => assertConsoleRendererInput(state, doc.renderer_config, null), (error) => { caught = error; return error instanceof ConsoleRendererInputError; });
  assert.equal(caught.name, 'ConsoleRendererInputError');
  assert.ok(Object.isFrozen(caught.violations) && Object.isFrozen(caught.violations[0]));
  assert.equal(caught.violations[0].rule, 'focus-target');
  assert.doesNotThrow(() => assertConsoleRendererInput(doc.steps[1].state, doc.renderer_config, null));
});

test('a null rendererConfig is accepted when every entry supplies its own prompt', () => {
  const state = structuredClone(specimen().steps[0].state);
  assert.equal(consoleRendererInputViolations(state, null, null)[0].rule, 'prompt-unavailable');
  state.transcript.forEach((entry) => { entry.prompt = '$'; });
  assert.deepEqual(consoleRendererInputViolations(state, null, null), []);
});
