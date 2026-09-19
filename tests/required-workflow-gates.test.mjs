import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_WORKFLOW_GATES,
  assertWorkflowGateSource,
  extractJobBlock,
  readNeeds
} from '../tools/check-required-workflow-gates.mjs';

function sourceFor(contract, {
  name = contract.checkName,
  always = true,
  needs = contract.needs
} = {}) {
  const dependencies = contract.needs
    .map((dependency) => `  ${dependency}:\n    runs-on: ubuntu-latest\n`)
    .join('\n');

  return [
    'jobs:',
    dependencies.trimEnd(),
    `  ${contract.jobId}:`,
    `    name: ${name}`,
    `    if: ${always ? 'always()' : 'success()'}`,
    '    needs:',
    ...needs.map((dependency) => `      - ${dependency}`),
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: true',
    ''
  ].join('\n');
}

test('R28 declares four stable required workflow check names', () => {
  assert.deepEqual(
    REQUIRED_WORKFLOW_GATES.map((gate) => gate.checkName),
    ['CiM / Verify', 'CiM / Floor QA', 'CiM / Browser E2E', 'CiM / Playground']
  );
  assert.equal(new Set(REQUIRED_WORKFLOW_GATES.map((gate) => gate.checkName)).size, 4);
});

test('R28 workflow gate parser extracts exact gate block and dependencies', () => {
  const contract = REQUIRED_WORKFLOW_GATES[0];
  const source = sourceFor(contract);
  const block = extractJobBlock(source, contract.jobId);

  assert.deepEqual(readNeeds(block, contract.jobId), contract.needs);
  assert.equal(assertWorkflowGateSource(source, contract), true);
});

test('R28 workflow gate contract rejects a renamed required check', () => {
  const contract = REQUIRED_WORKFLOW_GATES[1];
  assert.throws(
    () => assertWorkflowGateSource(sourceFor(contract, { name: 'Floor QA' }), contract),
    /must expose check name CiM \/ Floor QA/
  );
});

test('R28 workflow gate contract rejects a dropped dependency', () => {
  const contract = REQUIRED_WORKFLOW_GATES[2];
  assert.throws(
    () => assertWorkflowGateSource(
      sourceFor(contract, { needs: contract.needs.slice(0, -1) }),
      contract
    ),
    /needs must be exactly/
  );
});

test('R28 workflow gate contract rejects conditional execution', () => {
  const contract = REQUIRED_WORKFLOW_GATES[3];
  assert.throws(
    () => assertWorkflowGateSource(sourceFor(contract, { always: false }), contract),
    /must use if: always\(\)/
  );
});
