import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = resolve(ROOT, 'tools/compile-cim.mjs');
const VALID_SOURCE = resolve(
  ROOT,
  'authoring/cim/fixtures/valid/synthetic-authored.cim'
);

test('R29 CLI --check validates multiple sources without writing output files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cim-r29-check-'));

  try {
    const source = await readFile(VALID_SOURCE, 'utf8');
    const first = join(dir, 'first.cim');
    const second = join(dir, 'second.cim');
    await writeFile(first, source, 'utf8');
    await writeFile(second, source, 'utf8');

    const result = spawnSync(
      process.execPath,
      [CLI, '--check', first, second],
      { cwd: ROOT, encoding: 'utf8' }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS: valid \.cim source .*first\.cim/);
    assert.match(result.stdout, /PASS: valid \.cim source .*second\.cim/);
    assert.deepEqual((await readdir(dir)).sort(), ['first.cim', 'second.cim']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
