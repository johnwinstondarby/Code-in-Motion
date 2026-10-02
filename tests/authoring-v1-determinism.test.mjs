// R42 compiler Gate 2: identical semantic input -> byte-identical canonical output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileAuthoringSource } from '../authoring/v1/compile-authoring.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = resolve(ROOT, 'experiences/git/git-repository-practice.authoring.json');
const lfText = readFileSync(SOURCE_PATH, 'utf8').replace(/\r\n/g, '\n');
const reference = compileAuthoringSource(lfText);

function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).reverse().map((k) => [k, reverseKeys(value[k])]));
  return value;
}

test('Gate 2: repeated compilation of identical input is byte-identical', () => {
  for (let i = 0; i < 5; i += 1) assert.equal(compileAuthoringSource(lfText).text, reference.text);
});

test('Gate 2: CRLF source bytes compile to output byte-identical to LF source', () => {
  const crlfText = lfText.replace(/\n/g, '\r\n');
  assert.notEqual(crlfText, lfText);
  const crlf = compileAuthoringSource(crlfText);
  assert.equal(crlf.text, reference.text);
  assert.equal(crlf.provenance.authoring_semantic_sha256, reference.provenance.authoring_semantic_sha256);
});

test('Gate 2: source formatting and object-key order do not affect output (A2R §13)', () => {
  const parsed = JSON.parse(lfText);
  for (const variant of [JSON.stringify(parsed), JSON.stringify(reverseKeys(parsed), null, 4), JSON.stringify(reverseKeys(parsed), null, '\t')]) {
    const result = compileAuthoringSource(variant);
    assert.equal(result.text, reference.text);
    assert.equal(result.provenanceText, reference.provenanceText);
  }
});

test('Gate 2: canonical emission is LF-only, single terminal newline, and free of host-specific data', () => {
  assert.ok(!reference.text.includes('\r'));
  assert.ok(reference.text.endsWith('}\n') && !reference.text.endsWith('\n\n'));
  for (const forbidden of [ROOT, tmpdir(), process.cwd(), 'file://']) assert.ok(!reference.text.includes(forbidden), forbidden);
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(reference.text), 'no timestamps');
  assert.ok(!reference.provenanceText.includes(ROOT));
});

test('Gate 2: separate processes with different cwd, TZ, locale, and LF/CRLF source files agree byte-for-byte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cim-r42-determinism-'));
  try {
    writeFileSync(join(dir, 'lf.json'), lfText);
    writeFileSync(join(dir, 'crlf.json'), lfText.replace(/\n/g, '\r\n'));
    const cli = resolve(ROOT, 'tools/compile-authoring.mjs');
    const run = (file, env, cwd) => execFileSync(process.execPath, [cli, join(dir, file)], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
    const a = run('lf.json', { TZ: 'UTC', LANG: 'C' }, ROOT);
    const b = run('crlf.json', { TZ: 'Pacific/Kiritimati', LANG: 'tr_TR.UTF-8', LC_ALL: 'tr_TR.UTF-8' }, dir);
    assert.equal(a, reference.text);
    assert.equal(b, reference.text);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
