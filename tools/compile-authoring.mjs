// Authoring v1 compiler CLI and repository gate.
//   node tools/compile-authoring.mjs --write   regenerate every registered compiled output + provenance
//   node tools/compile-authoring.mjs --check   fail unless committed outputs are byte-current, the
//                                              authoring fixture suite holds, and evidence corresponds
//   node tools/compile-authoring.mjs <source.json> [--out <file>]   compile one source (stdout by default)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { AuthoringCompilationError, compileAuthoringSource } from '../authoring/v1/compile-authoring.mjs';
import { consoleStateViolations } from '../authoring/v1/console-state-conformance.mjs';
import { evidenceCorrespondenceViolations } from '../authoring/v1/evidence-conformance.mjs';
import { DIAGNOSTICS as AUTHORING_DIAGNOSTICS, validate as validateAuthoring } from '../authoring/v1/validate-authoring.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Registered authoring sources and their committed generated outputs.
export const AUTHORING_BUILDS = Object.freeze([
  Object.freeze({
    source: 'experiences/git/git-repository-practice.authoring.json',
    output: 'experiences/git/git-repository-practice.json',
    provenance: 'experiences/git/git-repository-practice.provenance.json',
    boundaries: 18
  })
]);

const at = (relative) => resolve(ROOT, ...relative.split('/'));
function fail(message) { throw new Error(`Authoring v1: ${message}`); }

async function compileBuild(build) {
  const sourceText = await readFile(at(build.source), 'utf8');
  const result = compileAuthoringSource(sourceText);
  if (result.document.steps.length !== build.boundaries) {
    fail(`${build.source} compiled to ${result.document.steps.length} boundaries; expected ${build.boundaries}.`);
  }
  const stateViolations = consoleStateViolations(result.document);
  if (stateViolations.length) fail(`${build.source} violates CONSOLE-RENDERER-v1:\n${stateViolations.map((v) => `  ${v.at}: ${v.message}`).join('\n')}`);
  const violations = evidenceCorrespondenceViolations(result.document);
  if (violations.length) fail(`${build.source} evidence correspondence failed:\n${violations.map((v) => `  ${v.rule} ${v.at}: ${v.message}`).join('\n')}`);
  return result;
}

async function checkFixtureSuite() {
  const dir = at('authoring/v1/fixtures');
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
  const seen = new Set();
  const uniq = (list) => [...new Set(list)].sort().join(',');
  for (const [file, expected] of Object.entries(manifest)) {
    const diagnostics = validateAuthoring(await readFile(`${dir}/${file}`, 'utf8'));
    const errors = diagnostics.filter((d) => d.severity === 'error').map((d) => d.id);
    const warnings = diagnostics.filter((d) => d.severity === 'warning').map((d) => d.id);
    [...errors, ...warnings].forEach((id) => seen.add(id));
    if (uniq(errors) !== uniq(expected.errors) || uniq(warnings) !== uniq(expected.warnings)) {
      fail(`fixture ${file} expected [${[...expected.errors, ...expected.warnings]}] but produced [${[...new Set([...errors, ...warnings])]}].`);
    }
  }
  const uncovered = Object.keys(AUTHORING_DIAGNOSTICS).filter((id) => !seen.has(id));
  if (uncovered.length) fail(`diagnostics not exercised by any fixture: ${uncovered.join(', ')}.`);
  return Object.keys(manifest).length;
}

export async function checkAuthoringBuilds() {
  const fixtureCount = await checkFixtureSuite();
  let boundaries = 0;
  for (const build of AUTHORING_BUILDS) {
    const result = await compileBuild(build);
    const committed = await readFile(at(build.output), 'utf8');
    if (committed !== result.text) fail(`${build.output} is stale relative to ${build.source}; run npm run compile:authoring.`);
    const committedProvenance = await readFile(at(build.provenance), 'utf8');
    if (committedProvenance !== result.provenanceText) fail(`${build.provenance} is stale; run npm run compile:authoring.`);
    boundaries += result.document.steps.length;
  }
  return { fixtureCount, builds: AUTHORING_BUILDS.length, boundaries };
}

async function writeAuthoringBuilds() {
  for (const build of AUTHORING_BUILDS) {
    const result = await compileBuild(build);
    await writeFile(at(build.output), result.text, 'utf8');
    await writeFile(at(build.provenance), result.provenanceText, 'utf8');
    console.log(`Compiled ${build.source} -> ${build.output} (${result.document.steps.length} boundaries, sha256 ${result.provenance.runtime_sha256}).`);
  }
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === '--check') {
    const { fixtureCount, builds, boundaries } = await checkAuthoringBuilds();
    console.log(`PASS: R42 authoring v1 (${fixtureCount} validator fixture(s), ${builds} compiled experience(s) byte-current, ${boundaries} boundaries conforming to CONSOLE-RENDERER-v1 with evidence correspondence).`);
    return;
  }
  if (argv.length === 1 && argv[0] === '--write') { await writeAuthoringBuilds(); return; }
  const source = argv[0];
  if (!source || source.startsWith('--')) {
    console.error('Usage: node tools/compile-authoring.mjs --check | --write | <source.json> [--out <file>]');
    process.exitCode = 2;
    return;
  }
  const result = compileAuthoringSource(await readFile(resolve(source), 'utf8'));
  const outIndex = argv.indexOf('--out');
  if (outIndex !== -1) await writeFile(resolve(argv[outIndex + 1]), result.text, 'utf8');
  else process.stdout.write(result.text);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    if (error instanceof AuthoringCompilationError) {
      for (const d of error.diagnostics) {
        console.error(`${d.code} ${d.path}: ${d.message}`);
        for (const cause of d.causes ?? []) console.error(`  ${cause.id ?? cause.code} ${cause.path}: ${cause.message}`);
      }
    } else console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
