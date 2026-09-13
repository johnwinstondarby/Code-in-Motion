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

function expectRule(result, rule) {
  assert.ok(rules(result).includes(rule), `Expected ${rule}, got ${rules(result).join(', ')}`);
}

test('Runtime may use the privileged setStatus seam and Core may declare it', async () => {
  await withFixture({
    'src/runtime/session.mjs': `export function pause(core) { core.setStatus('paused'); }`,
    'src/core/core.mjs': `
      export class Core {
        setStatus(nextStatus) { this.status = nextStatus; }
      }
    `
  }, async (root) => {
    assert.deepEqual((await checkArchitectureBoundaries(root)).violations, []);
  });
});

test('direct setStatus call outside Runtime is rejected', async () => {
  await withFixture({
    'src/transport/controls.mjs': `export function pause(core) { core.setStatus('paused'); }`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'runtime-only-set-status'));
});

test('destructured setStatus outside Runtime is rejected', async () => {
  await withFixture({
    'src/transport/controls.mjs': `
      export function pause(core) {
        const { setStatus } = core;
        setStatus('paused');
      }
    `
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'runtime-only-set-status'));
});

test('bound setStatus alias outside Runtime is rejected', async () => {
  await withFixture({
    'src/transport/controls.mjs': `
      export function pause(core) {
        const s = core.setStatus.bind(core);
        s('playing');
      }
    `
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'runtime-only-set-status'));
});

test('computed setStatus alias outside Runtime is rejected', async () => {
  await withFixture({
    'src/transport/controls.mjs': `
      export function fault(core) {
        const M = 'setStatus';
        core[M]('faulted');
      }
    `
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'runtime-only-set-status'));
});

test('Core cannot import Runtime', async () => {
  await withFixture({
    'src/core/core.mjs': `import { Runtime } from '../runtime/runtime.mjs'; export const x = Runtime;`,
    'src/runtime/runtime.mjs': `export class Runtime {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'core-to-runtime'));
});

test('Transport cannot import a renderer', async () => {
  await withFixture({
    'src/transport/controls.mjs': `import { Renderer } from '../renderers/renderer.mjs'; export const x = Renderer;`,
    'src/renderers/renderer.mjs': `export class Renderer {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'transport-to-renderers'));
});

test('synthetic renderer cannot import Transport', async () => {
  await withFixture({
    'src/renderers/synthetic/renderer.mjs': `import { Transport } from '../../transport/transport.mjs'; export const x = Transport;`,
    'src/transport/transport.mjs': `export class Transport {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'renderer-to-transport'));
});

test('Host cannot import Core directly', async () => {
  await withFixture({
    'src/host/host.mjs': `import { Core } from '../core/core.mjs'; export const x = Core;`,
    'src/core/core.mjs': `export class Core {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'host-to-core'));
});

test('Telemetry cannot import Runtime', async () => {
  await withFixture({
    'src/telemetry/sink.mjs': `import { Runtime } from '../runtime/runtime.mjs'; export const x = Runtime;`,
    'src/runtime/runtime.mjs': `export class Runtime {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'telemetry-to-runtime'));
});

test('Accessibility helpers cannot import Runtime', async () => {
  await withFixture({
    'src/accessibility/helper.mjs': `import { Runtime } from '../runtime/runtime.mjs'; export const x = Runtime;`,
    'src/runtime/runtime.mjs': `export class Runtime {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'accessibility-to-runtime'));
});

test('production source cannot import harness code', async () => {
  await withFixture({
    'src/runtime/runtime.mjs': `import { fixture } from '../../harness/fixture.mjs'; export const x = fixture;`,
    'harness/fixture.mjs': `export const fixture = {};`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'production-to-harness'));
});

test('package import aliases are resolved before boundary checks', async () => {
  await withFixture({
    'package.json': JSON.stringify({ imports: { '#core/*': './src/core/*' } }),
    'src/transport/controls.mjs': `import { Core } from '#core/core.mjs'; export const x = Core;`,
    'src/core/core.mjs': `export class Core {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'transport-to-core'));
});

test('unknown bare imports fail closed in production', async () => {
  await withFixture({
    'src/runtime/runtime.mjs': `import thing from 'undeclared-package'; export const x = thing;`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'unapproved-bare-import'));
});

test('declared runtime dependencies are allowed as bare imports', async () => {
  await withFixture({
    'package.json': JSON.stringify({ dependencies: { 'runtime-lib': '1.0.0' } }),
    'src/runtime/runtime.mjs': `import thing from 'runtime-lib'; export const x = thing;`
  }, async (root) => {
    assert.deepEqual((await checkArchitectureBoundaries(root)).violations, []);
  });
});

test('commented-out imports do not count as dependencies', async () => {
  await withFixture({
    'src/core/core.mjs': `
      // import { Runtime } from '../runtime/runtime.mjs';
      /* import { Transport } from '../transport/transport.mjs'; */
      export class Core {}
    `
  }, async (root) => {
    assert.deepEqual((await checkArchitectureBoundaries(root)).violations, []);
  });
});

test('shared contracts cannot depend on production components', async () => {
  await withFixture({
    'src/contracts/status.mjs': `import { Core } from '../core/core.mjs'; export const x = Core;`,
    'src/core/core.mjs': `export class Core {}`
  }, async (root) => expectRule(await checkArchitectureBoundaries(root), 'contracts-to-component'));
});

test('Transport may import dependency-free shared contracts', async () => {
  await withFixture({
    'src/contracts/status.mjs': `export const STATUS = Object.freeze({ IDLE: 'idle' });`,
    'src/transport/controls.mjs': `import { STATUS } from '../contracts/status.mjs'; export const x = STATUS.IDLE;`
  }, async (root) => {
    assert.deepEqual((await checkArchitectureBoundaries(root)).violations, []);
  });
});
