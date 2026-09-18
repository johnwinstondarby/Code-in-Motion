import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_PATH = resolve(ROOT, 'package.json');
const BOOTSTRAP_PATH = resolve(ROOT, 'wordpress', 'assets', 'bootstrap.js');
const MODULE_ENTRY_PATH = resolve(ROOT, 'wordpress', 'assets', 'bootstrap-module.mjs');
const EXPERIENCE_PATHS = Object.freeze([
  Object.freeze({
    source: resolve(ROOT, 'wordpress', 'experiences', 'synthetic-wordpress.json'),
    destination: 'wordpress/experiences/synthetic-wordpress.json'
  }),
  Object.freeze({
    source: resolve(ROOT, 'experiences', 'git', 'git-basic-cycle.json'),
    destination: 'wordpress/experiences/git-basic-cycle.json'
  })
]);

const ALLOWED_MODULE_SOURCE_PREFIXES = Object.freeze([
  'src/',
  'wordpress/assets/'
]);

function fail(message) {
  throw new Error(`WordPress release-tree gate: ${message}`);
}

function repoPath(path) {
  return relative(ROOT, path).split(sep).join('/');
}

function assertInside(parent, child, label) {
  const rel = relative(parent, child);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) return;
  fail(`${label} escapes ${repoPath(parent)}: ${repoPath(child)}`);
}

function assertAllowedModuleSource(path) {
  const relativePath = repoPath(path);
  if (!ALLOWED_MODULE_SOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    fail(`module source is outside the approved production roots: ${relativePath}`);
  }
}

function stripComments(source) {
  let result = '';
  let mode = 'code';
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (mode === 'line-comment') {
      if (char === '\n') {
        result += '\n';
        mode = 'code';
      } else {
        result += ' ';
      }
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        result += '  ';
        i += 1;
        mode = 'code';
      } else {
        result += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (mode === 'string') {
      result += char;
      if (char === '\\') {
        if (next !== undefined) {
          result += next;
          i += 1;
        }
      } else if (char === quote) {
        mode = 'code';
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      result += '  ';
      i += 1;
      mode = 'line-comment';
    } else if (char === '/' && next === '*') {
      result += '  ';
      i += 1;
      mode = 'block-comment';
    } else if (char === '\'' || char === '"' || char === '`') {
      result += char;
      mode = 'string';
      quote = char;
    } else {
      result += char;
    }
  }

  return result;
}

function moduleSpecifiers(source) {
  const specifiers = new Set();
  const uncommented = stripComments(source);
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of uncommented.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

async function assertFile(path, label) {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) fail(`${label} is missing: ${repoPath(path)}`);
}

async function resolveImport(importer, specifier) {
  if (!specifier.startsWith('.')) {
    fail(`runtime module graph contains a bare or external import in ${repoPath(importer)}: ${specifier}`);
  }
  const target = resolve(dirname(importer), specifier);
  assertInside(ROOT, target, `import from ${repoPath(importer)}`);
  assertAllowedModuleSource(target);
  await assertFile(target, `import target from ${repoPath(importer)}`);
  if (extname(target) !== '.mjs') {
    fail(`runtime JavaScript import must resolve to .mjs: ${repoPath(target)}`);
  }
  return target;
}

async function collectModuleClosure(entry) {
  const pending = [entry];
  const visited = new Set();
  const edges = [];

  while (pending.length > 0) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    assertAllowedModuleSource(path);
    const source = await readFile(path, 'utf8');
    for (const specifier of moduleSpecifiers(source)) {
      const target = await resolveImport(path, specifier);
      edges.push(Object.freeze({ importer: path, specifier, target }));
      if (!visited.has(target)) pending.push(target);
    }
  }

  return Object.freeze({ modules: Object.freeze([...visited]), edges: Object.freeze(edges) });
}

function releaseModulePath(version, sourcePath) {
  return `wordpress/assets/modules/${version}/${repoPath(sourcePath)}`;
}

function assertReleaseEdge(version, edge) {
  const importerDestination = resolve(ROOT, releaseModulePath(version, edge.importer));
  const targetDestination = resolve(ROOT, releaseModulePath(version, edge.target));
  const resolvedDestination = resolve(dirname(importerDestination), edge.specifier);
  const releaseModuleRoot = resolve(ROOT, 'wordpress', 'assets', 'modules', version);
  assertInside(releaseModuleRoot, resolvedDestination, `release import from ${releaseModulePath(version, edge.importer)}`);
  if (resolvedDestination !== targetDestination) {
    fail(
      `release topology changes import meaning: ${releaseModulePath(version, edge.importer)} ${edge.specifier} -> ` +
      `${repoPath(resolvedDestination)}; expected ${releaseModulePath(version, edge.target)}`
    );
  }
}

async function run() {
  const packageJson = JSON.parse(await readFile(PACKAGE_PATH, 'utf8'));
  const version = packageJson.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`package version is not a usable release-directory token: ${JSON.stringify(version)}`);
  }

  await assertFile(BOOTSTRAP_PATH, 'classic WordPress bootstrap');
  await assertFile(MODULE_ENTRY_PATH, 'WordPress module entry');
  for (const experience of EXPERIENCE_PATHS) {
    await assertFile(experience.source, 'WordPress release Experience');
  }

  const bootstrap = await readFile(BOOTSTRAP_PATH, 'utf8');
  if (!bootstrap.includes('./bootstrap-module.mjs')) {
    fail('classic bootstrap no longer contains the single repo-tree module handoff expected by R13.');
  }

  const closure = await collectModuleClosure(MODULE_ENTRY_PATH);
  for (const edge of closure.edges) assertReleaseEdge(version, edge);

  const releaseModuleRoot = `wordpress/assets/modules/${version}`;
  const experienceDestinations = EXPERIENCE_PATHS
    .map((experience) => `${releaseModuleRoot}/${experience.destination}`)
    .join(', ');
  const moduleEntryDestination = `${releaseModuleRoot}/wordpress/assets/bootstrap-module.mjs`;

  console.log(
    `PASS: R12 WordPress release-tree contract (${closure.modules.length} module(s), ${closure.edges.length} import edge(s), ` +
    `module root ${releaseModuleRoot}, entry ${moduleEntryDestination}, experiences ${experienceDestinations})`
  );
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
