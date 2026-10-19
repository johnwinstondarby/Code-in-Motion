import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RULES } from '../authoring/v3/validate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = process.argv.find(a => a.startsWith('--work-directory='));
const work = resolve(arg?.slice(17) ?? resolve(root, '../v3-mutations'));
await mkdir(work, { recursive: true });
const sandbox = await mkdtemp(resolve(work, 'candidate-'));
await cp(root, sandbox, { recursive: true, filter: p => !['.git','node_modules','dist','test-results','work'].includes(basename(p)) });
await symlink(resolve(root, 'node_modules'), resolve(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
function run(rule = null) {
  return spawnSync(process.execPath, ['--test', ...(rule ? ['--test-name-pattern', `v3 fixture ${rule}:`] : []), 'tests/authoring-v3.test.mjs'], { cwd: sandbox, encoding: 'utf8', timeout: 120000 });
}
let result = run();
await writeFile(resolve(work, 'baseline.log'), result.stdout + result.stderr);
if (result.status !== 0) throw new Error('V3 mutation baseline failed: ' + result.stdout + result.stderr);
const report = [];
for (const rule of Object.keys(RULES)) {
  const path = resolve(sandbox, rule === 'CIM-V3-EVIDENCE' ? 'authoring/v3/files.mjs' : 'authoring/v3/validate.mjs');
  const original = await readFile(path, 'utf8');
  // Remove this rule's enforcement in an isolated copy; production code has no
  // rule-disabling option. Fixtures assert rejection before checking diagnostics.
  const from = rule === 'CIM-V3-EVIDENCE' ? "if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256)" : 'if (condition) diagnostics.push';
  const to = rule === 'CIM-V3-EVIDENCE' ? "if (false && createHash('sha256').update(bytes).digest('hex') !== entry.sha256)" : `if (condition && id !== '${rule}') diagnostics.push`;
  if (!original.includes(from)) throw new Error('Missing mutation target: ' + rule);
  await writeFile(path, original.replace(from, to));
  try { result = run(rule); }
  finally { await writeFile(path, original); }
  await writeFile(resolve(work, rule + '.log'), result.stdout + result.stderr);
  if (result.error || result.status === 0 || !/AssertionError|ERR_ASSERTION/.test(result.stdout + result.stderr) || /TypeError:|ReferenceError:|SyntaxError:/.test(result.stdout + result.stderr)) throw new Error('Mutation did not fail for the intended assertion: ' + rule + '\n' + result.stdout + result.stderr);
  report.push({ rule, caught: true, reason: 'invalid fixture accepted after enforcement removal' });
  console.log('CAUGHT ' + rule);
}
await writeFile(resolve(work, 'results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${report.length} v3 validation rules independently bypassed and caught. Node ${process.versions.node}.`);
