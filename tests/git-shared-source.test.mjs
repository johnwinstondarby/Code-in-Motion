import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildGitBasicCycleExperience,
  buildPage3227Projection
} from '../tools/generate-git-basic-cycle.mjs';
import { validateExperience } from '../src/experience/validate-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(path) {
  return JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
}

async function loadInputs() {
  const [facts, plan, pageProjection, experience] = await Promise.all([
    readJson('authoring/git/git-subject-facts.json'),
    readJson('authoring/git/git-basic-cycle.plan.json'),
    readJson('authoring/generated/page-3227-git-reference.json'),
    readJson('experiences/git/git-basic-cycle.json')
  ]);
  return { facts, plan, pageProjection, experience };
}

test('R27 page 3227 and CiM projections are generated from the same Git facts', async () => {
  const { facts, plan, pageProjection, experience } = await loadInputs();
  assert.deepEqual(buildPage3227Projection(facts, plan), pageProjection);
  assert.deepEqual(buildGitBasicCycleExperience(facts, plan), experience);
});

test('R27 Git basic-cycle experience satisfies the production experience contract', async () => {
  const { experience } = await loadInputs();
  assert.deepEqual(validateExperience(experience), []);
  assert.equal(experience.id, 'git-basic-cycle');
  assert.equal(experience.renderer, 'git/v1');
});

test('R27 page 3227 projection preserves the authoritative eight-anchor roster', async () => {
  const { pageProjection } = await loadInputs();
  assert.deepEqual(
    pageProjection.anchors.map((anchor) => anchor.command),
    [
      'git status',
      'git diff',
      'git add',
      'git commit',
      'git rev-parse HEAD',
      'git tag v1.2',
      'git push',
      'git reflog'
    ]
  );
});

test('R27 shared add fact carries patch staging and intent-to-add guidance', async () => {
  const { facts } = await loadInputs();
  const add = facts.facts.find((fact) => fact.id === 'add');
  assert.ok(add);
  assert.match(add.description, /git add -p/);
  assert.match(add.description, /git add -N <path>/);
  assert.equal(add.references[0].href, 'https://git-scm.com/docs/git-add');
});

test('R27 observation steps preserve Git state while mutating steps change it', async () => {
  const { facts, plan } = await loadInputs();
  const byId = new Map(facts.facts.map((fact) => [fact.id, fact]));
  let previousState = plan.initial_state;

  for (const step of plan.steps) {
    const fact = byId.get(step.factId);
    assert.ok(fact);
    if (fact.stateEffect === 'observe') {
      assert.deepEqual(step.state, previousState, fact.id + ' must preserve subject state');
    } else {
      assert.notDeepEqual(step.state, previousState, fact.id + ' must change subject state');
    }
    previousState = step.state;
  }
});

test('R27 page anchors carry deterministic CiM deep-link step identities', async () => {
  const { pageProjection, experience } = await loadInputs();
  assert.deepEqual(
    pageProjection.anchors.map((anchor) => anchor.cim_step_id),
    experience.steps.map((step) => step.id)
  );
  assert.equal(new Set(experience.steps.map((step) => step.id)).size, experience.steps.length);
});
