import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const REQUIRED_WORKFLOW_GATES = Object.freeze([
  Object.freeze({
    path: '.github/workflows/verify.yml',
    jobId: 'required-verify-gate',
    checkName: 'CiM / Verify',
    needs: Object.freeze(['verify', 'release-build', 'release-reproducibility'])
  }),
  Object.freeze({
    path: '.github/workflows/wordpress-floor-qa.yml',
    jobId: 'required-floor-qa-gate',
    checkName: 'CiM / Floor QA',
    needs: Object.freeze(['wordpress-floor', 'plugin-check'])
  }),
  Object.freeze({
    path: '.github/workflows/wordpress-e2e.yml',
    jobId: 'required-browser-e2e-gate',
    checkName: 'CiM / Browser E2E',
    needs: Object.freeze([
      'synthetic-mount',
      'zip-install-e2e',
      'upgrade-e2e',
      'compatibility-matrix',
      'php-matrix',
      'browser-family-matrix'
    ])
  }),
  Object.freeze({
    path: '.github/workflows/playground-preview.yml',
    jobId: 'required-playground-gate',
    checkName: 'CiM / Playground',
    needs: Object.freeze(['preview'])
  })
]);

function fail(message) {
  throw new Error('R28 workflow-gate contract: ' + message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[]\\]/g, '\\$&');
}

export function extractJobBlock(source, jobId) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === '  ' + jobId + ':');
  if (start < 0) fail('missing job ' + jobId + '.');

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

export function readNeeds(block, jobId) {
  const lines = block.split('\n');
  const marker = lines.findIndex((line) => line === '    needs:');
  if (marker < 0) fail('job ' + jobId + ' has no needs block.');

  const needs = [];
  for (let index = marker + 1; index < lines.length; index += 1) {
    const match = /^      - ([A-Za-z0-9_-]+)$/.exec(lines[index]);
    if (match) {
      needs.push(match[1]);
      continue;
    }
    if (/^    \S/.test(lines[index])) break;
  }
  return needs;
}

export function assertWorkflowGateSource(source, contract) {
  const block = extractJobBlock(source, contract.jobId);

  const namePattern = new RegExp(
    '^    name: ' + escapeRegExp(contract.checkName) + '$',
    'm'
  );
  if (!namePattern.test(block)) {
    fail(contract.jobId + ' must expose check name ' + contract.checkName + '.');
  }

  if (!/^    if: always\(\)$/m.test(block)) {
    fail(contract.jobId + ' must use if: always().');
  }

  const needs = readNeeds(block, contract.jobId);
  if (JSON.stringify(needs) !== JSON.stringify(contract.needs)) {
    fail(
      contract.jobId + ' needs must be exactly [' + contract.needs.join(', ') +
      '], found [' + needs.join(', ') + '].'
    );
  }

  for (const dependency of contract.needs) {
    const dependencyPattern = new RegExp(
      '^  ' + escapeRegExp(dependency) + ':$',
      'm'
    );
    if (!dependencyPattern.test(source)) {
      fail(contract.jobId + ' references missing job ' + dependency + '.');
    }
  }

  return true;
}

export async function checkRequiredWorkflowGates({ root = ROOT } = {}) {
  const names = new Set();
  for (const contract of REQUIRED_WORKFLOW_GATES) {
    if (names.has(contract.checkName)) {
      fail('duplicate required check name ' + contract.checkName + '.');
    }
    names.add(contract.checkName);

    const source = await readFile(resolve(root, contract.path), 'utf8');
    assertWorkflowGateSource(source, contract);
  }

  console.log(
    'PASS: R28 required workflow gates (' +
    [...names].join(', ') +
    ').'
  );
}

const invokedAsScript =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  checkRequiredWorkflowGates().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
