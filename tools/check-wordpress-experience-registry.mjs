import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ingestExperience } from '../src/experience/ingest-experience.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_RELATIVE_PATH = 'wordpress/experiences/registry.json';
const EXPERIENCE_DIRECTORY_RELATIVE_PATH = 'wordpress/experiences';
const REGISTRY_SCHEMA = 'localis.cim/wordpress-experience-registry/v1';
const REGISTRY_KEYS = Object.freeze(['schema', 'experiences']);
const ENTRY_KEYS = Object.freeze(['id', 'asset']);
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const CANONICAL_PROJECTIONS = Object.freeze(new Map([
  ['git-basic-cycle', 'experiences/git/git-basic-cycle.json']
]));

function fail(message) {
  throw new Error('R30 WordPress Experience registry: ' + message);
}

function isPlainObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) fail(label + ' must be a plain object.');
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) {
    fail(label + ' must not contain symbol keys.');
  }
  if (
    keys.length !== expected.length ||
    expected.some((key) => !keys.includes(key))
  ) {
    fail(label + ' must contain exactly: ' + expected.join(', ') + '.');
  }
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

async function readRequiredText(path, label) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    fail(label + ' is unavailable: ' + error.message);
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(label + ' is not valid JSON: ' + error.message);
  }
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

function assertExactAssetSet(entries, directoryEntries) {
  const expected = entries.map((entry) => entry.asset).sort(compareText);
  const actual = [];

  for (const entry of directoryEntries) {
    if (entry.name === 'registry.json' || !entry.name.endsWith('.json')) continue;
    if (!entry.isFile()) {
      fail('deployment JSON path must be a regular file: ' + entry.name + '.');
    }
    actual.push(entry.name);
  }
  actual.sort(compareText);

  if (
    actual.length !== expected.length ||
    expected.some((name, index) => actual[index] !== name)
  ) {
    fail(
      'wordpress/experiences deployment set must equal the registry exactly; ' +
      'expected [' + expected.join(', ') + '], found [' + actual.join(', ') + '].'
    );
  }
}

async function validateDeploymentEntry(root, experienceDirectory, entry) {
  const assetPath = resolve(experienceDirectory, entry.asset);
  const assetText = await readRequiredText(
    assetPath,
    'registered Experience asset ' + entry.asset
  );
  const raw = parseJson(assetText, 'registered Experience asset ' + entry.asset);

  let experience;
  try {
    experience = ingestExperience(raw);
  } catch (error) {
    fail(
      'registered Experience asset ' + entry.asset +
      ' failed production ingestion: ' + error.message
    );
  }

  if (experience.id !== entry.id) {
    fail(
      'registry identity mismatch for ' + entry.asset +
      ': expected ' + entry.id + ', received ' + String(experience.id) + '.'
    );
  }

  const canonicalRelativePath = CANONICAL_PROJECTIONS.get(entry.id);
  if (canonicalRelativePath !== undefined) {
    const canonicalText = await readRequiredText(
      resolve(root, ...canonicalRelativePath.split('/')),
      'canonical projection source for ' + entry.id
    );
    if (assetText !== canonicalText) {
      fail(
        entry.asset + ' is stale relative to ' + canonicalRelativePath + '.'
      );
    }
  }

  return Object.freeze({
    id: entry.id,
    asset: entry.asset,
    renderer: experience.renderer
  });
}

export async function validateWordPressExperienceRegistry(root = ROOT) {
  const registryPath = resolve(root, ...REGISTRY_RELATIVE_PATH.split('/'));
  const experienceDirectory = resolve(
    root,
    ...EXPERIENCE_DIRECTORY_RELATIVE_PATH.split('/')
  );
  const registryText = await readRequiredText(registryPath, 'canonical registry');
  const registry = parseJson(registryText, 'canonical registry');
  const entries = validateWordPressExperienceRegistryData(registry);

  let directoryEntries;
  try {
    directoryEntries = await readdir(experienceDirectory, { withFileTypes: true });
  } catch (error) {
    fail('Experience deployment directory is unavailable: ' + error.message);
  }
  assertExactAssetSet(entries, directoryEntries);

  const validated = [];
  for (const entry of entries) {
    validated.push(await validateDeploymentEntry(root, experienceDirectory, entry));
  }

  return Object.freeze({
    schema: REGISTRY_SCHEMA,
    experiences: Object.freeze(validated)
  });
}

export async function runWordPressExperienceRegistryCheck(root = ROOT) {
  const result = await validateWordPressExperienceRegistry(root);
  console.log(
    'PASS: R30 WordPress Experience registry (' +
    result.experiences.length + ' registered Experience(s)).'
  );
  return result;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  runWordPressExperienceRegistryCheck().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
