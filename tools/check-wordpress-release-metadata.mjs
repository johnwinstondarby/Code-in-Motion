import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const R22_METADATA = Object.freeze({
  pluginName: 'Code in Motion',
  pluginUri: 'https://github.com/johnwinstondarby/Code-in-Motion',
  description: 'WordPress host, runtime bindings, and controls for Code in Motion experiences.',
  requiresWordPress: '6.5',
  testedWordPress: '7.1',
  requiresPhp: '7.4',
  author: 'Localis',
  authorUri: 'https://localis.services/',
  license: 'GPLv3',
  licenseUri: 'https://www.gnu.org/licenses/gpl-3.0.html',
  packageLicense: 'GPL-3.0-only',
  supportUri: 'https://github.com/johnwinstondarby/Code-in-Motion/issues'
});

function fail(message) {
  throw new Error('R22 release metadata: ' + message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

export function parsePluginHeader(source) {
  if (typeof source !== 'string') fail('plugin source must be a string.');
  const block = source.match(/^<\?php\s*\/\*\*([\s\S]*?)\*\//);
  if (!block) fail('main plugin file must begin with a PHPDoc plugin header.');

  const fields = new Map();
  for (const raw of block[1].split(/\r?\n/)) {
    const match = raw.match(/^\s*\*\s*([^:]+):\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (fields.has(key)) fail('duplicate plugin header field: ' + key);
    fields.set(key, value);
  }
  return fields;
}

export function parseReadme(source) {
  if (typeof source !== 'string') fail('readme source must be a string.');
  const lines = source.split(/\r?\n/);
  assert(lines[0] === '=== Code in Motion ===', 'readme title must be "Code in Motion".');

  const fields = new Map();
  let index = 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') break;
    const match = line.match(/^([^:]+):\s*(.*?)\s*$/);
    if (!match) fail('unexpected readme header line: ' + line);
    const key = match[1].trim();
    const value = match[2].trim();
    if (fields.has(key)) fail('duplicate readme header field: ' + key);
    fields.set(key, value);
  }

  while (index < lines.length && lines[index].trim() === '') index += 1;
  const shortDescription = lines[index]?.trim() ?? '';
  assert(shortDescription.length > 0, 'readme short description is required.');

  return Object.freeze({ fields, shortDescription });
}

function exactFields(fields, expected, label) {
  assert(fields.size === expected.size, label + ' field set must be exact.');
  for (const [key, value] of expected) {
    assert(fields.has(key), label + ' is missing field: ' + key);
    assert(fields.get(key) === value, label + ' ' + key + ' must be ' + JSON.stringify(value) + '.');
  }
}

export function validateReleaseMetadataTexts({
  packageJson,
  rootPlugin,
  implementationPlugin,
  readme,
  license
}) {
  assert(packageJson !== null && typeof packageJson === 'object', 'package.json must parse to an object.');
  const version = packageJson.version;
  assert(typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version), 'package version must be SemVer core form.');

  assert(packageJson.name === 'code-in-motion', 'package name must be code-in-motion.');
  assert(packageJson.description === 'Reusable Localis platform for learner-controlled technical process experiences.', 'package description must match the R22 release value.');
  assert(packageJson.license === R22_METADATA.packageLicense, 'package license must be GPL-3.0-only.');
  assert(packageJson.homepage === R22_METADATA.pluginUri, 'package homepage must match Plugin URI.');
  assert(packageJson.repository?.type === 'git', 'package repository type must be git.');
  assert(packageJson.repository?.url === R22_METADATA.pluginUri + '.git', 'package repository URL must match the project repository.');
  assert(packageJson.bugs?.url === R22_METADATA.supportUri, 'package bugs URL must match the support route.');

  const pluginFields = parsePluginHeader(rootPlugin);
  exactFields(pluginFields, new Map([
    ['Plugin Name', R22_METADATA.pluginName],
    ['Plugin URI', R22_METADATA.pluginUri],
    ['Description', R22_METADATA.description],
    ['Version', version],
    ['Requires at least', R22_METADATA.requiresWordPress],
    ['Requires PHP', R22_METADATA.requiresPhp],
    ['Author', R22_METADATA.author],
    ['Author URI', R22_METADATA.authorUri],
    ['License', R22_METADATA.license],
    ['License URI', R22_METADATA.licenseUri]
  ]), 'plugin header');
  assert(pluginFields.get('Description').length < 140, 'plugin header Description must be fewer than 140 characters.');

  const pluginHeaderCount = [rootPlugin, implementationPlugin]
    .reduce((count, source) => count + (source.match(/^\s*\* Plugin Name:/gm)?.length ?? 0), 0);
  assert(pluginHeaderCount === 1, 'release PHP files must contain exactly one Plugin Name header.');
  assert(!/^\s*\* Plugin Name:/m.test(implementationPlugin), 'WordPress implementation file must not declare plugin metadata.');
  assert(
    implementationPlugin.includes("define( 'LOCALIS_CIM_PLUGIN_VERSION', '" + version + "' );"),
    'WordPress implementation version constant must match package version.'
  );

  const parsedReadme = parseReadme(readme);
  exactFields(parsedReadme.fields, new Map([
    ['Tags', 'interactive, experience, runtime'],
    ['Requires at least', R22_METADATA.requiresWordPress],
    ['Tested up to', R22_METADATA.testedWordPress],
    ['Requires PHP', R22_METADATA.requiresPhp],
    ['Stable tag', version],
    ['License', R22_METADATA.license],
    ['License URI', R22_METADATA.licenseUri]
  ]), 'readme header');
  assert(parsedReadme.shortDescription === R22_METADATA.description, 'readme short description must match plugin Description.');
  assert(parsedReadme.shortDescription.length <= 150, 'readme short description must be 150 characters or fewer.');

  for (const section of ['Description', 'Installation', 'Support', 'Changelog']) {
    assert(readme.includes('== ' + section + ' =='), 'readme must contain section: ' + section);
  }
  assert(readme.includes(R22_METADATA.supportUri), 'readme Support section must contain the canonical support URI.');
  assert(readme.includes('= ' + version + ' ='), 'readme Changelog must contain the current version.');
  assert(!/release candidate/i.test(readme), 'release readme must not describe the current version as a release candidate.');

  assert(license.includes('GNU GENERAL PUBLIC LICENSE'), 'LICENSE must identify the GNU General Public License.');
  assert(license.includes('Version 3, 29 June 2007'), 'LICENSE must contain GPL version 3 text.');

  return Object.freeze({ version, pluginFields, readme: parsedReadme });
}

async function readText(root, path) {
  return readFile(resolve(root, ...path.split('/')), 'utf8');
}

async function validateRoot(root) {
  const packageJson = JSON.parse(await readText(ROOT, 'package.json'));
  const texts = {
    packageJson,
    rootPlugin: await readText(root, 'code-in-motion.php'),
    implementationPlugin: await readText(root, 'wordpress/code-in-motion.php'),
    readme: await readText(root, 'readme.txt'),
    license: await readText(root, 'LICENSE')
  };
  const result = validateReleaseMetadataTexts(texts);

  if (root !== ROOT) {
    for (const path of ['code-in-motion.php', 'wordpress/code-in-motion.php', 'readme.txt', 'LICENSE']) {
      const source = await readText(ROOT, path);
      const staged = await readText(root, path);
      assert(staged === source, 'staged metadata file differs from source: ' + path);
    }
  }

  return result;
}

export async function runReleaseMetadataCheck(releaseRoot = ROOT) {
  const root = resolve(releaseRoot);
  const result = await validateRoot(root);
  const scope = root === ROOT ? 'source' : 'staged release';
  console.log(
    'PASS: R22 release metadata (' + scope + ', version ' + result.version +
    ', WordPress ' + R22_METADATA.requiresWordPress + '-tested ' + R22_METADATA.testedWordPress +
    ', PHP ' + R22_METADATA.requiresPhp + ', GPLv3).'
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const flag = process.argv[2];
  const releaseRoot = flag === '--release-root' ? process.argv[3] : ROOT;
  if (flag === '--release-root' && !releaseRoot) {
    console.error('Usage: node tools/check-wordpress-release-metadata.mjs [--release-root <path>]');
    process.exitCode = 2;
  } else if (flag !== undefined && flag !== '--release-root') {
    console.error('Usage: node tools/check-wordpress-release-metadata.mjs [--release-root <path>]');
    process.exitCode = 2;
  } else {
    runReleaseMetadataCheck(releaseRoot).catch((error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 1;
    });
  }
}
