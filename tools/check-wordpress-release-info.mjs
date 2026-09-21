import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  R22_METADATA,
  parseReadme
} from './check-wordpress-release-metadata.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_RELATIVE_PATH = 'wordpress/release/release-info.generated.json';
const RELEASE_INFO_SCHEMA = 'localis.cim/wordpress-release-info/v1';
const TOP_LEVEL_KEYS = Object.freeze([
  'schema',
  'stable_tag',
  'tested_up_to',
  'current_release',
  'support_uri'
]);
const CURRENT_RELEASE_KEYS = Object.freeze(['version', 'notes']);

function fail(message) {
  throw new Error('R33 WordPress release info: ' + message);
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
  if (keys.some((key) => typeof key !== 'string')) fail(label + ' must not contain symbol keys.');
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    fail(label + ' must contain exactly: ' + expected.join(', ') + '.');
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(label + ' must be a non-empty string.');
  return value;
}

export function parseCurrentReadmeRelease(source, version) {
  requireNonEmptyString(source, 'readme source');
  requireNonEmptyString(version, 'current release version');

  const marker = '== Changelog ==';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) fail('readme Changelog section is required.');

  const changelog = source.slice(markerIndex + marker.length);
  const lines = changelog.split(/\r?\n/);
  const heading = '= ' + version + ' =';
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) fail('current changelog heading is missing: ' + heading + '.');

  const notes = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^= .+ =$/.test(line)) break;
    if (line === '') continue;
    if (!line.startsWith('* ')) {
      fail('current changelog entry may contain only bullet lines.');
    }
    const note = line.slice(2).trim();
    requireNonEmptyString(note, 'current changelog note');
    notes.push(note);
  }

  if (notes.length === 0) fail('current changelog entry must contain at least one note.');
  return Object.freeze({ version, notes: Object.freeze(notes) });
}

export function buildWordPressReleaseInfo(readmeSource) {
  const parsed = parseReadme(readmeSource);
  const stableTag = requireNonEmptyString(parsed.fields.get('Stable tag'), 'Stable tag');
  const testedUpTo = requireNonEmptyString(parsed.fields.get('Tested up to'), 'Tested up to');
  const currentRelease = parseCurrentReadmeRelease(readmeSource, stableTag);

  if (!readmeSource.includes(R22_METADATA.supportUri)) {
    fail('readme Support section must contain the R22 support URI.');
  }

  return Object.freeze({
    schema: RELEASE_INFO_SCHEMA,
    stable_tag: stableTag,
    tested_up_to: testedUpTo,
    current_release: Object.freeze({
      version: currentRelease.version,
      notes: currentRelease.notes
    }),
    support_uri: R22_METADATA.supportUri
  });
}

export function validateWordPressReleaseInfoData(data) {
  assertExactKeys(data, TOP_LEVEL_KEYS, 'release info');
  if (data.schema !== RELEASE_INFO_SCHEMA) {
    fail('schema must be ' + JSON.stringify(RELEASE_INFO_SCHEMA) + '.');
  }
  requireNonEmptyString(data.stable_tag, 'stable_tag');
  requireNonEmptyString(data.tested_up_to, 'tested_up_to');
  requireNonEmptyString(data.support_uri, 'support_uri');
  if (!/^https:\/\//.test(data.support_uri)) fail('support_uri must use HTTPS.');

  assertExactKeys(data.current_release, CURRENT_RELEASE_KEYS, 'current_release');
  requireNonEmptyString(data.current_release.version, 'current_release.version');
  if (data.current_release.version !== data.stable_tag) {
    fail('current_release.version must equal stable_tag.');
  }
  if (!Array.isArray(data.current_release.notes) || data.current_release.notes.length === 0) {
    fail('current_release.notes must be a non-empty array.');
  }
  for (const [index, note] of data.current_release.notes.entries()) {
    requireNonEmptyString(note, 'current_release.notes[' + index + ']');
  }

  return Object.freeze({
    ...data,
    current_release: Object.freeze({
      version: data.current_release.version,
      notes: Object.freeze([...data.current_release.notes])
    })
  });
}

export function wordPressReleaseInfoSource(data) {
  const validated = validateWordPressReleaseInfoData(data);
  return JSON.stringify(validated, null, 2) + '\n';
}

async function expectedReleaseInfo(root) {
  const readmeSource = await readFile(resolve(root, 'readme.txt'), 'utf8');
  return buildWordPressReleaseInfo(readmeSource);
}

export async function validateWordPressReleaseInfo(root = ROOT) {
  const expected = await expectedReleaseInfo(root);
  const path = resolve(root, ...OUTPUT_RELATIVE_PATH.split('/'));

  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    fail('generated release-info projection is unavailable: ' + error.message);
  }

  let data;
  try {
    data = JSON.parse(source);
  } catch (error) {
    fail('generated release-info projection is invalid JSON: ' + error.message);
  }

  validateWordPressReleaseInfoData(data);
  const expectedSource = wordPressReleaseInfoSource(expected);
  if (source !== expectedSource) {
    fail(OUTPUT_RELATIVE_PATH + ' is stale; run npm run generate:wordpress-release-info.');
  }

  return expected;
}

export async function generateWordPressReleaseInfo(root = ROOT) {
  const data = await expectedReleaseInfo(root);
  const path = resolve(root, ...OUTPUT_RELATIVE_PATH.split('/'));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, wordPressReleaseInfoSource(data), 'utf8');
  return data;
}

export async function runWordPressReleaseInfoCheck(root = ROOT) {
  const data = await validateWordPressReleaseInfo(root);
  console.log(
    'PASS: R33 WordPress release info (stable ' +
    data.stable_tag + ', tested WordPress ' + data.tested_up_to +
    ', ' + data.current_release.notes.length + ' current changelog note(s)).'
  );
  return data;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;

if (invokedPath === import.meta.url) {
  const args = process.argv.slice(2);
  const write = args.length === 1 && args[0] === '--write';
  if (args.length > 0 && !write) {
    console.error('Usage: node tools/check-wordpress-release-info.mjs [--write]');
    process.exitCode = 2;
  } else {
    const operation = write
      ? generateWordPressReleaseInfo()
      : runWordPressReleaseInfoCheck();

    operation.then((data) => {
      if (write) {
        console.log(
          'Generated R33 WordPress release info (' +
          data.stable_tag + ', ' + data.current_release.notes.length + ' note(s)).'
        );
      }
    }).catch((error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 1;
    });
  }
}
