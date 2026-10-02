// R42 QA evidence: proves the v1+v2 runtime validator preserves v1 behavior exactly.
// Compares diagnostic code+path from the pre-R42 validator (extracted from git history at the
// baseline commit) against the current validator, over every repository v1 document plus
// mutation probes. Requires a full git history; not part of `npm run verify`.
// Usage: node tools/r42-v1-differential.mjs [baseline-commit]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = process.argv[2] ?? '57499893fec330769baef8d514a41a38a0b17e02';
const ROOTS = ['schemas/fixtures', 'experiences', 'wordpress/experiences', 'authoring/generated', 'authoring/cim/fixtures'];

const temp = mkdtempSync(join(tmpdir(), 'cim-r42-diff-'));
try {
  const baselineSource = execFileSync('git', ['show', `${BASELINE}:src/experience/validate-experience.mjs`], { cwd: ROOT, encoding: 'utf8' });
  const baselinePath = join(temp, 'baseline-validate-experience.mjs');
  writeFileSync(baselinePath, baselineSource);
  const { validateExperience: baseline } = await import(pathToFileURL(baselinePath).href);
  const { validateExperience: current } = await import(pathToFileURL(join(ROOT, 'src', 'experience', 'validate-experience.mjs')).href);

  const files = [];
  const walk = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (path.endsWith('.json')) files.push(path); } };
  ROOTS.forEach((root) => walk(join(ROOT, root)));
  files.sort();

  const signature = (errors) => JSON.stringify(errors.map((error) => `${error.code} ${error.path}`).sort());
  const probeBase = JSON.parse(readFileSync(join(ROOT, 'schemas/fixtures/valid/synthetic-basic.json'), 'utf8'));
  const probes = {
    'v2 beat field on v1 step': (d) => { d.steps[0].beat = { id: 'x' }; },
    'v2 presentation on v1': (d) => { d.presentation = { title: 'T' }; },
    'v2 commentary evidence on v1': (d) => { d.steps[0].commentary.evidence = ['value']; },
    'v2 commentary risk on v1': (d) => { d.steps[0].commentary.risk = { level: 'free-to-undo' }; },
    'generated --s01 id on v1': (d) => { d.steps[0].id = 'step--s01'; },
    'javascript link': (d) => { d.steps[0].commentary.links = [{ id: 'a', label: 'x', href: 'javascript:alert(1)' }]; },
    'duplicate link id': (d) => { d.steps[0].commentary.links = [{ id: 'a', label: 'x', href: '/a' }, { id: 'a', label: 'y', href: '/b' }]; },
    'negative dwell': (d) => { d.steps[0].dwell_ms = -1; },
    'reserved initial': (d) => { d.steps[0].id = 'initial'; },
    'null state': (d) => { d.steps[0].state = null; },
    'empty label': (d) => { d.steps[0].label = ''; },
    'malformed renderer': (d) => { d.renderer = 'Synthetic'; },
  };

  let identical = 0, skipped = 0; const differences = [];
  for (const file of files) {
    let doc; try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch { skipped++; continue; }
    if (doc?.schema === 'localis.cim/v2') { skipped++; continue; }
    const a = signature(baseline(doc)), b = signature(current(doc));
    if (a === b) identical++; else differences.push({ case: file.slice(ROOT.length + 1), baseline: a, current: b });
  }
  for (const [name, mutate] of Object.entries(probes)) {
    const doc = structuredClone(probeBase); mutate(doc);
    const a = signature(baseline(doc)), b = signature(current(doc));
    if (a === b) identical++; else differences.push({ case: `probe: ${name}`, baseline: a, current: b });
  }
  for (const d of differences) console.log(`DIFF ${d.case}\n  baseline ${d.baseline}\n  current  ${d.current}`);
  console.log(`${differences.length ? 'FAIL' : 'PASS'}: R42 v1 differential against ${BASELINE.slice(0, 12)} — ${identical} identical, ${differences.length} different, ${skipped} skipped (v2 or non-JSON)`);
  process.exitCode = differences.length ? 1 : 0;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
