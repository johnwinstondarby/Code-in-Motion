import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  validateWordPressExperienceRegistry,
  validateWordPressExperienceRegistryData
} from '../tools/check-wordpress-experience-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function registry(experiences) {
  return {
    schema: 'localis.cim/wordpress-experience-registry/v1',
    experiences
  };
}

test('R30 canonical WordPress Experience registry validates the deployed set', async () => {
  const result = await validateWordPressExperienceRegistry(ROOT);

  assert.deepEqual(
    result.experiences.map(({ id, asset, renderer }) => ({ id, asset, renderer })),
    [
      {
        id: 'git-basic-cycle',
        asset: 'git-basic-cycle.json',
        renderer: 'git/v1'
      },
      {
        id: 'synthetic-wordpress',
        asset: 'synthetic-wordpress.json',
        renderer: 'synthetic/v1'
      }
    ]
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.experiences), true);
});

test('R30 registry requires exact top-level and entry key sets', () => {
  assert.throws(
    () => validateWordPressExperienceRegistryData({
      ...registry([{ id: 'alpha', asset: 'alpha.json' }]),
      extra: true
    }),
    /registry must contain exactly/
  );

  assert.throws(
    () => validateWordPressExperienceRegistryData(
      registry([{ id: 'alpha', asset: 'alpha.json', extra: true }])
    ),
    /registry\.experiences\[0\] must contain exactly/
  );
});

test('R30 registry requires canonical sorted unique Experience IDs', () => {
  assert.throws(
    () => validateWordPressExperienceRegistryData(
      registry([
        { id: 'beta', asset: 'beta.json' },
        { id: 'alpha', asset: 'alpha.json' }
      ])
    ),
    /sorted by Experience ID/
  );

  assert.throws(
    () => validateWordPressExperienceRegistryData(
      registry([
        { id: 'alpha', asset: 'alpha.json' },
        { id: 'alpha', asset: 'alpha-two.json' }
      ])
    ),
    /duplicate registry Experience ID/
  );

  for (const id of ['', 'Alpha', 'alpha_beta', 'alpha.json', '-alpha']) {
    assert.throws(
      () => validateWordPressExperienceRegistryData(
        registry([{ id, asset: 'alpha.json' }])
      ),
      /canonical CiM identifier/,
      id
    );
  }
});

test('R30 registry asset names cannot escape or redirect deployment resolution', () => {
  const invalidAssets = [
    '../alpha.json',
    'nested/alpha.json',
    'nested\\alpha.json',
    'https://example.test/alpha.json',
    'alpha.json?version=1',
    'alpha.json#fragment',
    '/alpha.json',
    'Alpha.json',
    '.json',
    'alpha..json'
  ];

  for (const asset of invalidAssets) {
    assert.throws(
      () => validateWordPressExperienceRegistryData(
        registry([{ id: 'alpha', asset }])
      ),
      /one lowercase JSON file name/,
      asset
    );
  }
});

test('R30 registry rejects duplicate deployment assets', () => {
  assert.throws(
    () => validateWordPressExperienceRegistryData(
      registry([
        { id: 'alpha', asset: 'shared.json' },
        { id: 'beta', asset: 'shared.json' }
      ])
    ),
    /duplicate registry asset/
  );
});
