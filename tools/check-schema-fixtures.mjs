import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { validateExperience as validateProductionExperience } from '../src/experience/validate-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(ROOT, 'schemas', 'localis.cim.v1.schema.json');
const VALID_DIR = join(ROOT, 'schemas', 'fixtures', 'valid');
const INVALID_DIR = join(ROOT, 'schemas', 'fixtures', 'invalid');

const INVALID_EXPECTATIONS = new Map([
  ['unsupported-schema.json', 'CIM-EXP-001'],
  ['missing-state.json', 'CIM-EXP-002'],
  ['empty-steps.json', 'CIM-EXP-002'],
  ['invalid-renderer.json', 'CIM-EXP-002'],
  ['missing-commentary-links.json', 'CIM-EXP-002'],
  ['null-initial-state.json', 'CIM-EXP-002'],
  ['null-step-state.json', 'CIM-EXP-002'],
  ['duplicate-step-id.json', 'CIM-EXP-003'],
  ['reserved-initial-step.json', 'CIM-EXP-004'],
  ['negative-dwell.json', 'CIM-EXP-005'],
  ['javascript-link.json', 'CIM-EXP-006'],
  ['javascript-tab-link.json', 'CIM-EXP-006'],
  ['javascript-control-link.json', 'CIM-EXP-006'],
  ['blob-link.json', 'CIM-EXP-006'],
  ['invalid-link-text.json', 'CIM-EXP-006']
]);

function readJsonSync(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const PUBLISHED_SCHEMA = readJsonSync(SCHEMA_PATH);
const AJV = new Ajv2020({ allErrors: true, strict: true });
const VALIDATE_SCHEMA = AJV.compile(PUBLISHED_SCHEMA);

function schemaErrorCode(error) {
  const path = error.instancePath ?? '';

  if (path === '/schema' && error.keyword === 'const') return 'CIM-EXP-001';
  if (path.endsWith('/dwell_ms')) return 'CIM-EXP-005';
  if (path.endsWith('/id') && error.keyword === 'not') return 'CIM-EXP-004';
  if (path.includes('/commentary/links/')) return 'CIM-EXP-006';
  if (path.endsWith('/href')) return 'CIM-EXP-006';
  return 'CIM-EXP-002';
}

function schemaErrorsFor(experience) {
  const valid = VALIDATE_SCHEMA(experience);
  if (valid) return [];

  return (VALIDATE_SCHEMA.errors ?? []).map((error) => ({
    code: schemaErrorCode(error),
    path: error.instancePath || '$',
    message: error.message ?? error.keyword,
    source: 'schema'
  }));
}

export function validateAgainstPublishedSchema(experience) {
  return schemaErrorsFor(experience);
}

export function validateExperience(experience) {
  return validateProductionExperience(experience);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function distinctCodes(errors) {
  return [...new Set(errors.map((error) => error.code))].sort();
}

async function run() {
  const validFiles = (await readdir(VALID_DIR)).filter((name) => name.endsWith('.json')).sort();
  const invalidFiles = (await readdir(INVALID_DIR)).filter((name) => name.endsWith('.json')).sort();

  if (validFiles.length === 0) throw new Error('No valid schema fixtures found.');

  for (const name of validFiles) {
    const value = await readJson(join(VALID_DIR, name));
    const publishedErrors = validateAgainstPublishedSchema(value);
    const productionErrors = validateProductionExperience(value);
    if (publishedErrors.length > 0 || productionErrors.length > 0) {
      throw new Error(
        `Valid fixture ${name} failed:\n` +
        JSON.stringify({ publishedErrors, productionErrors }, null, 2)
      );
    }
  }

  for (const name of invalidFiles) {
    const expectedCode = INVALID_EXPECTATIONS.get(name);
    if (!expectedCode) throw new Error(`Invalid fixture ${name} has no expected error-code mapping.`);

    const value = await readJson(join(INVALID_DIR, name));
    const errors = validateProductionExperience(value);
    const codes = distinctCodes(errors);

    if (codes.length !== 1 || codes[0] !== expectedCode) {
      throw new Error(
        `Invalid fixture ${name} expected only ${expectedCode}, got ${codes.join(', ') || 'no errors'}.\n` +
        JSON.stringify(errors, null, 2)
      );
    }

    const publishedCodes = distinctCodes(validateAgainstPublishedSchema(value));
    if (expectedCode !== 'CIM-EXP-003' && publishedCodes.length > 0 && !publishedCodes.includes(expectedCode)) {
      throw new Error(
        `Published schema disagrees with production validation for ${name}: expected ${expectedCode}, got ${publishedCodes.join(', ')}.`
      );
    }
  }

  for (const expectedName of INVALID_EXPECTATIONS.keys()) {
    if (!invalidFiles.includes(expectedName)) throw new Error(`Expected invalid fixture is missing: ${expectedName}`);
  }

  console.log(`PASS: published schema + production validation contract (${validFiles.length} valid fixtures, ${invalidFiles.length} invalid fixtures)`);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  run().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
