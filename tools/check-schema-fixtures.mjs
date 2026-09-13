import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

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

const ASCII_SPACE_OR_CONTROL = /[\u0000-\u0020\u007f]/g;
const ALLOWED_LINK_PREFIX = /^(?:https?:\/\/|mailto:|\/|#)/i;

function readJsonSync(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const PUBLISHED_SCHEMA = readJsonSync(SCHEMA_PATH);
const AJV = new Ajv2020({ allErrors: true, strict: true });
const VALIDATE_SCHEMA = AJV.compile(PUBLISHED_SCHEMA);

function addError(errors, code, path, message, source = 'semantic') {
  errors.push({ code, path, message, source });
}

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

function normalizedHref(value) {
  return value.replace(ASCII_SPACE_OR_CONTROL, '');
}

function semanticErrorsFor(experience) {
  const errors = [];
  if (!experience || typeof experience !== 'object' || Array.isArray(experience)) return errors;
  if (!Array.isArray(experience.steps)) return errors;

  const seenStepIds = new Set();

  experience.steps.forEach((step, stepIndex) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return;
    const stepPath = `$.steps[${stepIndex}]`;

    if (typeof step.id === 'string') {
      if (seenStepIds.has(step.id)) {
        addError(errors, 'CIM-EXP-003', `${stepPath}.id`, `Duplicate step id: ${step.id}`);
      } else {
        seenStepIds.add(step.id);
      }
    }

    const links = step.commentary?.links;
    if (!Array.isArray(links)) return;

    const seenLinkIds = new Set();
    links.forEach((link, linkIndex) => {
      if (!link || typeof link !== 'object' || Array.isArray(link)) return;
      const linkPath = `${stepPath}.commentary.links[${linkIndex}]`;

      if (typeof link.id === 'string') {
        if (seenLinkIds.has(link.id)) {
          addError(errors, 'CIM-EXP-006', `${linkPath}.id`, 'Link ids must be unique within one commentary entry.');
        } else {
          seenLinkIds.add(link.id);
        }
      }

      if (typeof link.href === 'string') {
        const normalized = normalizedHref(link.href);
        if (!ALLOWED_LINK_PREFIX.test(normalized)) {
          addError(
            errors,
            'CIM-EXP-006',
            `${linkPath}.href`,
            'Link href must resolve to http, https, mailto, root-relative, or fragment navigation.'
          );
        }
      }
    });
  });

  return errors;
}

export function validateAgainstPublishedSchema(experience) {
  return schemaErrorsFor(experience);
}

export function validateExperience(experience) {
  return [...schemaErrorsFor(experience), ...semanticErrorsFor(experience)];
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
    const errors = validateExperience(value);
    if (errors.length > 0) {
      throw new Error(`Valid fixture ${name} failed:\n${JSON.stringify(errors, null, 2)}`);
    }
  }

  for (const name of invalidFiles) {
    const expectedCode = INVALID_EXPECTATIONS.get(name);
    if (!expectedCode) throw new Error(`Invalid fixture ${name} has no expected error-code mapping.`);

    const value = await readJson(join(INVALID_DIR, name));
    const errors = validateExperience(value);
    const codes = distinctCodes(errors);

    if (codes.length !== 1 || codes[0] !== expectedCode) {
      throw new Error(
        `Invalid fixture ${name} expected only ${expectedCode}, got ${codes.join(', ') || 'no errors'}.\n` +
        JSON.stringify(errors, null, 2)
      );
    }
  }

  for (const expectedName of INVALID_EXPECTATIONS.keys()) {
    if (!invalidFiles.includes(expectedName)) throw new Error(`Expected invalid fixture is missing: ${expectedName}`);
  }

  console.log(`PASS: published schema + semantic contract (${validFiles.length} valid fixtures, ${invalidFiles.length} invalid fixtures)`);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  run().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
