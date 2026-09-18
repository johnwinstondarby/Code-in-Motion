import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateExperience } from '../src/experience/validate-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FACTS_PATH = resolve(ROOT, 'authoring', 'git', 'git-subject-facts.json');
const PLAN_PATH = resolve(ROOT, 'authoring', 'git', 'git-basic-cycle.plan.json');
const PAGE_OUTPUT_PATH = resolve(ROOT, 'authoring', 'generated', 'page-3227-git-reference.json');
const EXPERIENCE_OUTPUT_PATH = resolve(ROOT, 'experiences', 'git', 'git-basic-cycle.json');

function fail(message) {
  throw new Error('R27 Git shared-source gate: ' + message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(label + ' must be a non-empty string.');
}

function validateReference(reference, label) {
  if (!isObject(reference)) fail(label + ' must be an object.');
  requireNonEmptyString(reference.id, label + '.id');
  requireNonEmptyString(reference.label, label + '.label');
  requireNonEmptyString(reference.href, label + '.href');
  if (!/^https:\/\/git-scm\.com\/docs\//.test(reference.href)) {
    fail(label + '.href must use the canonical git-scm.com documentation surface.');
  }
}

function indexFacts(source) {
  if (!isObject(source)) fail('subject facts source must be an object.');
  if (source.source_schema !== 'localis.git-subject-facts/v1') fail('unsupported subject facts schema.');
  if (source.page_id !== 3227) fail('subject facts must identify Localis page 3227.');
  requireNonEmptyString(source.source_version, 'source_version');
  if (!Array.isArray(source.facts) || source.facts.length === 0) fail('facts must be a non-empty array.');

  const byId = new Map();
  for (const fact of source.facts) {
    if (!isObject(fact)) fail('each fact must be an object.');
    for (const key of ['id', 'command', 'verb', 'description', 'stateEffect']) {
      requireNonEmptyString(fact[key], 'fact.' + key);
    }
    if (byId.has(fact.id)) fail('duplicate fact id: ' + fact.id);
    if (!Array.isArray(fact.references) || fact.references.length === 0) {
      fail('fact ' + fact.id + ' must contain at least one reference.');
    }
    fact.references.forEach((reference, index) => validateReference(reference, 'fact ' + fact.id + ' references[' + index + ']'));
    byId.set(fact.id, fact);
  }
  return byId;
}

function validatePlan(plan, byId) {
  if (!isObject(plan)) fail('Git basic-cycle plan must be an object.');
  if (plan.plan_schema !== 'localis.git-basic-cycle-plan/v1') fail('unsupported Git basic-cycle plan schema.');
  if (plan.experience_id !== 'git-basic-cycle') fail('experience_id must be git-basic-cycle.');
  if (plan.renderer !== 'git/v1') fail('renderer must be git/v1.');
  requireNonEmptyString(plan.engine_min, 'engine_min');
  requireNonEmptyString(plan.experience_version, 'experience_version');
  if (!isObject(plan.renderer_config)) fail('renderer_config must be an object.');
  if (!isObject(plan.initial_state)) fail('initial_state must be an object.');
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) fail('steps must be a non-empty array.');

  const seenFacts = new Set();
  const seenSteps = new Set();
  let previousState = plan.initial_state;

  for (const step of plan.steps) {
    if (!isObject(step)) fail('each plan step must be an object.');
    requireNonEmptyString(step.factId, 'step.factId');
    requireNonEmptyString(step.stepId, 'step.stepId');
    requireNonEmptyString(step.commentary, 'step.commentary');
    requireNonEmptyString(step.focus, 'step.focus');
    if (!isObject(step.state)) fail('step.state must be an object.');

    const fact = byId.get(step.factId);
    if (!fact) fail('plan references unknown fact: ' + step.factId);
    if (seenFacts.has(step.factId)) fail('plan repeats fact: ' + step.factId);
    if (seenSteps.has(step.stepId)) fail('plan repeats step id: ' + step.stepId);
    seenFacts.add(step.factId);
    seenSteps.add(step.stepId);

    const previous = JSON.stringify(previousState);
    const current = JSON.stringify(step.state);
    if (fact.stateEffect === 'observe' && current !== previous) {
      fail('observe fact ' + fact.id + ' must preserve the preceding Git state.');
    }
    if (fact.stateEffect !== 'observe' && current === previous) {
      fail('mutating fact ' + fact.id + ' must change the preceding Git state.');
    }

    previousState = step.state;
  }

  if (seenFacts.size !== byId.size) {
    fail('plan must project every page-3227 Git fact exactly once.');
  }
}

export function buildPage3227Projection(source, plan) {
  const byId = indexFacts(source);
  validatePlan(plan, byId);

  return {
    source_schema: 'localis.page-3227-git-reference/v1',
    source_version: source.source_version,
    page_id: source.page_id,
    experience_id: plan.experience_id,
    anchors: plan.steps.map((step) => {
      const fact = byId.get(step.factId);
      return {
        id: fact.id,
        command: fact.command,
        verb: fact.verb,
        description: fact.description,
        stateEffect: fact.stateEffect,
        references: fact.references,
        cim_step_id: step.stepId
      };
    })
  };
}

export function buildGitBasicCycleExperience(source, plan) {
  const byId = indexFacts(source);
  validatePlan(plan, byId);

  const experience = {
    schema: 'localis.cim/v1',
    engine_min: plan.engine_min,
    experience_version: plan.experience_version,
    id: plan.experience_id,
    renderer: plan.renderer,
    renderer_config: plan.renderer_config,
    initial_state: plan.initial_state,
    steps: plan.steps.map((step) => {
      const fact = byId.get(step.factId);
      return {
        id: step.stepId,
        label: fact.command,
        marker: fact.verb,
        commentary: {
          text: step.commentary,
          links: fact.references
        },
        state: step.state,
        renderer_config: {
          focus: step.focus
        }
      };
    })
  };

  const errors = validateExperience(experience);
  if (errors.length > 0) {
    fail('generated CiM experience failed localis.cim/v1 validation:\n' + JSON.stringify(errors, null, 2));
  }
  return experience;
}

export async function generateGitBasicCycle({ check = false } = {}) {
  const source = await readJson(FACTS_PATH);
  const plan = await readJson(PLAN_PATH);
  const pageProjection = buildPage3227Projection(source, plan);
  const experience = buildGitBasicCycleExperience(source, plan);

  const outputs = [
    [PAGE_OUTPUT_PATH, stableJson(pageProjection)],
    [EXPERIENCE_OUTPUT_PATH, stableJson(experience)]
  ];

  if (check) {
    for (const [path, expected] of outputs) {
      const actual = await readFile(path, 'utf8');
      if (actual !== expected) {
        fail(path.slice(ROOT.length + 1) + ' is stale; run npm run generate:git-basic-cycle.');
      }
    }
    console.log('PASS: R27 Git shared-source projections are current (page 3227 + git-basic-cycle).');
    return;
  }

  for (const [path, output] of outputs) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output, 'utf8');
  }
  console.log('Generated page 3227 Git reference and git-basic-cycle experience.');
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  generateGitBasicCycle({ check: process.argv.includes('--check') }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
