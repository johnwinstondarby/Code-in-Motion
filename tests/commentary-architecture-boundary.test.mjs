import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { checkArchitectureBoundaries } from '../tools/check-architecture-boundaries.mjs';

async function withFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), 'cim-commentary-boundary-'));
  try {
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

test('Commentary cannot import Runtime implementation modules', async () => {
  await withFixture({
    'src/commentary/reveal.mjs': `import { createCiMInstance } from '../runtime/cim-instance.mjs'; export const x = createCiMInstance;`,
    'src/runtime/cim-instance.mjs': `export function createCiMInstance() {}`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.ok(result.violations.some((violation) => violation.rule === 'commentary-to-runtime'));
  });
});

test('Commentary may import dependency-free shared contracts', async () => {
  await withFixture({
    'src/contracts/session.mjs': `export const INITIAL = 'initial';`,
    'src/commentary/reveal.mjs': `import { INITIAL } from '../contracts/session.mjs'; export const x = INITIAL;`
  }, async (root) => {
    assert.deepEqual((await checkArchitectureBoundaries(root)).violations, []);
  });
});
