import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateExperience as validateProductionExperience } from '../src/experience/validate-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATHS = new Map([
  ['localis.cim/v1', join(ROOT, 'schemas', 'localis.cim.v1.schema.json')],
  ['localis.cim/v2', join(ROOT, 'schemas', 'localis.cim.v2.schema.json')]
]);
const VALID_DIR = join(ROOT, 'schemas', 'fixtures', 'valid');
const INVALID_DIR = join(ROOT, 'schemas', 'fixtures', 'invalid');
const V2_INVALID_DIR = join(ROOT, 'schemas', 'fixtures', 'v2-invalid');
const INVALID_EXPECTATIONS = new Map([
  ['unsupported-schema.json','CIM-EXP-001'],['missing-state.json','CIM-EXP-002'],['empty-steps.json','CIM-EXP-002'],['invalid-renderer.json','CIM-EXP-002'],['missing-commentary-links.json','CIM-EXP-002'],['null-initial-state.json','CIM-EXP-002'],['null-step-state.json','CIM-EXP-002'],['duplicate-step-id.json','CIM-EXP-003'],['reserved-initial-step.json','CIM-EXP-004'],['negative-dwell.json','CIM-EXP-005'],['javascript-link.json','CIM-EXP-006'],['javascript-tab-link.json','CIM-EXP-006'],['javascript-control-link.json','CIM-EXP-006'],['blob-link.json','CIM-EXP-006'],['invalid-link-text.json','CIM-EXP-006']
]);
const V2_EXPECTATIONS = new Map([
  ['malformed-generated-id.json','CIM-EXP-002'],
  ['generated-id-zero.json','CIM-EXP-010'],
  ['generated-id-mismatch.json','CIM-EXP-010'],
  ['grouping-inconsistent.json','CIM-EXP-009'],
  ['beat-noncontiguous.json','CIM-EXP-009'],
  ['segment-noncontiguous.json','CIM-EXP-009'],
  ['duplicate-final.json','CIM-EXP-011'],
  ['missing-final.json','CIM-EXP-011'],
  ['final-not-last.json','CIM-EXP-011'],
  ['beat-count-mismatch.json','CIM-EXP-012'],
  ['playback-rate-out-of-range.json','CIM-EXP-007']
]);
function readJsonSync(path) { return JSON.parse(readFileSync(path, 'utf8')); }
const AJV = new Ajv2020({ allErrors: true, strict: true });
const VALIDATORS = new Map([...SCHEMA_PATHS].map(([id,path]) => [id, AJV.compile(readJsonSync(path))]));
function schemaErrorCode(error, schema) {
  const path = error.instancePath ?? '';
  if (path === '/schema' && error.keyword === 'const') return 'CIM-EXP-001';
  if (path.endsWith('/dwell_ms')) return 'CIM-EXP-005';
  if (path.endsWith('/id') && error.keyword === 'not') return 'CIM-EXP-004';
  if (path.includes('/commentary/links/') || path.endsWith('/href')) return 'CIM-EXP-006';
  if (schema === 'localis.cim/v2' && path.startsWith('/presentation')) return 'CIM-EXP-007';
  if (schema === 'localis.cim/v2' && path.includes('/beat')) return 'CIM-EXP-008';
  return 'CIM-EXP-002';
}
export function validateAgainstPublishedSchema(experience) {
  const validate = VALIDATORS.get(experience?.schema);
  if (!validate) return [{ code:'CIM-EXP-001', path:'$.schema', message:'unsupported schema identifier.', source:'schema' }];
  if (validate(experience)) return [];
  return (validate.errors ?? []).map(error => ({ code:schemaErrorCode(error, experience.schema), path:error.instancePath || '$', message:error.message ?? error.keyword, source:'schema' }));
}
export function validateExperience(experience) { return validateProductionExperience(experience); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function distinctCodes(errors) { return [...new Set(errors.map(error => error.code))].sort(); }
async function assertInvalidDirectory(dir, expectations) {
  const files = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
  for (const name of files) {
    const expected = expectations.get(name); if (!expected) throw new Error(`Invalid fixture ${name} has no expected error-code mapping.`);
    const value = await readJson(join(dir,name)); const codes = distinctCodes(validateProductionExperience(value));
    if (codes.length !== 1 || codes[0] !== expected) throw new Error(`Invalid fixture ${name} expected only ${expected}, got ${codes.join(', ') || 'no errors'}.`);
  }
  for (const name of expectations.keys()) if (!files.includes(name)) throw new Error(`Expected invalid fixture is missing: ${name}`);
  return files.length;
}
async function run() {
  const validFiles = (await readdir(VALID_DIR)).filter(name => name.endsWith('.json')).sort();
  if (validFiles.length === 0) throw new Error('No valid schema fixtures found.');
  for (const name of validFiles) {
    const value = await readJson(join(VALID_DIR,name)); const publishedErrors = validateAgainstPublishedSchema(value); const productionErrors = validateProductionExperience(value);
    if (publishedErrors.length || productionErrors.length) throw new Error(`Valid fixture ${name} failed:\n${JSON.stringify({publishedErrors,productionErrors},null,2)}`);
  }
  const v1InvalidCount = await assertInvalidDirectory(INVALID_DIR, INVALID_EXPECTATIONS);
  const v2InvalidCount = await assertInvalidDirectory(V2_INVALID_DIR, V2_EXPECTATIONS);
  console.log(`PASS: published schemas + production validation contract (${validFiles.length} valid, ${v1InvalidCount} v1 invalid, ${v2InvalidCount} v2 invalid fixtures)`);
}
const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) run().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
