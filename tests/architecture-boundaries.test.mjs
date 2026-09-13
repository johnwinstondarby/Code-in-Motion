import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { checkArchitectureBoundaries } from '../tools/check-architecture-boundaries.mjs';

async function withFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), 'cim-boundary-'));

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

function rules(result) {
  return result.violations.map((violation) => violation.rule);
}

test('Runtime may call Core.setStatus through the documented seam', async () => {
  await withFixture({
    'src/runtime/session.mjs': `
      import { Core } from '../core/core.mjs';
      export function pause(core) { core.setStatus('paused'); }
    `,
    'src/core/core.mjs': `
      export class Core {
        setStatus(nextStatus) { this.status = nextStatus; }
      }
    `
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.deepEqual(result.violations, []);
  });
});

test('production code outside Runtime cannot call Core.setStatus', async () => {
  await withFixture({
    'src/core/core.mjs': `export class Core { setStatus(nextStatus) { this.status = nextStatus; } }`,
    'src/transport/controls.mjs': `export function pause(core) { core.setStatus('paused'); }`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.ok(rules(result).includes('runtime-only-set-status'));
  });
});

test('Core cannot import Runtime', async () => {
  await withFixture({
    'src/core/core.mjs': `import { Runtime } from '../runtime/runtime.mjs'; export class Core {}`,
    'src/runtime/runtime.mjs': `export class Runtime {}`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.ok(rules(result).includes('core-to-runtime'));
  });
});

test('Transport cannot import a renderer', async () => {
  await withFixture({
    'src/transport/controls.mjs': `import { Renderer } from '../renderers/renderer.mjs'; export const x = Renderer;`,
    'src/renderers/renderer.mjs': `export class Renderer {}`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.ok(rules(result).includes('transport-to-renderers'));
  });
});

test('production source cannot import harness code', async () => {
  await withFixture({
    'src/runtime/runtime.mjs': `import { fixture } from '../../harness/fixture.mjs'; export const x = fixture;`,
    'harness/fixture.mjs': `export const fixture = {};`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.ok(rules(result).includes('production-to-harness'));
  });
});

test('a Core setStatus method declaration is not mistaken for a prohibited call', async () => {
  await withFixture({
    'src/core/core.mjs': `
      export class Core {
        setStatus(nextStatus) { this.status = nextStatus; }
      }
    `
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.deepEqual(result.violations, []);
  });
});
