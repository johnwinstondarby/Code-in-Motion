import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ingestExperience } from '../src/experience/ingest-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_RELATIVE_PATH = 'wordpress/experiences/registry.json';
const EXPERIENCE_DIRECTORY_RELATIVE_PATH = 'wordpress/experiences';
const BROWSER_PROJECTION_RELATIVE_PATH = 'wordpress/assets/experience-registry.generated.mjs';
const REGISTRY_SCHEMA = 'localis.cim/wordpress-experience-registry/v1';
const REGISTRY_KEYS = Object.freeze(['schema', 'experiences']);
const ENTRY_KEYS = Object.freeze(['id', 'asset']);
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const CANONICAL_PROJECTIONS = Object.freeze(new Map([
  ['git-basic-cycle', 'experiences/git/git-basic-cycle.json']
]));
const LEGACY_DEPLOYMENT_IDENTIFIERS = Object.freeze([
  'EXPERIENCE' + '_PATHS',
  'EXPERIENCE' + '_SOURCES'
]);
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.json', '.md', '.php', '.txt', '.yml', '.yaml']);
const SCAN_SKIP_DIRECTORIES = new Set(['.git', '.ci', 'dist', 'node_modules']);

function fail(message) {
  throw new Error('R30 WordPress Experience registry: ' + message);
}
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) fail(label + ' must be a plain object.');
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) fail(label + ' must not contain symbol keys.');
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    fail(label + ' must contain exactly: ' + expected.join(', ') + '.');
  }
}
function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
function portablePath(path) {
  return relative(ROOT, path).split(sep).join('/');
}
async function readRequiredText(path, label) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { fail(label + ' is unavailable: ' + error.message); }
}
function parseJson(text, label) {
  try { return JSON.parse(text); }
  catch (error) { fail(label + ' is not valid JSON: ' + error.message); }
}
export function validateWordPressExperienceRegistryData(registry) {
  assertExactKeys(registry, REGISTRY_KEYS, 'registry');
  if (registry.schema !== REGISTRY_SCHEMA) {
    fail('registry.schema must be ' + JSON.stringify(REGISTRY_SCHEMA) + '.');
  }
  if (!Array.isArray(registry.experiences) || registry.experiences.length === 0) {
    fail('registry.experiences must be a non-empty array.');
  }
  const ids = new Set();
  const assets = new Set();
  let previousId = null;
  const entries = registry.experiences.map((entry, index) => {
    const label = 'registry.experiences[' + index + ']';
    assertExactKeys(entry, ENTRY_KEYS, label);
    if (typeof entry.id !== 'string' || !IDENTIFIER_PATTERN.test(entry.id)) {
      fail(label + '.id must be a canonical CiM identifier.');
    }
    if (typeof entry.asset !== 'string' || !ASSET_PATTERN.test(entry.asset)) {
      fail(label + '.asset must be one lowercase JSON file name.');
    }
    if (ids.has(entry.id)) fail('duplicate registry Experience ID: ' + entry.id + '.');
    if (assets.has(entry.asset)) fail('duplicate registry asset: ' + entry.asset + '.');
    if (previousId !== null && compareText(previousId, entry.id) >= 0) {
      fail('registry.experiences must be sorted by Experience ID.');
    }
    ids.add(entry.id);
    assets.add(entry.asset);
    previousId = entry.id;
    return Object.freeze({ id: entry.id, asset: entry.asset });
  });
  return Object.freeze(entries);
}
export function browserProjectionSource(entries) {
  return 'export const WORDPRESS_EXPERIENCE_REGISTRY = Object.freeze([\n' +
    entries.map((entry) =>
      '  Object.freeze({ id: ' + JSON.stringify(entry.id) +
      ', asset: ' + JSON.stringify(entry.asset) + ' })'
    ).join(',\n') +
    '\n]);\n';
}
function assertExactAssetSet(entries, directoryEntries) {
  const expected = entries.map((entry) => entry.asset).sort(compareText);
  const actual = [];
  for (const entry of directoryEntries) {
    if (entry.name === 'registry.json' || !entry.name.endsWith('.json')) continue;
    if (!entry.isFile()) fail('deployment JSON path must be a regular file: ' + entry.name + '.');
    actual.push(entry.name);
  }
  actual.sort(compareText);
  if (actual.length !== expected.length || expected.some((name, index) => actual[index] !== name)) {
    fail('wordpress/experiences deployment set must equal the registry exactly; expected [' +
      expected.join(', ') + '], found [' + actual.join(', ') + '].');
  }
}
async function validateDeploymentEntry(root, experienceDirectory, entry) {
  const assetPath = resolve(experienceDirectory, entry.asset);
  const assetText = await readRequiredText(assetPath, 'registered Experience asset ' + entry.asset);
  const raw = parseJson(assetText, 'registered Experience asset ' + entry.asset);
  let experience;
  try { experience = ingestExperience(raw); }
  catch (error) {
    fail('registered Experience asset ' + entry.asset +
      ' failed production ingestion: ' + error.message);
  }
  if (experience.id !== entry.id) {
    fail('registry identity mismatch for ' + entry.asset +
      ': expected ' + entry.id + ', received ' + String(experience.id) + '.');
  }
  const canonicalRelativePath = CANONICAL_PROJECTIONS.get(entry.id);
  if (canonicalRelativePath !== undefined) {
    const canonicalText = await readRequiredText(
      resolve(root, ...canonicalRelativePath.split('/')),
      'canonical projection source for ' + entry.id
    );
    if (assetText !== canonicalText) fail(entry.asset + ' is stale relative to ' + canonicalRelativePath + '.');
  }
  return Object.freeze({ id: entry.id, asset: entry.asset, renderer: experience.renderer });
}
async function assertLegacyDeploymentIdentifiersAbsent(root) {
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      if (entry.isDirectory() && SCAN_SKIP_DIRECTORIES.has(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) { await visit(path); continue; }
      if (!entry.isFile() || !TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const source = await readFile(path, 'utf8');
      for (const identifier of LEGACY_DEPLOYMENT_IDENTIFIERS) {
        if (source.includes(identifier)) {
          fail('retired handwritten deployment identifier remains in ' + portablePath(path) + '.');
        }
      }
    }
  }
  await visit(root);
}
export async function loadWordPressExperienceRegistry(root = ROOT) {
  const registryPath = resolve(root, ...REGISTRY_RELATIVE_PATH.split('/'));
  const experienceDirectory = resolve(root, ...EXPERIENCE_DIRECTORY_RELATIVE_PATH.split('/'));
  const registryText = await readRequiredText(registryPath, 'canonical registry');
  const registry = parseJson(registryText, 'canonical registry');
  const entries = validateWordPressExperienceRegistryData(registry);
  let directoryEntries;
  try { directoryEntries = await readdir(experienceDirectory, { withFileTypes: true }); }
  catch (error) { fail('Experience deployment directory is unavailable: ' + error.message); }
  assertExactAssetSet(entries, directoryEntries);
  const validated = [];
  for (const entry of entries) validated.push(await validateDeploymentEntry(root, experienceDirectory, entry));
  return Object.freeze({ schema: REGISTRY_SCHEMA, experiences: Object.freeze(validated) });
}
export async function validateWordPressExperienceRegistry(root = ROOT) {
  const result = await loadWordPressExperienceRegistry(root);
  const projectionPath = resolve(root, ...BROWSER_PROJECTION_RELATIVE_PATH.split('/'));
  const actualProjection = await readRequiredText(projectionPath, 'browser registry projection');
  const expectedProjection = browserProjectionSource(result.experiences);
  if (actualProjection !== expectedProjection) {
    fail(BROWSER_PROJECTION_RELATIVE_PATH +
      ' is stale; run npm run generate:wordpress-experience-registry.');
  }
  await assertLegacyDeploymentIdentifiersAbsent(root);
  return result;
}
export async function generateWordPressExperienceRegistryProjection(root = ROOT) {
  const result = await loadWordPressExperienceRegistry(root);
  const projectionPath = resolve(root, ...BROWSER_PROJECTION_RELATIVE_PATH.split('/'));
  await writeFile(projectionPath, browserProjectionSource(result.experiences), 'utf8');
  await validateWordPressExperienceRegistry(root);
  return result;
}
export async function runWordPressExperienceRegistryCheck(root = ROOT) {
  const result = await validateWordPressExperienceRegistry(root);
  console.log('PASS: R30 WordPress Experience registry (' +
    result.experiences.length + ' registered Experience(s), generated browser projection current).');
  return result;
}
const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const args = process.argv.slice(2);
  const write = args.length === 1 && args[0] === '--write';
  if (args.length > 0 && !write) {
    console.error('Usage: node tools/check-wordpress-experience-registry.mjs [--write]');
    process.exitCode = 2;
  } else {
    const operation = write
      ? generateWordPressExperienceRegistryProjection()
      : runWordPressExperienceRegistryCheck();
    operation.then((result) => {
      if (write) {
        console.log('Generated R30 WordPress Experience browser projection (' +
          result.experiences.length + ' registered Experience(s)).');
      }
    }).catch((error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 1;
    });
  }
}
