import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';

import { validateWordPressExperienceRegistry } from './check-wordpress-experience-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UTF8 = new TextDecoder('utf-8', { fatal: true });

const DENIED_SEGMENTS = new Set([
  '.git',
  '.github',
  '.ci',
  'node_modules',
  'tests',
  'test',
  '__tests__',
  'harness',
  'tools',
  'docs',
  'examples',
  'schemas',
  'authoring',
  'fixtures',
  'mocks'
]);

const DENIED_BASENAMES = new Set([
  '.gitignore',
  '.gitattributes',
  '.nvmrc',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.wp-env.json',
  'wp-env.json',
  'package.json',
  'package-lock.json',
  'composer.json',
  'composer.lock',
  'phpunit.xml',
  'phpunit.xml.dist'
]);

const DENIED_EXTENSIONS = new Set([
  '.pem', '.key', '.p12', '.pfx', '.der', '.crt', '.cer', '.jks', '.keystore',
  '.exe', '.dll', '.so', '.dylib', '.node', '.wasm', '.jar', '.class', '.bin',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
  '.map', '.db', '.sqlite', '.sqlite3'
]);

const SECRET_PATTERNS = Object.freeze([
  Object.freeze({ label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ }),
  Object.freeze({ label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ }),
  Object.freeze({ label: 'GitHub token', pattern: /\b(?:ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ }),
  Object.freeze({ label: 'OpenAI-style secret key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ }),
  Object.freeze({ label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ }),
  Object.freeze({
    label: 'credential assignment',
    pattern: /\b(?:AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|CLIENT_SECRET|PRIVATE_KEY|PASSWORD)\s*[:=]\s*["']?[A-Za-z0-9_+\/=.-]{12,}/i
  })
]);

function fail(message) {
  throw new Error('R23 supply-chain audit: ' + message);
}

function portablePath(path) {
  return path.split(sep).join('/');
}

function isEnvFile(name) {
  return name === '.env' || name.startsWith('.env.');
}

export function classifyReleasePath(path, version = '0.1.0', registeredAssets = new Set()) {
  if (typeof path !== 'string' || path.length === 0) fail('release path must be a non-empty string.');
  if (path.startsWith('/') || path.includes('\\')) fail('release path must be relative POSIX: ' + path);

  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    fail('release path is not canonical: ' + path);
  }

  for (const segment of segments) {
    if (DENIED_SEGMENTS.has(segment)) fail('denied development/test path segment: ' + path);
    if (isEnvFile(segment)) fail('environment file is forbidden: ' + path);
  }

  const name = basename(path);
  if (DENIED_BASENAMES.has(name)) fail('denied development file: ' + path);

  const extension = extname(name).toLowerCase();
  if (DENIED_EXTENSIONS.has(extension)) fail('denied secret/binary/archive extension: ' + path);

  const exact = new Set([
    'LICENSE',
    'readme.txt',
    'code-in-motion.php',
    'uninstall.php',
    'wordpress/code-in-motion.php',
    'wordpress/admin-console.php',
    'wordpress/assets/bootstrap.js',
    'wordpress/assets/cim.css',
    'wordpress/experiences/registry.json',
    'wordpress/renderers/inventory.generated.json',
    'wordpress/release/release-info.generated.json'
  ]);
  if (exact.has(path)) return 'approved-static';

  const moduleRoot = 'wordpress/assets/modules/' + version + '/';
  if (!path.startsWith(moduleRoot)) fail('path is outside the approved v1 release locations: ' + path);

  const nested = path.slice(moduleRoot.length);
  if (/^src\/.+\.mjs$/.test(nested)) return 'approved-module';
  if (/^wordpress\/assets\/.+\.mjs$/.test(nested)) return 'approved-wordpress-module';
  const experiencePrefix = 'wordpress/experiences/';
  if (nested.startsWith(experiencePrefix)) {
    const asset = nested.slice(experiencePrefix.length);
    if (registeredAssets.has(asset)) return 'approved-experience';
  }

  fail('path is not an approved release input: ' + path);
}

export function scanReleaseBytes(path, data) {
  if (!Buffer.isBuffer(data)) data = Buffer.from(data);

  let text;
  try {
    text = UTF8.decode(data);
  } catch {
    fail('non-UTF-8 or binary content is not approved: ' + path);
  }

  if (text.includes('\u0000')) fail('NUL byte indicates unapproved binary content: ' + path);

  for (const secret of SECRET_PATTERNS) {
    if (secret.pattern.test(text)) fail(secret.label + ' indicator found in ' + path);
  }

  return text;
}

async function collectFiles(root) {
  const output = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const full = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) fail('symbolic link is forbidden: ' + portablePath(relative(root, full)));
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile()) {
        output.push(full);
      } else {
        fail('non-regular release entry is forbidden: ' + portablePath(relative(root, full)));
      }
    }
  }

  await visit(root);
  return output;
}

export async function auditReleaseRoot(releaseRoot, version, manifestPath = null) {
  const root = resolve(releaseRoot);
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) fail('release root is missing or not a directory: ' + root);

  const files = await collectFiles(root);
  if (files.length === 0) fail('release root is empty.');

  const registry = await validateWordPressExperienceRegistry(ROOT);
  const registeredAssets = new Set(registry.experiences.map((experience) => experience.asset));
  const manifestLines = [];
  let totalBytes = 0;

  for (const full of files) {
    const path = portablePath(relative(root, full));
    classifyReleasePath(path, version, registeredAssets);
    const data = await readFile(full);
    scanReleaseBytes(path, data);
    totalBytes += data.length;
    manifestLines.push(createHash('sha256').update(data).digest('hex') + '  ' + path);
  }

  manifestLines.sort();
  const manifest = manifestLines.join('\n') + '\n';
  const manifestSha256 = createHash('sha256').update(manifest).digest('hex');

  if (manifestPath !== null) {
    const output = resolve(manifestPath);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, manifest, 'utf8');
  }

  console.log(
    'PASS: R23 supply-chain audit (' + files.length + ' file(s), ' + totalBytes +
    ' byte(s), no denied paths, unapproved binaries, or secret indicators; manifest SHA-256 ' +
    manifestSha256 + ').'
  );

  return Object.freeze({
    fileCount: files.length,
    totalBytes,
    manifest,
    manifestSha256
  });
}

async function main() {
  let releaseRoot = null;
  let version = null;
  let manifestPath = null;

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--release-root') releaseRoot = process.argv[++i];
    else if (arg === '--version') version = process.argv[++i];
    else if (arg === '--write-manifest') manifestPath = process.argv[++i];
    else fail('unknown argument: ' + arg);
  }

  if (!releaseRoot || !version) {
    console.error(
      'Usage: node tools/check-wordpress-supply-chain.mjs --release-root <path> --version <version> [--write-manifest <path>]'
    );
    process.exitCode = 2;
    return;
  }

  await auditReleaseRoot(releaseRoot, version, manifestPath);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
