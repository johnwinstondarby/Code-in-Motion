import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  CimAuthoringError,
  compileCimSource
} from '../authoring/cim/compiler.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_SOURCE = resolve(
  ROOT,
  'authoring/cim/fixtures/valid/synthetic-authored.cim'
);
const GENERATED = resolve(
  ROOT,
  'authoring/generated/synthetic-authored.json'
);

function capture(source, sourceId = 'fixture.cim') {
  try {
    compileCimSource(source, { sourceId });
  } catch (error) {
    assert.equal(error instanceof CimAuthoringError, true);
    return error;
  }
  assert.fail('Expected .cim compilation to fail.');
}

function minimalSource({
  id = 'minimal-authored',
  stepId = 'step-01',
  dwell = '0',
  href = '/reference/',
  commentary = 'Safe text.'
} = {}) {
  return `cim: 1
engine_min: 1.0.0
experience_version: 1.0.0
id: ${id}
renderer: synthetic/v1
initial_state:
  value: A
steps:
  - id: ${stepId}
    label: Step
    commentary:
      text: ${JSON.stringify(commentary)}
      links:
        - id: ref
          label: Reference
          href: ${href}
    state:
      value: B
    dwell_ms: ${dwell}
`;
}

test('R29 valid .cim source converges exactly on committed Runtime JSON', async () => {
  const source = await readFile(VALID_SOURCE, 'utf8');
  const expected = JSON.parse(await readFile(GENERATED, 'utf8'));
  const compiled = compileCimSource(source, { sourceId: VALID_SOURCE });

  assert.deepEqual(compiled.experience, expected);
  assert.equal(Object.isFrozen(compiled), true);
  assert.equal(Object.isFrozen(compiled.experience), true);
  assert.equal(Object.isFrozen(compiled.experience.steps), true);
  assert.equal(Object.isFrozen(compiled.experience.steps[0].state), true);
});

test('R29 preserves multiline commentary, opaque config, and B-to-B observation state', async () => {
  const source = await readFile(VALID_SOURCE, 'utf8');
  const { experience } = compileCimSource(source, { sourceId: 'synthetic-authored.cim' });

  assert.equal(
    experience.steps[0].commentary.text,
    'State changes to B.\nThis second line proves multiline commentary.'
  );
  assert.deepEqual(experience.renderer_config, {
    layout: 'linear',
    labels: { prefix: 'Node' }
  });
  assert.deepEqual(experience.steps[0].renderer_config, { emphasis: 'high' });
  assert.equal(experience.steps[0].dwell_ms, 500);
  assert.equal(experience.steps[1].dwell_ms, 1200);
  assert.notEqual(experience.steps[0].id, experience.steps[1].id);
  assert.deepEqual(experience.steps[0].state, experience.steps[1].state);
});

test('R29 source map records deterministic one-based authored locations', async () => {
  const source = await readFile(VALID_SOURCE, 'utf8');
  const compiled = compileCimSource(source, { sourceId: 'synthetic-authored.cim' });

  assert.equal(compiled.locations['$.steps[0].id'].line, 20);
  assert.equal(compiled.locations['$.steps[0].id'].column, 9);
  assert.equal(compiled.locations['$.steps[1].id'].line, 38);
  assert.equal(compiled.locations['$.steps[1].id'].column, 9);
  assert.equal(compiled.locations['$.steps[0].commentary.text'].line, 24);
  assert.equal(compiled.locations['$.schema'].line, 1);
});

test('R29 duplicate keys fail as source-located authoring errors', () => {
  const error = capture('cim: 1\ncim: 1\n', 'duplicate.cim');
  assert.equal(error.code, 'CIM-AUTH-002');
  assert.equal(error.diagnostics[0].line, 2);
  assert.equal(error.diagnostics[0].column, 1);
  assert.match(error.diagnostics[0].message, /Duplicate mapping key/);
});

test('R29 rejects unsupported authoring versions', () => {
  const error = capture('cim: 2\n', 'version.cim');
  assert.equal(error.code, 'CIM-AUTH-003');
  assert.equal(error.diagnostics[0].path, '$.cim');
  assert.equal(error.diagnostics[0].line, 1);
});

test('R29 rejects anchors and aliases', () => {
  const anchored = capture(
    'cim: 1\nrenderer_config: &cfg\n  layout: linear\n',
    'anchor.cim'
  );
  assert.equal(anchored.code, 'CIM-AUTH-002');
  assert.match(anchored.diagnostics[0].message, /anchors/);

  const aliased = capture(
    'cim: 1\nrenderer_config: *cfg\n',
    'alias.cim'
  );
  assert.equal(aliased.code, 'CIM-AUTH-002');
  assert.match(aliased.diagnostics[0].message, /aliases/);
});

test('R29 rejects explicit tags, merge keys, and directives', () => {
  const tagged = capture(
    'cim: 1\nrenderer_config: !custom {}\n',
    'tag.cim'
  );
  assert.equal(tagged.code, 'CIM-AUTH-002');
  assert.match(tagged.diagnostics[0].message, /tags/);

  const merged = capture(
    'cim: 1\nrenderer_config:\n  <<:\n    layout: linear\n',
    'merge.cim'
  );
  assert.equal(merged.code, 'CIM-AUTH-002');
  assert.match(merged.diagnostics[0].message, /merge keys/);

  const directed = capture(
    '%YAML 1.2\n---\ncim: 1\n',
    'directive.cim'
  );
  assert.equal(directed.code, 'CIM-AUTH-002');
  assert.match(directed.diagnostics[0].message, /directives/);
});

test('R29 rejects multiple documents, non-string keys, and non-finite numbers', () => {
  const multiple = capture(
    'cim: 1\n---\ncim: 1\n',
    'multiple.cim'
  );
  assert.equal(multiple.code, 'CIM-AUTH-002');
  assert.match(multiple.diagnostics[0].message, /exactly one YAML document/);

  const keyed = capture(
    'cim: 1\nrenderer_config:\n  1: value\n',
    'key.cim'
  );
  assert.equal(keyed.code, 'CIM-AUTH-002');
  assert.match(keyed.diagnostics[0].message, /keys must be strings/);

  const infinite = capture(
    minimalSource({ dwell: '.inf' }),
    'infinite.cim'
  );
  assert.equal(infinite.code, 'CIM-AUTH-002');
  assert.match(infinite.diagnostics[0].message, /Non-finite numbers/);
});

test('R29 malformed syntax produces parse-phase line and column', () => {
  const error = capture('cim: 1\nsteps: [\n', 'syntax.cim');
  assert.equal(error.code, 'CIM-AUTH-001');
  assert.equal(error.diagnostics[0].phase, 'parse');
  assert.equal(error.diagnostics[0].line >= 2, true);
  assert.equal(error.diagnostics[0].column >= 1, true);
});

test('R29 Runtime validation codes survive and gain source locations', () => {
  const duplicateSteps = `cim: 1
engine_min: 1.0.0
experience_version: 1.0.0
id: duplicate-steps
renderer: synthetic/v1
initial_state: { value: A }
steps:
  - id: step-01
    label: One
    commentary: { text: One, links: [] }
    state: { value: B }
  - id: step-01
    label: Two
    commentary: { text: Two, links: [] }
    state: { value: B }
`;
  const duplicate = capture(duplicateSteps, 'duplicate-step.cim');
  assert.equal(duplicate.code, 'CIM-EXP-003');
  assert.equal(duplicate.diagnostics[0].phase, 'validation');
  assert.equal(duplicate.diagnostics[0].line, 12);
  assert.equal(duplicate.diagnostics[0].column, 9);

  const reserved = capture(
    minimalSource({ stepId: 'initial' }),
    'reserved.cim'
  );
  assert.equal(reserved.code, 'CIM-EXP-004');
  assert.equal(reserved.diagnostics[0].line, 9);

  const dwell = capture(
    minimalSource({ dwell: '-1' }),
    'dwell.cim'
  );
  assert.equal(dwell.code, 'CIM-EXP-005');
  assert.equal(dwell.diagnostics[0].phase, 'validation');

  const link = capture(
    minimalSource({ href: 'javascript:alert(1)' }),
    'link.cim'
  );
  assert.equal(link.code, 'CIM-EXP-006');
  assert.equal(link.diagnostics[0].phase, 'validation');
});

test('R29 missing Runtime fields resolve diagnostics to nearest authored ancestor', () => {
  const source = `cim: 1
engine_min: 1.0.0
experience_version: 1.0.0
renderer: synthetic/v1
initial_state: { value: A }
steps:
  - id: step-01
    label: One
    commentary: { text: One, links: [] }
    state: { value: B }
`;
  const error = capture(source, 'missing-id.cim');
  assert.equal(error.code, 'CIM-EXP-002');
  assert.equal(error.diagnostics[0].path, '$.id');
  assert.equal(error.diagnostics[0].line, 1);
  assert.equal(error.diagnostics[0].column, 1);
});

test('R29 executable-looking markup remains inert authored text', () => {
  const source = minimalSource({
    commentary: '<script>globalThis.pwned = true</script>'
  });
  const { experience } = compileCimSource(source, { sourceId: 'markup.cim' });

  assert.equal(
    experience.steps[0].commentary.text,
    '<script>globalThis.pwned = true</script>'
  );
});
