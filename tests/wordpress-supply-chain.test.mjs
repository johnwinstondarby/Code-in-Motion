import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  classifyReleasePath,
  scanReleaseBytes
} from '../tools/check-wordpress-supply-chain.mjs';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);
const RELEASE_VERSION = packageJson.version;
const MODULE_ROOT = `wordpress/assets/modules/${RELEASE_VERSION}`;

const registry = JSON.parse(
  readFileSync(new URL('../wordpress/experiences/registry.json', import.meta.url), 'utf8')
);
const REGISTERED_ASSETS = new Set(registry.experiences.map((experience) => experience.asset));

test('R23 accepts only approved v1 release locations', () => {
  assert.equal(classifyReleasePath('LICENSE', RELEASE_VERSION, REGISTERED_ASSETS), 'approved-static');
  assert.equal(classifyReleasePath('readme.txt', RELEASE_VERSION, REGISTERED_ASSETS), 'approved-static');
  assert.equal(classifyReleasePath('code-in-motion.php', RELEASE_VERSION, REGISTERED_ASSETS), 'approved-static');
  assert.equal(classifyReleasePath('uninstall.php', RELEASE_VERSION, REGISTERED_ASSETS), 'approved-static');
  assert.equal(classifyReleasePath('wordpress/admin-console.php', RELEASE_VERSION, REGISTERED_ASSETS), 'approved-static');
  assert.equal(
    classifyReleasePath('wordpress/experiences/registry.json', RELEASE_VERSION, REGISTERED_ASSETS),
    'approved-static'
  );
  assert.equal(
    classifyReleasePath('wordpress/renderers/inventory.generated.json', RELEASE_VERSION, REGISTERED_ASSETS),
    'approved-static'
  );
  assert.equal(
    classifyReleasePath('wordpress/release/release-info.generated.json', RELEASE_VERSION, REGISTERED_ASSETS),
    'approved-static'
  );
  assert.equal(
    classifyReleasePath(`${MODULE_ROOT}/src/core/cim-core.mjs`, RELEASE_VERSION, REGISTERED_ASSETS),
    'approved-module'
  );
  assert.equal(
    classifyReleasePath(
      `${MODULE_ROOT}/wordpress/assets/bootstrap-module.mjs`,
      RELEASE_VERSION,
      REGISTERED_ASSETS
    ),
    'approved-wordpress-module'
  );
  for (const asset of REGISTERED_ASSETS) {
    assert.equal(
      classifyReleasePath(
        `${MODULE_ROOT}/wordpress/experiences/${asset}`,
        RELEASE_VERSION,
        REGISTERED_ASSETS
      ),
      'approved-experience'
    );
  }
});

test('R23 rejects unregistered Experience JSON from the version-bearing deployment directory', () => {
  assert.throws(
    () => classifyReleasePath(
      `${MODULE_ROOT}/wordpress/experiences/unregistered.json`,
      RELEASE_VERSION,
      REGISTERED_ASSETS
    ),
    /not an approved release input/
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
    assert.throws(() => classifyReleasePath(path, RELEASE_VERSION, REGISTERED_ASSETS), /denied|outside the approved/);
  }
});

test('R23 rejects environment and credential file names', () => {
  for (const path of [
    '.env',
    '.env.production',
    `${MODULE_ROOT}/src/.env.local`,
    `${MODULE_ROOT}/src/private.key`,
    `${MODULE_ROOT}/src/certificate.pem`
  ]) {
    assert.throws(
      () => classifyReleasePath(path, RELEASE_VERSION, REGISTERED_ASSETS),
      /environment file|denied secret\/binary\/archive extension/
    );
  }
});

test('R23 rejects archives, native binaries, WebAssembly, databases, and source maps', () => {
  for (const path of [
    `${MODULE_ROOT}/src/native.node`,
    `${MODULE_ROOT}/src/helper.wasm`,
    `${MODULE_ROOT}/src/archive.zip`,
    `${MODULE_ROOT}/src/cache.sqlite`,
    `${MODULE_ROOT}/src/runtime.mjs.map`
  ]) {
    assert.throws(
      () => classifyReleasePath(path, RELEASE_VERSION, REGISTERED_ASSETS),
      /denied secret\/binary\/archive extension/
    );
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
      `${MODULE_ROOT}/src/runtime/example.mjs`,
      Buffer.from("const token = 'semantic-token';\nconst passwordField = 'password';\n")
    )
  );
});
