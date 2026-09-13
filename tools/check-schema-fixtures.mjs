import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(ROOT, 'schemas', 'localis.cim.v1.schema.json');
const VALID_DIR = join(ROOT, 'schemas', 'fixtures', 'valid');
const INVALID_DIR = join(ROOT, 'schemas', 'fixtures', 'invalid');

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RENDERER_ID = /^[a-z0-9][a-z0-9-]*\/v[1-9][0-9]*$/;
const UNSAFE_SCHEME = /^\s*(?:javascript|data|vbscript):/i;

const INVALID_EXPECTATIONS = new Map([
  ['unsupported-schema.json', 'CIM-EXP-001'],
  ['missing-state.json', 'CIM-EXP-002'],
  ['duplicate-step-id.json', 'CIM-EXP-003'],
  ['reserved-initial-step.json', 'CIM-EXP-004'],
  ['negative-dwell.json', 'CIM-EXP-005'],
  ['javascript-link.json', 'CIM-EXP-006']
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function checkAllowedKeys(value, allowed, errors, code, path) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addError(errors, code, `${path}.${key}`, `Unexpected field: ${key}`);
    }
  }
}

function validateLink(link, path, errors, seenLinkIds) {
  if (!isObject(link)) {
    addError(errors, 'CIM-EXP-006', path, 'Commentary link must be an object.');
    return;
  }

  checkAllowedKeys(link, new Set(['id', 'label', 'href']), errors, 'CIM-EXP-006', path);

  for (const field of ['id', 'label', 'href']) {
    if (!hasOwn(link, field)) {
      addError(errors, 'CIM-EXP-006', `${path}.${field}`, `Missing required link field: ${field}`);
    }
  }

  if (hasOwn(link, 'id')) {
    if (typeof link.id !== 'string' || !IDENTIFIER.test(link.id)) {
      addError(errors, 'CIM-EXP-006', `${path}.id`, 'Link id must use the shared identifier syntax.');
    } else if (seenLinkIds.has(link.id)) {
      addError(errors, 'CIM-EXP-006', `${path}.id`, 'Link ids must be unique within one commentary entry.');
    } else {
      seenLinkIds.add(link.id);
    }
  }

  if (hasOwn(link, 'label') && (typeof link.label !== 'string' || link.label.length === 0)) {
    addError(errors, 'CIM-EXP-006', `${path}.label`, 'Link label must be a non-empty string.');
  }

  if (hasOwn(link, 'href')) {
    if (typeof link.href !== 'string' || link.href.length === 0) {
      addError(errors, 'CIM-EXP-006', `${path}.href`, 'Link href must be a non-empty string.');
    } else if (UNSAFE_SCHEME.test(link.href)) {
      addError(errors, 'CIM-EXP-006', `${path}.href`, 'Executable link schemes are prohibited.');
    }
  }
}

function validateCommentary(commentary, path, errors) {
  if (!isObject(commentary)) {
    addError(errors, 'CIM-EXP-002', path, 'Commentary must be an object.');
    return;
  }

  checkAllowedKeys(commentary, new Set(['text', 'links']), errors, 'CIM-EXP-002', path);

  if (!hasOwn(commentary, 'text')) {
    addError(errors, 'CIM-EXP-002', `${path}.text`, 'Commentary text is required.');
  } else if (typeof commentary.text !== 'string' || commentary.text.length === 0) {
    addError(errors, 'CIM-EXP-002', `${path}.text`, 'Commentary text must be a non-empty string.');
  }

  if (!hasOwn(commentary, 'links')) {
    addError(errors, 'CIM-EXP-002', `${path}.links`, 'Commentary links array is required.');
    return;
  }

  if (!Array.isArray(commentary.links)) {
    addError(errors, 'CIM-EXP-002', `${path}.links`, 'Commentary links must be an array.');
    return;
  }

  const seenLinkIds = new Set();
  commentary.links.forEach((link, index) => {
    validateLink(link, `${path}.links[${index}]`, errors, seenLinkIds);
  });
}

export function validateExperience(experience) {
  const errors = [];

  if (!isObject(experience)) {
    addError(errors, 'CIM-EXP-002', '$', 'Experience must be an object.');
    return errors;
  }

  checkAllowedKeys(
    experience,
    new Set(['schema', 'engine_min', 'experience_version', 'id', 'renderer', 'renderer_config', 'initial_state', 'steps']),
    errors,
    'CIM-EXP-002',
    '$'
  );

  for (const field of ['schema', 'engine_min', 'experience_version', 'id', 'renderer', 'initial_state', 'steps']) {
    if (!hasOwn(experience, field)) {
      addError(errors, 'CIM-EXP-002', `$.${field}`, `Missing required top-level field: ${field}`);
    }
  }

  if (hasOwn(experience, 'schema') && experience.schema !== 'localis.cim/v1') {
    addError(errors, 'CIM-EXP-001', '$.schema', 'Unsupported schema identifier.');
  }

  for (const field of ['engine_min', 'experience_version']) {
    if (hasOwn(experience, field) && (typeof experience[field] !== 'string' || !SEMVER.test(experience[field]))) {
      addError(errors, 'CIM-EXP-002', `$.${field}`, `${field} must be a semantic version string.`);
    }
  }

  if (hasOwn(experience, 'id') && (typeof experience.id !== 'string' || !IDENTIFIER.test(experience.id))) {
    addError(errors, 'CIM-EXP-002', '$.id', 'Experience id must use lowercase letters, digits, and hyphens.');
  }

  if (hasOwn(experience, 'renderer') && (typeof experience.renderer !== 'string' || !RENDERER_ID.test(experience.renderer))) {
    addError(errors, 'CIM-EXP-002', '$.renderer', 'Renderer id must use the form name/vN.');
  }

  if (hasOwn(experience, 'renderer_config') && !isObject(experience.renderer_config)) {
    addError(errors, 'CIM-EXP-002', '$.renderer_config', 'renderer_config must be an object when present.');
  }

  if (!hasOwn(experience, 'steps')) return errors;

  if (!Array.isArray(experience.steps) || experience.steps.length === 0) {
    addError(errors, 'CIM-EXP-002', '$.steps', 'steps must be a non-empty array.');
    return errors;
  }

  const seenStepIds = new Set();

  experience.steps.forEach((step, index) => {
    const path = `$.steps[${index}]`;

    if (!isObject(step)) {
      addError(errors, 'CIM-EXP-002', path, 'Step must be an object.');
      return;
    }

    checkAllowedKeys(
      step,
      new Set(['id', 'label', 'marker', 'commentary', 'state', 'renderer_config', 'dwell_ms']),
      errors,
      'CIM-EXP-002',
      path
    );

    for (const field of ['id', 'label', 'commentary', 'state']) {
      if (!hasOwn(step, field)) {
        addError(errors, 'CIM-EXP-002', `${path}.${field}`, `Missing required step field: ${field}`);
      }
    }

    if (hasOwn(step, 'id')) {
      if (step.id === 'initial') {
        addError(errors, 'CIM-EXP-004', `${path}.id`, 'initial is a reserved semantic boundary id.');
      } else if (typeof step.id !== 'string' || !IDENTIFIER.test(step.id)) {
        addError(errors, 'CIM-EXP-002', `${path}.id`, 'Step id must use the shared identifier syntax.');
      }

      if (typeof step.id === 'string') {
        if (seenStepIds.has(step.id)) {
          addError(errors, 'CIM-EXP-003', `${path}.id`, `Duplicate step id: ${step.id}`);
        } else {
          seenStepIds.add(step.id);
        }
      }
    }

    if (hasOwn(step, 'label') && (typeof step.label !== 'string' || step.label.length === 0)) {
      addError(errors, 'CIM-EXP-002', `${path}.label`, 'Step label must be a non-empty string.');
    }

    if (hasOwn(step, 'marker') && (typeof step.marker !== 'string' || step.marker.length === 0)) {
      addError(errors, 'CIM-EXP-002', `${path}.marker`, 'Marker must be a non-empty string when present.');
    }

    if (hasOwn(step, 'renderer_config') && !isObject(step.renderer_config)) {
      addError(errors, 'CIM-EXP-002', `${path}.renderer_config`, 'renderer_config must be an object when present.');
    }

    if (hasOwn(step, 'dwell_ms') && (!Number.isInteger(step.dwell_ms) || step.dwell_ms < 0)) {
      addError(errors, 'CIM-EXP-005', `${path}.dwell_ms`, 'dwell_ms must be a non-negative integer.');
    }

    if (hasOwn(step, 'commentary')) {
      validateCommentary(step.commentary, `${path}.commentary`, errors);
    }
  });

  return errors;
}

function assertSchemaContract(schema) {
  const failures = [];

  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') failures.push('draft must be 2020-12');
  if (schema.properties?.schema?.const !== 'localis.cim/v1') failures.push('schema const must be localis.cim/v1');
  if (schema.$defs?.stepId?.allOf?.[1]?.not?.const !== 'initial') failures.push('initial must be reserved in stepId');
  if (schema.$defs?.step?.properties?.dwell_ms?.minimum !== 0) failures.push('dwell_ms minimum must be zero');
  if (!schema.$defs?.step?.required?.includes('state')) failures.push('step state must be required');
  if (!schema.$defs?.step?.required?.includes('commentary')) failures.push('step commentary must be required');
  if (!schema.required?.includes('initial_state')) failures.push('initial_state must be required');

  if (failures.length > 0) {
    throw new Error(`Schema contract check failed:\n- ${failures.join('\n- ')}`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function run() {
  const schema = await readJson(SCHEMA_PATH);
  assertSchemaContract(schema);

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

    if (!errors.some((error) => error.code === expectedCode)) {
      throw new Error(
        `Invalid fixture ${name} did not produce ${expectedCode}.\n${JSON.stringify(errors, null, 2)}`
      );
    }
  }

  for (const expectedName of INVALID_EXPECTATIONS.keys()) {
    if (!invalidFiles.includes(expectedName)) throw new Error(`Expected invalid fixture is missing: ${expectedName}`);
  }

  console.log(`PASS: schema contract (${validFiles.length} valid fixture, ${invalidFiles.length} invalid fixtures)`);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
