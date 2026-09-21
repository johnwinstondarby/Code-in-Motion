import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAIR_FILE = 'upgrade-pair.json';

function fail(message) {
  throw new Error('WordPress upgrade pair: ' + message);
}
async function readPackageVersion(root) {
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const version = packageJson.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail('package version must be SemVer core form in ' + root + '.');
  }
  return version;
}
function git(args, { cwd = ROOT, stdio = ['ignore', 'pipe', 'pipe'] } = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio });
}
export function selectPriorReleaseCandidate(candidates, currentVersion) {
  if (!Array.isArray(candidates) || candidates.length === 0) fail('history candidates are required.');
  for (const candidate of candidates) {
    if (candidate !== null && typeof candidate === 'object' &&
        typeof candidate.sha === 'string' && typeof candidate.version === 'string' &&
        candidate.version !== currentVersion) {
      return Object.freeze({ sha: candidate.sha, version: candidate.version });
    }
  }
  fail('no prior release version exists in first-parent history.');
}
async function findPriorRelease(currentVersion) {
  const shas = git(['rev-list', '--first-parent', 'HEAD'])
    .trim().split(/\r?\n/).filter(Boolean);
  const candidates = [];
  for (const sha of shas) {
    let source;
    try { source = git(['show', sha + ':package.json']); }
    catch { continue; }
    let version;
    try { version = JSON.parse(source).version; }
    catch { continue; }
    if (typeof version !== 'string') continue;
    candidates.push({ sha, version });
    if (version !== currentVersion) break;
  }
  return selectPriorReleaseCandidate(candidates, currentVersion);
}
export async function resolveWordPressUpgradePair(root = ROOT) {
  const currentVersion = await readPackageVersion(root);
  const currentSha = git(['rev-parse', 'HEAD']).trim();
  const prior = await findPriorRelease(currentVersion);
  return Object.freeze({
    prior,
    current: Object.freeze({ sha: currentSha, version: currentVersion })
  });
}
export async function buildPriorWordPressRelease({ artifactDir, root = ROOT }) {
  if (typeof artifactDir !== 'string' || artifactDir.length === 0) {
    fail('artifactDir must be a non-empty path.');
  }
  const pair = await resolveWordPressUpgradePair(root);
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'cim-wordpress-prior-'));
  const worktree = resolve(tempRoot, 'checkout');
  const outputDir = resolve(artifactDir);
  try {
    git(['worktree', 'add', '--detach', worktree, pair.prior.sha], { cwd: root });
    execFileSync(process.execPath, [resolve(worktree, 'tools', 'build-wordpress-release.mjs')], {
      cwd: worktree,
      stdio: 'inherit'
    });
    const zipName = 'code-in-motion-' + pair.prior.version + '.zip';
    const checksumName = zipName + '.sha256';
    await mkdir(outputDir, { recursive: true });
    await copyFile(resolve(worktree, 'dist', zipName), resolve(outputDir, zipName));
    await copyFile(resolve(worktree, 'dist', checksumName), resolve(outputDir, checksumName));
    await writeFile(resolve(outputDir, PAIR_FILE), JSON.stringify(pair, null, 2) + '\n', 'utf8');
  } finally {
    try { git(['worktree', 'remove', '--force', worktree], { cwd: root }); }
    catch {}
    await rm(tempRoot, { recursive: true, force: true });
  }
  console.log('PASS: WordPress upgrade pair (' +
    pair.prior.version + ' @ ' + pair.prior.sha.slice(0, 12) + ' -> ' +
    pair.current.version + ' @ ' + pair.current.sha.slice(0, 12) + ').');
  return pair;
}
function parseArgs(args) {
  if (args.length === 2 && args[0] === '--artifact-dir' && args[1]) return { artifactDir: args[1] };
  fail('usage: node tools/build-wordpress-upgrade-fixture.mjs --artifact-dir <path>');
}
const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  buildPriorWordPressRelease(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
