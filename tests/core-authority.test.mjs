import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { checkCoreAuthority } from '../tools/check-core-authority.mjs';

async function withFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), 'cim-core-authority-'));
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

function expectRule(result, rule) {
  assert.ok(rules(result).includes(rule), `Expected ${rule}, got ${rules(result).join(', ')}`);
}

test('Runtime may import Core and retain privileged capability names', async () => {
  await withFixture({
    'src/core/core-engine.mjs': `export function createCoreEngine(){return {semanticControl:{},faultControl:{},statusControl:{}};}`,
    'src/runtime/core-session.mjs': `
      import { createCoreEngine } from '../core/core-engine.mjs';
      export function acquireRuntimeCoreControls() {
        const core = createCoreEngine();
        return { semanticControl: core.semanticControl, faultControl: core.faultControl, statusControl: core.statusControl };
      }
    `
  }, async (root) => {
    assert.deepEqual((await checkCoreAuthority(root)).violations, []);
  });
});

test('future production component cannot import Core directly', async () => {
  await withFixture({
    'src/plugin/feature.mjs': `import { createCoreEngine } from '../core/core-engine.mjs'; export const x = createCoreEngine;`,
    'src/core/core-engine.mjs': `export function createCoreEngine(){}`
  }, async (root) => expectRule(await checkCoreAuthority(root), 'runtime-only-core-import'));
});

test('host cannot import the private Runtime Core-session seam', async () => {
  await withFixture({
    'src/host/host.mjs': `import { createRuntimeCoreSession } from '../runtime/core-session.mjs'; export const x = createRuntimeCoreSession;`,
    'src/runtime/core-session.mjs': `export function createRuntimeCoreSession(){}`
  }, async (root) => expectRule(await checkCoreAuthority(root), 'runtime-core-session-private'));
});

test('privileged Core capability reference outside Core or Runtime is rejected', async () => {
  await withFixture({
    'src/plugin/feature.mjs': `export function move(x){ return x.semanticControl.beginTarget('step-01'); }`
  }, async (root) => expectRule(await checkCoreAuthority(root), 'runtime-only-core-control'));
});

test('comments and string literals do not create false privileged-control findings', async () => {
  await withFixture({
    'src/plugin/feature.mjs': `
      // semanticControl belongs to Runtime.
      const note = 'faultControl statusControl acquireRuntimeCoreControls';
      export { note };
    `
  }, async (root) => {
    assert.deepEqual((await checkCoreAuthority(root)).violations, []);
  });
});

test('package aliases cannot bypass the Runtime-only Core import rule', async () => {
  await withFixture({
    'package.json': JSON.stringify({ imports: { '#core/*': './src/core/*' } }),
    'src/plugin/feature.mjs': `import { createCoreEngine } from '#core/core-engine.mjs'; export const x = createCoreEngine;`,
    'src/core/core-engine.mjs': `export function createCoreEngine(){}`
  }, async (root) => expectRule(await checkCoreAuthority(root), 'runtime-only-core-import'));
});
