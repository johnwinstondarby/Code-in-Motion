import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyReleasePath,
  scanReleaseBytes
} from '../tools/check-wordpress-supply-chain.mjs';

test('R23 accepts only approved v1 release locations', () => {
  assert.equal(classifyReleasePath('LICENSE'), 'approved-static');
  assert.equal(classifyReleasePath('readme.txt'), 'approved-static');
  assert.equal(classifyReleasePath('code-in-motion.php'), 'approved-static');
  assert.equal(
    classifyReleasePath('wordpress/assets/modules/0.1.0/src/core/cim-core.mjs'),
    'approved-module'
  );
  assert.equal(
    classifyReleasePath('wordpress/assets/modules/0.1.0/wordpress/assets/bootstrap-module.mjs'),
    'approved-wordpress-module'
  );
  assert.equal(
    classifyReleasePath('wordpress/assets/modules/0.1.0/wordpress/experiences/synthetic-wordpress.json'),
    'approved-experience'
  );
});

test('R23 rejects test, harness, tooling, and development paths', () => {
  for (const path of [
    'tests/example.mjs',
    'harness/example.mjs',
    'tools/build.mjs',
    'docs/README.md',
    'node_modules/pkg/index.js',
    '.github/workflows/release.yml',
    'package.json',
    '.nvmrc'
  ]) {
    assert.throws(() => classifyReleasePath(path), /denied|outside the approved/);
  }
});

test('R23 rejects environment and credential file names', () => {
  for (const path of [
    '.env',
    '.env.production',
    'wordpress/assets/modules/0.1.0/src/.env.local',
    'wordpress/assets/modules/0.1.0/src/private.key',
    'wordpress/assets/modules/0.1.0/src/certificate.pem'
  ]) {
    assert.throws(() => classifyReleasePath(path), /environment file|denied secret\/binary\/archive extension/);
  }
});

test('R23 rejects archives, native binaries, WebAssembly, databases, and source maps', () => {
  for (const path of [
    'wordpress/assets/modules/0.1.0/src/native.node',
    'wordpress/assets/modules/0.1.0/src/helper.wasm',
    'wordpress/assets/modules/0.1.0/src/archive.zip',
    'wordpress/assets/modules/0.1.0/src/cache.sqlite',
    'wordpress/assets/modules/0.1.0/src/runtime.mjs.map'
  ]) {
    assert.throws(() => classifyReleasePath(path), /denied secret\/binary\/archive extension/);
  }
});

test('R23 rejects binary content even at an approved text path', () => {
  assert.throws(
    () => scanReleaseBytes('wordpress/assets/cim.css', Buffer.from([0xff, 0xfe, 0x00, 0x01])),
    /non-UTF-8 or binary content/
  );
});

test('R23 rejects private keys and high-confidence credential indicators', () => {
  const cases = [
    ['code-in-motion.php', '-----BEGIN PRIVATE KEY-----\nsecret\n'],
    ['readme.txt', 'AWS_SECRET_ACCESS_KEY=abcdefghijklmnopqrstuvwx123456'],
    ['readme.txt', 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456']
  ];

  for (const [path, content] of cases) {
    assert.throws(() => scanReleaseBytes(path, Buffer.from(content)), /indicator found/);
  }
});

test('R23 permits ordinary production text containing non-secret token vocabulary', () => {
  assert.doesNotThrow(() =>
    scanReleaseBytes(
      'wordpress/assets/modules/0.1.0/src/runtime/example.mjs',
      Buffer.from("const token = 'semantic-token';\nconst passwordField = 'password';\n")
    )
  );
});
