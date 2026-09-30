import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertReleaseNodeVersion,
  createDeterministicZip,
  readHeadFile,
  rewriteBootstrapForRelease
} from '../tools/build-wordpress-release.mjs';

function centralHeaderOffset(zip) {
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const offset = zip.indexOf(signature);
  assert.notEqual(offset, -1);
  return offset;
}

test('R13 release Node contract accepts only the exact pinned runtime', () => {
  assert.equal(assertReleaseNodeVersion('v22.23.2', '22.23.2'), '22.23.2');
  assert.throws(
    () => assertReleaseNodeVersion('v22.23.1', '22.23.2'),
    /requires Node 22\.23\.2; active runtime is 22\.23\.1/
  );
  assert.throws(
    () => assertReleaseNodeVersion('v20.20.0', '22.23.2'),
    /requires Node 22\.23\.2; active runtime is 20\.20\.0/
  );
});

test('R13 release bootstrap rewrites exactly one module handoff into the version-bearing tree', () => {
  const source = "const moduleUrl = new URL('./bootstrap-module.mjs', sourceUrl);\n";
  const output = rewriteBootstrapForRelease(source, '0.1.0');
  assert.equal(
    output,
    "const moduleUrl = new URL('./modules/0.1.0/wordpress/assets/bootstrap-module.mjs', sourceUrl);\n"
  );
  assert.throws(
    () => rewriteBootstrapForRelease('const untouched = true;\n', '0.1.0'),
    /exactly one repository-tree module handoff/
  );
});

test('R13 ZIP bytes are input-order independent and carry fixed archive metadata', () => {
  const entries = [
    { path: 'code-in-motion/wordpress/assets/cim.css', data: Buffer.from('.cim{}\n') },
    { path: 'code-in-motion/code-in-motion.php', data: Buffer.from('<?php\n') }
  ];

  const first = createDeterministicZip(entries);
  const second = createDeterministicZip([...entries].reverse());
  assert.deepEqual(first, second);

  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt16LE(6), 0x0800);
  assert.equal(first.readUInt16LE(8), 8);
  assert.equal(first.readUInt16LE(10), 0x0000);
  assert.equal(first.readUInt16LE(12), 0x0021);

  const central = centralHeaderOffset(first);
  assert.equal(first.readUInt16LE(central + 8), 0x0800);
  assert.equal(first.readUInt16LE(central + 10), 8);
  assert.equal(first.readUInt16LE(central + 12), 0x0000);
  assert.equal(first.readUInt16LE(central + 14), 0x0021);
  assert.equal(first.readUInt16LE(central + 30), 0);
  assert.equal(first.readUInt16LE(central + 32), 0);
  assert.equal(first.readUInt32LE(central + 38), (0o100644 << 16) >>> 0);
});


test('R13 committed source authority is independent of working-tree line endings', () => {
  const repo = mkdtempSync(join(tmpdir(), 'cim-r13-head-'));
  const fixture = join(repo, 'fixture.txt');

  const git = (args, options = {}) => execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    ...options
  });

  git(['init', '-q']);
  git(['config', 'user.name', 'Code in Motion QA']);
  git(['config', 'user.email', 'qa@example.invalid']);
  git(['config', 'core.autocrlf', 'false']);

  writeFileSync(fixture, 'alpha\nbeta\n', 'utf8');
  git(['add', 'fixture.txt']);
  git(['commit', '-q', '-m', 'canonical LF fixture']);

  const headBytes = execFileSync(
    'git',
    ['show', 'HEAD:fixture.txt'],
    { cwd: repo }
  );

  writeFileSync(fixture, 'alpha\r\nbeta\r\n', 'utf8');
  const workingBytes = readFileSync(fixture);

  assert.deepEqual(headBytes, Buffer.from('alpha\nbeta\n'));
  assert.notDeepEqual(workingBytes, headBytes);

  const releaseBytes = readHeadFile('fixture.txt', null, repo);

  assert.deepEqual(releaseBytes, headBytes);
  assert.notDeepEqual(releaseBytes, workingBytes);
});

test('R13 ZIP rejects entries outside the single code-in-motion plugin root', () => {
  assert.throws(
    () => createDeterministicZip([{ path: 'other-plugin/file.txt', data: Buffer.from('x') }]),
    /outside the single plugin root/
  );
});
