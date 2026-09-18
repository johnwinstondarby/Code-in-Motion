import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile
} from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { constants as zlibConstants, deflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = resolve(ROOT, 'dist');
const STAGE_ROOT = resolve(DIST_ROOT, 'code-in-motion');
const FIXED_TIME = new Date('1980-01-01T00:00:00.000Z');
const ZIP_DOS_TIME = 0x0000;
const ZIP_DOS_DATE = 0x0021;
const FILE_MODE = 0o644;
const DIRECTORY_MODE = 0o755;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_VERSION_NEEDED = 20;
const ZIP_VERSION_MADE_BY_UNIX = (3 << 8) | ZIP_VERSION_NEEDED;
const ZIP_EXTERNAL_FILE_ATTRIBUTES = (0o100644 << 16) >>> 0;

const STATIC_STAGE_FILES = Object.freeze([
  Object.freeze({ source: 'LICENSE', destination: 'LICENSE' }),
  Object.freeze({ source: 'readme.txt', destination: 'readme.txt' }),
  Object.freeze({ source: 'code-in-motion.php', destination: 'code-in-motion.php' }),
  Object.freeze({ source: 'wordpress/code-in-motion.php', destination: 'wordpress/code-in-motion.php' }),
  Object.freeze({ source: 'wordpress/assets/cim.css', destination: 'wordpress/assets/cim.css' })
]);

const EXPERIENCE_SOURCES = Object.freeze([
  Object.freeze({
    source: 'wordpress/experiences/synthetic-wordpress.json',
    destination: 'wordpress/experiences/synthetic-wordpress.json'
  }),
  Object.freeze({
    source: 'experiences/git/git-basic-cycle.json',
    destination: 'experiences/git/git-basic-cycle.json'
  })
]);

function fail(message) {
  throw new Error(`WordPress release build: ${message}`);
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function portablePath(path) {
  return path.split(sep).join('/');
}

function repoPath(path) {
  return portablePath(relative(ROOT, path));
}

function assertRelativeReleasePath(path, label = 'release path') {
  if (typeof path !== 'string' || path.length === 0) fail(`${label} must be a non-empty string.`);
  if (path.startsWith('/') || path.includes('\\')) fail(`${label} must use a relative POSIX path: ${path}`);
  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    fail(`${label} is not canonical: ${path}`);
  }
  return path;
}

export function assertReleaseNodeVersion(actualVersion, requiredVersion) {
  const actual = String(actualVersion).replace(/^v/, '');
  const required = String(requiredVersion).replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(required)) fail(`invalid pinned Node version: ${JSON.stringify(requiredVersion)}`);
  if (actual !== required) {
    fail(`release build requires Node ${required}; active runtime is ${actual}.`);
  }
  return required;
}

export function rewriteBootstrapForRelease(source, version) {
  const token = "'./bootstrap-module.mjs'";
  const replacement = `'./modules/${version}/wordpress/assets/bootstrap-module.mjs'`;
  const first = source.indexOf(token);
  const last = source.lastIndexOf(token);
  if (first < 0 || first !== last) {
    fail('classic bootstrap must contain exactly one repository-tree module handoff.');
  }
  return source.slice(0, first) + replacement + source.slice(first + token.length);
}

async function collectFiles(root, predicate) {
  const output = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) fail(`symbolic links are outside the release manifest: ${repoPath(path)}`);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && predicate(path)) {
        output.push(path);
      }
    }
  }

  await visit(root);
  return output;
}

async function ensureStageDirectory(path) {
  await mkdir(path, { recursive: true });
}

async function writeStagedFile(destination, data) {
  const canonical = assertRelativeReleasePath(destination);
  const path = resolve(STAGE_ROOT, ...canonical.split('/'));
  await ensureStageDirectory(dirname(path));
  await writeFile(path, data);
  return canonical;
}

async function stageSourceFile(source, destination) {
  const data = await readFile(resolve(ROOT, ...source.split('/')));
  return writeStagedFile(destination, data);
}

async function normalizeStageMetadata() {
  async function visit(path) {
    const info = await stat(path);
    if (info.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true });
      entries.sort((a, b) => compareText(a.name, b.name));
      for (const entry of entries) await visit(resolve(path, entry.name));
      await chmod(path, DIRECTORY_MODE);
      await utimes(path, FIXED_TIME, FIXED_TIME);
      return;
    }
    if (!info.isFile()) fail(`staged path is not a regular file: ${portablePath(relative(STAGE_ROOT, path))}`);
    await chmod(path, FILE_MODE);
    await utimes(path, FIXED_TIME, FIXED_TIME);
  }

  await visit(STAGE_ROOT);
}

async function stagedFiles() {
  const files = await collectFiles(STAGE_ROOT, () => true);
  return files
    .map((path) => portablePath(relative(STAGE_ROOT, path)))
    .sort(compareText);
}

function assertExactManifest(expected, actual) {
  const expectedSorted = [...new Set(expected)].sort(compareText);
  if (expectedSorted.length !== expected.length) fail('staging manifest contains a duplicate destination.');
  if (expectedSorted.length !== actual.length) {
    fail(`staging manifest mismatch: expected ${expectedSorted.length} file(s), found ${actual.length}.`);
  }
  for (let index = 0; index < expectedSorted.length; index += 1) {
    if (expectedSorted[index] !== actual[index]) {
      fail(`staging manifest mismatch at index ${index}: expected ${expectedSorted[index]}, found ${actual[index]}.`);
    }
  }
}

function crc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = crc32Table();

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function localFileHeader(name, data, compressed) {
  const nameBytes = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 6);
  header.writeUInt16LE(ZIP_METHOD_DEFLATE, 8);
  header.writeUInt16LE(ZIP_DOS_TIME, 10);
  header.writeUInt16LE(ZIP_DOS_DATE, 12);
  header.writeUInt32LE(crc32(data), 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBytes]);
}

function centralDirectoryHeader(name, data, compressed, localOffset) {
  const nameBytes = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(ZIP_VERSION_MADE_BY_UNIX, 4);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 8);
  header.writeUInt16LE(ZIP_METHOD_DEFLATE, 10);
  header.writeUInt16LE(ZIP_DOS_TIME, 12);
  header.writeUInt16LE(ZIP_DOS_DATE, 14);
  header.writeUInt32LE(crc32(data), 16);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(ZIP_EXTERNAL_FILE_ATTRIBUTES, 38);
  header.writeUInt32LE(localOffset, 42);
  return Buffer.concat([header, nameBytes]);
}

export function createDeterministicZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) fail('ZIP input must contain at least one file.');
  const normalized = entries.map((entry) => {
    const path = assertRelativeReleasePath(entry.path, 'ZIP entry path');
    if (!path.startsWith('code-in-motion/')) fail(`ZIP entry is outside the single plugin root: ${path}`);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    return Object.freeze({ path, data });
  }).sort((a, b) => compareText(a.path, b.path));

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].path === normalized[index].path) fail(`duplicate ZIP entry: ${normalized[index].path}`);
  }
  if (normalized.length > 0xffff) fail('ZIP64 is outside the R13 archive contract.');

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of normalized) {
    const compressed = deflateRawSync(entry.data, {
      level: 9,
      memLevel: 8,
      strategy: zlibConstants.Z_DEFAULT_STRATEGY
    });
    if (entry.data.length > 0xffffffff || compressed.length > 0xffffffff || localOffset > 0xffffffff) {
      fail('ZIP64 is outside the R13 archive contract.');
    }
    const localHeader = localFileHeader(entry.path, entry.data, compressed);
    const centralHeader = centralDirectoryHeader(entry.path, entry.data, compressed, localOffset);
    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  if (centralDirectory.length > 0xffffffff || localOffset + centralDirectory.length > 0xffffffff) {
    fail('ZIP64 is outside the R13 archive contract.');
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(normalized.length, 8);
  end.writeUInt16LE(normalized.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function assertPluginVersion(source, version, label) {
  const headerPattern = new RegExp(`^\\s*\\* Version:\\s*${version.replace(/\./g, '\\.')}\\s*$`, 'm');
  if (!headerPattern.test(source)) fail(`${label} does not declare package version ${version}.`);
}

async function releaseInputs(version) {
  const expected = [];
  for (const file of STATIC_STAGE_FILES) {
    expected.push(await stageSourceFile(file.source, file.destination));
  }

  const bootstrapSource = await readFile(resolve(ROOT, 'wordpress', 'assets', 'bootstrap.js'), 'utf8');
  expected.push(await writeStagedFile(
    'wordpress/assets/bootstrap.js',
    rewriteBootstrapForRelease(bootstrapSource, version)
  ));

  const moduleRoot = `wordpress/assets/modules/${version}`;
  const srcModules = await collectFiles(resolve(ROOT, 'src'), (path) => extname(path) === '.mjs');
  const wordpressModules = await collectFiles(
    resolve(ROOT, 'wordpress', 'assets'),
    (path) => extname(path) === '.mjs'
  );

  for (const path of [...srcModules, ...wordpressModules]) {
    const source = repoPath(path);
    expected.push(await stageSourceFile(source, `${moduleRoot}/${source}`));
  }

  for (const experience of EXPERIENCE_SOURCES) {
    expected.push(await stageSourceFile(
      experience.source,
      `${moduleRoot}/${experience.destination}`
    ));
  }
  return expected;
}

async function buildRelease() {
  const requiredNodeVersion = (await readFile(resolve(ROOT, '.nvmrc'), 'utf8')).trim();
  assertReleaseNodeVersion(process.version, requiredNodeVersion);

  const packageJson = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
  const version = packageJson.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`package version is not a usable release token: ${JSON.stringify(version)}`);
  }

  const rootPlugin = await readFile(resolve(ROOT, 'code-in-motion.php'), 'utf8');
  const wordpressPlugin = await readFile(resolve(ROOT, 'wordpress', 'code-in-motion.php'), 'utf8');
  assertPluginVersion(rootPlugin, version, 'root plugin entry');
  if (/^\\s*\\* Plugin Name:/m.test(wordpressPlugin)) {
    fail('WordPress implementation entry must not declare a second plugin header.');
  }
  if (!wordpressPlugin.includes(`define( 'LOCALIS_CIM_PLUGIN_VERSION', '${version}' );`)) {
    fail(`WordPress implementation constant does not match package version ${version}.`);
  }

  await rm(DIST_ROOT, { recursive: true, force: true });
  await ensureStageDirectory(STAGE_ROOT);

  const expected = await releaseInputs(version);
  await normalizeStageMetadata();
  const actual = await stagedFiles();
  assertExactManifest(expected, actual);

  const archiveEntries = [];
  for (const path of actual) {
    archiveEntries.push(Object.freeze({
      path: `code-in-motion/${path}`,
      data: await readFile(resolve(STAGE_ROOT, ...path.split('/')))
    }));
  }

  const zip = createDeterministicZip(archiveEntries);
  const zipName = `code-in-motion-${version}.zip`;
  const zipPath = resolve(DIST_ROOT, zipName);
  await writeFile(zipPath, zip);
  await chmod(zipPath, FILE_MODE);
  await utimes(zipPath, FIXED_TIME, FIXED_TIME);

  const sha256 = createHash('sha256').update(zip).digest('hex');
  const checksumName = `${zipName}.sha256`;
  const checksumPath = resolve(DIST_ROOT, checksumName);
  await writeFile(checksumPath, `${sha256}  ${zipName}\n`, 'utf8');
  await chmod(checksumPath, FILE_MODE);
  await utimes(checksumPath, FIXED_TIME, FIXED_TIME);

  console.log(
    `PASS: R13 WordPress release build (${actual.length} staged file(s), Node ${requiredNodeVersion}, ` +
    `${zipName}, SHA-256 ${sha256})`
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  buildRelease().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
