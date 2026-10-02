// Producer-side conformance of compiled output to docs/renderers/CONSOLE-RENDERER-v1.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileAuthoringSource } from '../authoring/v1/compile-authoring.mjs';
import { consoleStateViolations } from '../authoring/v1/console-state-conformance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const doc = compileAuthoringSource(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.authoring.json'), 'utf8')).document;

test('compiled specimen state conforms to CONSOLE-RENDERER-v1 at initial and all 18 boundaries', () => {
  assert.deepEqual(consoleStateViolations(doc), []);
});

test('the conformance check rejects each class of contract violation (mutation probes)', () => {
  const probe = (mutate) => { const d = structuredClone(doc); mutate(d); return consoleStateViolations(d).length; };
  const last = (d) => d.steps.at(-1).state.transcript;
  const stage = (d, n) => d.steps.find((s) => s.id === `stage-hunk--s0${n}`).state.transcript.at(-1);
  const cases = {
    'unknown state key': (d) => { d.steps[0].state.extra = 1; },
    'unknown entry key': (d) => { last(d)[0].label = 'x'; },
    'missing copy': (d) => { delete last(d)[0].copy; },
    'typing true': (d) => { last(d)[0].typing = true; },
    'unknown risk': (d) => { last(d).at(-1).risk = 'caution'; },
    'unknown tone': (d) => { last(d)[0].output[0].tone = 'red'; },
    'tab in output': (d) => { last(d)[0].output[0].text = '\tx'; },
    'line break in command': (d) => { last(d)[0].command = 'a\nb'; },
    'awaiting and response together': (d) => { stage(d, 4).awaiting_response = true; },
    'response without output': (d) => { delete stage(d, 4).output; },
    'empty output array': (d) => { stage(d, 2).output = []; },
    'duplicate output id': (d) => { last(d)[1].output[0].id = 'status-modified'; },
    'focus names invisible line': (d) => { d.steps[0].state.focus = ['status-modified']; },
    'duplicate focus id': (d) => { const s = d.steps.find((x) => x.id === 'stage-hunk--s02'); s.state.focus = ['hunk-added', 'hunk-added']; },
    'step-level renderer_config': (d) => { d.steps[0].renderer_config = {}; },
    'wrong renderer': (d) => { d.renderer = 'git/v1'; },
    'no prompt anywhere': (d) => { delete d.renderer_config.prompt; },
    'non-empty initial focus without lines': (d) => { d.initial_state.focus = ['x']; }
  };
  for (const [name, mutate] of Object.entries(cases)) assert.ok(probe(mutate) > 0, name);
});
