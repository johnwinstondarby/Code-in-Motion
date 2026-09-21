import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  rendererInventorySource,
  validateRendererInventoryData,
  validateWordPressRendererIds,
  validateWordPressRendererRegistry
} from '../tools/check-wordpress-renderer-registry.mjs';
import {
  WORDPRESS_RENDERER_IDS,
  createWordPressRendererRegistry
} from '../wordpress/assets/renderer-registry.mjs';

test('R32 canonical WordPress renderer registry is ordered, frozen, and factory-backed', () => {
  assert.deepEqual(WORDPRESS_RENDERER_IDS, ['git/v1', 'synthetic/v1']);
  assert.equal(Object.isFrozen(WORDPRESS_RENDERER_IDS), true);

  const registry = createWordPressRendererRegistry();
  assert.deepEqual([...registry.keys()], WORDPRESS_RENDERER_IDS);
  for (const id of WORDPRESS_RENDERER_IDS) {
    assert.equal(typeof registry.get(id), 'function');
  }
});

test('R32 generated renderer inventory is exact inert ID-only data', async () => {
  const source = await readFile(
    new URL('../wordpress/renderers/inventory.generated.json', import.meta.url),
    'utf8'
  );
  const data = JSON.parse(source);

  assert.equal(source, rendererInventorySource(WORDPRESS_RENDERER_IDS));
  assert.deepEqual(Reflect.ownKeys(data), ['schema', 'renderers']);
  assert.equal(data.schema, 'localis.cim/wordpress-renderer-inventory/v1');
  assert.deepEqual(data.renderers, [{ id: 'git/v1' }, { id: 'synthetic/v1' }]);
  for (const entry of data.renderers) {
    assert.deepEqual(Reflect.ownKeys(entry), ['id']);
  }

  assert.deepEqual(
    validateRendererInventoryData(data, WORDPRESS_RENDERER_IDS),
    WORDPRESS_RENDERER_IDS
  );
});

test('R32 renderer registry rejects malformed, duplicate, and noncanonical ordering', () => {
  for (const ids of [
    [],
    ['Git/v1'],
    ['git'],
    ['git/v0'],
    ['git/v1', 'git/v1'],
    ['synthetic/v1', 'git/v1']
  ]) {
    assert.throws(() => validateWordPressRendererIds(ids), /R32 WordPress renderer registry/);
  }
});

test('R32 every shipped registered Experience resolves through the production renderer registry', async () => {
  const result = await validateWordPressRendererRegistry();
  assert.deepEqual(result.experienceBindings, [
    { experienceId: 'git-basic-cycle', rendererId: 'git/v1' },
    { experienceId: 'synthetic-wordpress', rendererId: 'synthetic/v1' }
  ]);
});

test('R32 bootstrap consumes renderer registry rather than owning subject renderer registration', async () => {
  const source = await readFile(
    new URL('../wordpress/assets/bootstrap-module.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /createWordPressRendererRegistry/);
  assert.doesNotMatch(source, /src\/renderers\/subjects\//);
  assert.doesNotMatch(source, /registry:\s*new Map\s*\(/);
});
