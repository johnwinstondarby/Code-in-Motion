import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  WORDPRESS_RENDERER_IDS,
  createWordPressRendererRegistry
} from '../wordpress/assets/renderer-registry.mjs';
import { validateWordPressExperienceRegistry } from './check-wordpress-experience-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_RELATIVE_PATH = 'wordpress/renderers/inventory.generated.json';
const INVENTORY_SCHEMA = 'localis.cim/wordpress-renderer-inventory/v1';
const TOP_LEVEL_KEYS = Object.freeze(['schema', 'renderers']);
const ENTRY_KEYS = Object.freeze(['id']);
const RENDERER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/v[1-9][0-9]*$/;

function fail(message) {
  throw new Error('R32 WordPress renderer registry: ' + message);
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    fail(label + ' must contain exactly: ' + expected.join(', ') + '.');
  }
}

export function validateWordPressRendererIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    fail('registered renderer IDs must be a non-empty array.');
  }

  const seen = new Set();
  let previous = null;

  const validated = ids.map((id, index) => {
    if (typeof id !== 'string' || !RENDERER_ID_PATTERN.test(id)) {
      fail('renderer ID at index ' + index + ' is not canonical: ' + JSON.stringify(id) + '.');
    }
    if (seen.has(id)) fail('duplicate renderer ID: ' + id + '.');
    if (previous !== null && compareText(previous, id) >= 0) {
      fail('registered renderer IDs must be sorted by bytewise lexical order.');
    }
    seen.add(id);
    previous = id;
    return id;
  });

  return Object.freeze(validated);
}

export function rendererInventorySource(idsInput) {
  const ids = validateWordPressRendererIds(idsInput);
  return JSON.stringify({
    schema: INVENTORY_SCHEMA,
    renderers: ids.map((id) => ({ id }))
  }, null, 2) + '\n';
}

export function validateRendererInventoryData(data, expectedIdsInput) {
  const expectedIds = validateWordPressRendererIds(expectedIdsInput);
  assertExactKeys(data, TOP_LEVEL_KEYS, 'renderer inventory');

  if (data.schema !== INVENTORY_SCHEMA) {
    fail('renderer inventory schema must be ' + JSON.stringify(INVENTORY_SCHEMA) + '.');
  }
  if (!Array.isArray(data.renderers)) {
    fail('renderer inventory renderers must be an array.');
  }
  if (data.renderers.length !== expectedIds.length) {
    fail('renderer inventory renderer count does not match production registration.');
  }

  const actualIds = data.renderers.map((entry, index) => {
    assertExactKeys(entry, ENTRY_KEYS, 'renderer inventory renderers[' + index + ']');
    if (typeof entry.id !== 'string') {
      fail('renderer inventory renderers[' + index + '].id must be a string.');
    }
    return entry.id;
  });

  validateWordPressRendererIds(actualIds);
  for (let index = 0; index < expectedIds.length; index += 1) {
    if (actualIds[index] !== expectedIds[index]) {
      fail(
        'renderer inventory differs from production registration at index ' + index +
        ': expected ' + expectedIds[index] + ', found ' + actualIds[index] + '.'
      );
    }
  }

  return Object.freeze(actualIds);
}

async function readInventory(root) {
  const path = resolve(root, ...INVENTORY_RELATIVE_PATH.split('/'));
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    fail('generated renderer inventory is unavailable: ' + error.message);
  }

  let data;
  try {
    data = JSON.parse(source);
  } catch (error) {
    fail('generated renderer inventory is invalid JSON: ' + error.message);
  }

  return { path, source, data };
}

export async function validateWordPressRendererRegistry(root = ROOT) {
  const rendererIds = validateWordPressRendererIds(WORDPRESS_RENDERER_IDS);
  if (!Object.isFrozen(WORDPRESS_RENDERER_IDS)) {
    fail('WORDPRESS_RENDERER_IDS must be frozen.');
  }

  const registry = createWordPressRendererRegistry();
  if (!(registry instanceof Map)) fail('renderer registry factory must return a Map.');
  if (registry.size !== rendererIds.length) {
    fail('renderer registry Map size does not match registered renderer IDs.');
  }

  const mapIds = [...registry.keys()];
  for (let index = 0; index < rendererIds.length; index += 1) {
    if (mapIds[index] !== rendererIds[index]) {
      fail('renderer registry Map ordering or membership differs from registered IDs.');
    }
    if (typeof registry.get(rendererIds[index]) !== 'function') {
      fail('renderer factory must be a function for ' + rendererIds[index] + '.');
    }
  }

  const inventory = await readInventory(root);
  validateRendererInventoryData(inventory.data, rendererIds);
  const expectedSource = rendererInventorySource(rendererIds);
  if (inventory.source !== expectedSource) {
    fail(
      INVENTORY_RELATIVE_PATH +
      ' is stale; run npm run generate:wordpress-renderer-inventory.'
    );
  }

  const experiences = await validateWordPressExperienceRegistry(root);
  const bindings = [];
  for (const experience of experiences.experiences) {
    if (!registry.has(experience.renderer)) {
      fail(
        'registered Experience ' + experience.id +
        ' requires unavailable WordPress renderer ' + experience.renderer + '.'
      );
    }
    bindings.push(Object.freeze({
      experienceId: experience.id,
      rendererId: experience.renderer
    }));
  }

  return Object.freeze({
    schema: INVENTORY_SCHEMA,
    rendererIds,
    experienceBindings: Object.freeze(bindings)
  });
}

export async function generateWordPressRendererInventory(root = ROOT) {
  const rendererIds = validateWordPressRendererIds(WORDPRESS_RENDERER_IDS);
  const path = resolve(root, ...INVENTORY_RELATIVE_PATH.split('/'));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, rendererInventorySource(rendererIds), 'utf8');
  return validateWordPressRendererRegistry(root);
}

export async function runWordPressRendererRegistryCheck(root = ROOT) {
  const result = await validateWordPressRendererRegistry(root);
  console.log(
    'PASS: R32 WordPress renderer registry (' +
    result.rendererIds.length + ' renderer(s), ' +
    result.experienceBindings.length + ' registered Experience binding(s), generated inventory current).'
  );
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;

if (invokedPath === import.meta.url) {
  const args = process.argv.slice(2);
  const write = args.length === 1 && args[0] === '--write';
  if (args.length > 0 && !write) {
    console.error('Usage: node tools/check-wordpress-renderer-registry.mjs [--write]');
    process.exitCode = 2;
  } else {
    const operation = write
      ? generateWordPressRendererInventory()
      : runWordPressRendererRegistryCheck();

    operation.then((result) => {
      if (write) {
        console.log(
          'Generated R32 WordPress renderer inventory (' +
          result.rendererIds.length + ' renderer(s)).'
        );
      }
    }).catch((error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 1;
    });
  }
}
