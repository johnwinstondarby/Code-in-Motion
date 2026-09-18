import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildPage3227GitAdapter } from '../tools/generate-page-3227-git-adapter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('R27 page 3227 adapter is generated from the shared projection', async () => {
  const projection = JSON.parse(
    await readFile(resolve(ROOT, 'authoring', 'generated', 'page-3227-git-reference.json'), 'utf8')
  );
  const generated = await readFile(
    resolve(ROOT, 'authoring', 'generated', 'page-3227-git-adapter.js'),
    'utf8'
  );

  assert.equal(buildPage3227GitAdapter(projection), generated);
  assert.match(generated, /@cim-shared-source page-3227 v1/);
  assert.match(generated, /#cim\/git-basic-cycle\/step-01/);
  assert.match(generated, /#cim\/git-basic-cycle\/step-08/);
});

test('R27 page 3227 projection exposes eight explicit semantic links', async () => {
  const projection = JSON.parse(
    await readFile(resolve(ROOT, 'authoring', 'generated', 'page-3227-git-reference.json'), 'utf8')
  );

  assert.equal(projection.anchors.length, 8);
  assert.deepEqual(
    projection.anchors.map((anchor) => anchor.cim_step_id),
    ['step-01','step-02','step-03','step-04','step-05','step-06','step-07','step-08']
  );
  assert.equal(new Set(projection.anchors.map((anchor) => anchor.id)).size, 8);
  assert.ok(projection.anchors.every((anchor) => anchor.references.length > 0));
});
