import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { checkArchitectureBoundaries } from '../tools/check-architecture-boundaries.mjs';
import {
  RENDER_CONTEXT_KEYS,
  ABORT_SIGNAL_KEYS,
  RENDER_CLOCK_KEYS,
  DOM_SVG_CANONICALIZER_ID
} from '../src/renderers/interface.mjs';

async function withFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), 'cim-source-floor-'));

  try {
    await mkdir(join(root, 'src'), { recursive: true });
    for (const [relativePath, content] of Object.entries(files)) {
      const path = join(root, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf8');
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function rules(result) {
  return result.violations.map((violation) => violation.rule);
}

test('architecture verification fails when zero production source files are discovered', async () => {
  await withFixture({
    'src/README.md': '# documentation only\n'
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.equal(result.filesChecked, 0);
    assert.ok(rules(result).includes('no-production-sources'));
  });
});

test('architecture verification proves a discovered production source file', async () => {
  await withFixture({
    'src/renderers/interface.mjs': `export const marker = 'renderer-interface';\n`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.equal(result.filesChecked, 1);
    assert.deepEqual(result.violations, []);
  });
});

test('renderer interface exports the exact frozen v1 contract key sets', () => {
  assert.deepEqual(RENDER_CONTEXT_KEYS, [
    'animate',
    'fromState',
    'fromStepId',
    'stepId',
    'rendererConfig',
    'stepRendererConfig',
    'transitionId',
    'abortSignal',
    'clock',
    'reducedMotion'
  ]);
  assert.deepEqual(ABORT_SIGNAL_KEYS, ['aborted', 'reason', 'onAbort']);
  assert.deepEqual(RENDER_CLOCK_KEYS, ['now', 'schedule', 'cancel', 'onFrame']);
  assert.equal(DOM_SVG_CANONICALIZER_ID, 'cim-dom-svg/v1');

  assert.equal(Object.isFrozen(RENDER_CONTEXT_KEYS), true);
  assert.equal(Object.isFrozen(ABORT_SIGNAL_KEYS), true);
  assert.equal(Object.isFrozen(RENDER_CLOCK_KEYS), true);
});
