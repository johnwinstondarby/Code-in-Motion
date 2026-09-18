import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDeterministicZip } from './build-wordpress-release.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = resolve(ROOT, 'dist');
const STAGE_ROOT = resolve(DIST_ROOT, 'code-in-motion');

export const R16_PRIOR_VERSION = '0.0.9';
export const R16_CURRENT_VERSION = '0.1.1';
export const R16_OBSOLETE_PATH = 'wordpress/assets/r16-obsolete.txt';

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function portablePath(path) {
  return path.split(sep).join('/');
}

async function collectFiles(root) {
  const output = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        output.push(path);
      } else {
        throw new Error(`R16 upgrade fixture rejects non-regular staged path: ${path}`);
      }
    }
  }

  await visit(root);
  return output;
}

export function priorReleasePath(path, currentVersion = R16_CURRENT_VERSION, priorVersion = R16_PRIOR_VERSION) {
  const currentRoot = `wordpress/assets/modules/${currentVersion}/`;
  const priorRoot = `wordpress/assets/modules/${priorVersion}/`;
  return path.startsWith(currentRoot) ? `${priorRoot}${path.slice(currentRoot.length)}` : path;
}

function replaceExactlyOnce(source, token, replacement, label) {
  const first = source.indexOf(token);
  const last = source.lastIndexOf(token);
  if (first < 0 || first !== last) {
    throw new Error(`R16 upgrade fixture expected exactly one ${label}.`);
  }
  return source.slice(0, first) + replacement + source.slice(first + token.length);
}

export function priorReleaseData(path, data, currentVersion = R16_CURRENT_VERSION, priorVersion = R16_PRIOR_VERSION) {
  if (path === 'code-in-motion.php') {
    const source = data.toString('utf8');
    return Buffer.from(
      replaceExactlyOnce(source, ` * Version: ${currentVersion}`, ` * Version: ${priorVersion}`, 'root plugin version header'),
      'utf8'
    );
  }

  if (path === 'wordpress/code-in-motion.php') {
    const source = data.toString('utf8');
    return Buffer.from(
      replaceExactlyOnce(
        source,
        `define( 'LOCALIS_CIM_PLUGIN_VERSION', '${currentVersion}' );`,
        `define( 'LOCALIS_CIM_PLUGIN_VERSION', '${priorVersion}' );`,
        'WordPress plugin version constant'
      ),
      'utf8'
    );
  }

  if (path === 'readme.txt') {
    let source = data.toString('utf8');
    source = replaceExactlyOnce(
      source,
      `Stable tag: ${currentVersion}`,
      `Stable tag: ${priorVersion}`,
      'WordPress readme stable tag'
    );
    source = replaceExactlyOnce(
      source,
      `= ${currentVersion} =`,
      `= ${priorVersion} =`,
      'WordPress readme changelog version'
    );
    return Buffer.from(source, 'utf8');
  }

  if (path === 'wordpress/assets/bootstrap.js') {
    const source = data.toString('utf8');
    return Buffer.from(
      replaceExactlyOnce(
        source,
        `./modules/${currentVersion}/wordpress/assets/bootstrap-module.mjs`,
        `./modules/${priorVersion}/wordpress/assets/bootstrap-module.mjs`,
        'version-bearing bootstrap handoff'
      ),
      'utf8'
    );
  }

  const experiencePath = `wordpress/assets/modules/${currentVersion}/wordpress/experiences/synthetic-wordpress.json`;
  if (path === experiencePath) {
    const experience = JSON.parse(data.toString('utf8'));
    experience.engine_min = priorVersion;
    experience.renderer_config = { ...experience.renderer_config, prefix: 'R16 N ' };
    return Buffer.from(`${JSON.stringify(experience, null, 2)}\n`, 'utf8');
  }

  return data;
}

async function buildUpgradeFixture() {
  const stagedFiles = await collectFiles(STAGE_ROOT);
  if (stagedFiles.length === 0) throw new Error('R16 upgrade fixture requires an existing R13 staged release tree.');

  const entries = [];
  for (const sourcePath of stagedFiles) {
    const sourceRelative = portablePath(relative(STAGE_ROOT, sourcePath));
    const destination = priorReleasePath(sourceRelative);
    entries.push(Object.freeze({
      path: `code-in-motion/${destination}`,
      data: priorReleaseData(sourceRelative, await readFile(sourcePath))
    }));
  }

  entries.push(Object.freeze({
    path: `code-in-motion/${R16_OBSOLETE_PATH}`,
    data: Buffer.from('R16 prior-release sentinel. This file must be absent after N -> N+1 upgrade.\n', 'utf8')
  }));

  const zip = createDeterministicZip(entries);
  const zipName = `code-in-motion-${R16_PRIOR_VERSION}-r16-fixture.zip`;
  await mkdir(DIST_ROOT, { recursive: true });
  await writeFile(resolve(DIST_ROOT, zipName), zip);

  console.log(
    `PASS: R16 prior-version fixture (${entries.length} file(s), ${R16_PRIOR_VERSION} -> ${R16_CURRENT_VERSION}, ${zipName})`
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  buildUpgradeFixture().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
