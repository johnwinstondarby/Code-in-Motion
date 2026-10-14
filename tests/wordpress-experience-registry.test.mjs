import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  REGISTRABLE_RUNTIME_SCHEMAS,
  loadWordPressExperienceRegistry,
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
        id: 'git-repository-practice',
        asset: 'git-repository-practice.json',
        renderer: 'console/v1'
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

async function deploymentRoot(assets) {
  const root = await mkdtemp(join(tmpdir(), 'cim-r42-registry-'));
  const directory = join(root, 'wordpress', 'experiences');
  await mkdir(directory, { recursive: true });
  const entries = Object.keys(assets).sort().map((id) => ({ id, asset: `${id}.json` }));
  await writeFile(join(directory, 'registry.json'), JSON.stringify(registry(entries)));
  for (const [id, experience] of Object.entries(assets)) await writeFile(join(directory, `${id}.json`), JSON.stringify(experience));
  return root;
}

test('ADR 0053 production registration admits recognized v1 and v2 schemas', () => {
  assert.deepEqual([...REGISTRABLE_RUNTIME_SCHEMAS], ['localis.cim/v1', 'localis.cim/v2']);
  assert.ok(Object.isFrozen(REGISTRABLE_RUNTIME_SCHEMAS));
});

test('ADR 0053 registry admits a compatible validated localis.cim/v2 asset', async () => {
  const v2 = JSON.parse(await readFile(resolve(ROOT, 'schemas', 'fixtures', 'valid', 'compiled-console-v2.json'), 'utf8'));
  const root = await deploymentRoot({ 'compiled-console-v2': v2 });
  try {
    const result = await loadWordPressExperienceRegistry(root);
    assert.equal(result.experiences[0].id,'compiled-console-v2');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ADR 0053 registry rejects an incompatible engine minimum before projection generation', async () => {
  const v2 = JSON.parse(await readFile(resolve(ROOT,'schemas','fixtures','valid','compiled-console-v2.json'),'utf8'));
  v2.engine_min = '1.0.2';
  const root = await deploymentRoot({'compiled-console-v2':v2});
  try { await assert.rejects(()=>loadWordPressExperienceRegistry(root),/CIM-EXP-015/); }
  finally { await rm(root,{recursive:true,force:true}); }
});

test('R42 registry gate still admits a valid localis.cim/v1 asset', async () => {
  const v1 = JSON.parse(await readFile(resolve(ROOT, 'schemas', 'fixtures', 'valid', 'synthetic-basic.json'), 'utf8'));
  const root = await deploymentRoot({ 'synthetic-basic': v1 });
  try {
    const result = await loadWordPressExperienceRegistry(root);
    assert.deepEqual(result.experiences.map((entry) => entry.id), ['synthetic-basic']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
