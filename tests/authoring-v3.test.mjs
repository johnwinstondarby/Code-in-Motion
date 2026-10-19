import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, rm, symlink, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import { SCHEMAS, LIMITS, RULES, validateDocument, validateBundle, canonicalJSON } from '../authoring/v3/validate.mjs';
import { validateArchiveFiles, validateV3File, decodeJSON } from '../authoring/v3/files.mjs';
import { proveEnvelope } from '../authoring/v3/prove-envelope.mjs';
import { validateExperience } from '../src/experience/validate-experience.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { assertEngineCompatibility } from '../src/experience/engine-compatibility.mjs';
import { assertWordPressExperienceAdmission } from '../src/host/wordpress-admission-policy.mjs';
import { createWordPressRendererRegistry } from '../wordpress/assets/renderer-registry.mjs';
import { compileAuthoringSource as compileV1 } from '../authoring/v1/compile-authoring.mjs';
import { compileAuthoringSource as compileV2 } from '../authoring/v2/compile-authoring.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = resolve(root, 'authoring/v3/fixtures');
const source = await readFile(join(fixtures, 'valid/run-custody/lesson.json'), 'utf8');
const captureText = await readFile(join(fixtures, 'valid/run-custody/capture.json'), 'utf8');
const lesson = JSON.parse(source), capture = JSON.parse(captureText);
const manifest = JSON.parse(await readFile(join(fixtures, 'manifest.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });

for (const example of ['run-custody', 'context-chain']) test(`v3 valid ${example}: schemas, references, archive and deterministic Diagram derivation`, async () => {
  const dir = join(fixtures, 'valid', example);
  const a = await readFile(join(dir, 'lesson.json'), 'utf8'), c = await readFile(join(dir, 'capture.json'), 'utf8');
  const result = validateBundle(a, c);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.states.length, example === 'run-custody' ? 8 : 9);
  assert(ajv.compile(SCHEMAS.authoring)(JSON.parse(a)));
  assert(ajv.compile(SCHEMAS.capture)(JSON.parse(c)));
  await validateArchiveFiles(result.capture, dir);
  const proof = proveEnvelope(a, c);
  assert.deepEqual(validateExperience(proof.document), []);
  assert.equal(proveEnvelope(a, c).text, proof.text);
  assert.equal(proveEnvelope(canonicalJSON(JSON.parse(a)), canonicalJSON(JSON.parse(c))).text, proof.text);
  assert.equal(proof.document.renderer, 'panes/v1');
  assert.equal(proof.document.renderer_config.placeholder.label, 'Placeholder content');
  assert.equal(proof.document.steps.at(-2).state.panes.engineering.artifacts.job.status, 'verified');
  assert.equal(proof.document.steps.at(-1).state.panes.engineering.artifacts.job.status, 'reproduced');
  const context = proof.document.steps.find(s => s.id === 'review-run-metadata');
  assert.equal(context.state.action_tab, 'console');
  assert.equal(context.state.panes.console.lines[0], 'sbatch train.sbatch');
});

test('v3 envelope feasibility does not register or admit a new renderer', () => {
  const doc = proveEnvelope(source, captureText).document;
  assert.equal(ingestExperience(doc).renderer, 'panes/v1');
  assert.throws(() => assertEngineCompatibility(doc));
  assert.throws(() => assertWordPressExperienceAdmission(doc));
  assert.equal(createWordPressRendererRegistry().has('panes/v1'), false);
});

for (const entry of manifest.invalid) test(`v3 fixture ${entry.rule}: ${entry.name}`, async () => {
  const text = await readFile(join(fixtures, entry.file), 'utf8');
  if (entry.mode === 'archive') {
    await assert.rejects(() => validateArchiveFiles(JSON.parse(text), join(fixtures, 'valid/run-custody')), e => e.diagnostics.some(d => d.id === entry.rule && d.path.startsWith(entry.path) && d.fix));
    return;
  }
  const result = entry.mode === 'bundle' ? validateBundle(text, captureText) : validateDocument(text, entry.kind);
  assert(result.diagnostics.length > 0, 'Invalid fixture must be rejected.');
  assert(result.diagnostics.some(d => d.id === entry.rule && d.path.startsWith(entry.path) && d.fix && d.message.includes('Fix:')), JSON.stringify(result.diagnostics));
});

test('v3 fixture inventory exercises every declared diagnostic rule', () => {
  assert.deepEqual([...new Set(manifest.invalid.map(e => e.rule))].sort(), Object.keys(RULES).sort());
});

test('v3 JSON guards reject duplicate keys, depth, bytes, nested unknown fields and invalid UTF-8', () => {
  assert(validateDocument(source.replace('"placeholder": true', '"placeholder": true, "placeholder": true'), 'authoring').diagnostics.some(d => d.id === 'CIM-V3-ID'));
  assert(validateDocument(' '.repeat(LIMITS.bytes + 1), 'authoring').diagnostics.some(d => d.id === 'CIM-V3-LIMIT'));
  assert(validateDocument('['.repeat(40) + '0' + ']'.repeat(40), 'authoring').diagnostics.some(d => d.id === 'CIM-V3-LIMIT'));
  const doc = structuredClone(lesson); doc.beats[0].actions[0].limn = [];
  assert(validateDocument(doc, 'authoring').diagnostics.some(d => d.id === 'CIM-V3-SHAPE'));
  assert.throws(() => decodeJSON(new Uint8Array([0x22, 0xff, 0x22])), e => e.diagnostics[0].id === 'CIM-V3-PARSE');
});

test('v3 cross-validation rejects every unresolved entity, orphan/reused records and false provenance', () => {
  for (const key of ['beat', 'pane', 'host', 'service', 'artifact', 'evidence']) {
    const bad = structuredClone(capture); bad.records[0][key] = 'missing';
    assert(validateBundle(lesson, bad).diagnostics.some(d => d.id === 'CIM-V3-CAPTURE-REFERENCE'), key);
  }
  for (const change of [d => { d.records[0].from = 'git'; }, d => { d.records[0].result.location = 'gpu'; }, d => { d.records[0].result.status = 'reproduced'; }]) {
    const bad = structuredClone(capture); change(bad);
    assert(validateBundle(lesson, bad).diagnostics.some(d => d.id === 'CIM-V3-DIAGRAM-STATE'));
  }
  const orphan = structuredClone(capture); orphan.records.push({ ...orphan.records[0], id: 'orphan' });
  assert(validateBundle(lesson, orphan).diagnostics.some(d => d.id === 'CIM-V3-CAPTURE-REFERENCE'));
  const reused = structuredClone(lesson); reused.beats[1].engineering.records.push(capture.records[0].id);
  assert(validateBundle(reused, capture).diagnostics.some(d => d.id === 'CIM-V3-CAPTURE-REFERENCE'));
  const placeholder = structuredClone(lesson); placeholder.placeholder = false;
  assert(validateBundle(placeholder, capture).diagnostics.some(d => d.id === 'CIM-V3-PLACEHOLDER'));
});

test('v3 schema arrays and field limits are enforced at the declared boundaries', () => {
  for (const [kind, original, path, length] of [['authoring', lesson, 'hosts', 32], ['authoring', lesson, 'artifacts', 128], ['capture', capture, 'records', 512]]) {
    const bad = structuredClone(original); const base = bad[path][0];
    bad[path] = Array.from({ length: length + 1 }, (_, i) => typeof base === 'string' ? 'item-' + i : { ...base, id: 'item-' + i });
    assert(validateDocument(bad, kind).diagnostics.some(d => d.id === 'CIM-V3-LIMIT'), path);
  }
  const long = structuredClone(lesson); long.beats[0].explanation.text = 'x'.repeat(16385);
  assert(validateDocument(long, 'authoring').diagnostics.some(d => d.id === 'CIM-V3-LIMIT'));
  const exact = structuredClone(lesson); exact.beats[0].explanation.text = 'x'.repeat(16384);
  assert.deepEqual(validateDocument(exact, 'authoring').diagnostics, []);
});

test('v3 archive refuses traversal, escaping junctions, missing/tampered files and oversize', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cim-v3-archive-'));
  try {
    await cp(join(fixtures, 'valid/run-custody'), join(dir, 'bundle'), { recursive: true });
    const bad = structuredClone(capture); bad.archive.root = '../outside';
    await assert.rejects(() => validateArchiveFiles(bad, join(dir, 'bundle')), e => e.diagnostics[0].id === 'CIM-V3-ARCHIVE-PATH');
    await mkdir(join(dir, 'outside')); await writeFile(join(dir, 'outside', 'transcript.txt'), 'outside');
    await symlink(join(dir, 'outside'), join(dir, 'bundle', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    bad.archive.root = 'escape';
    await assert.rejects(() => validateArchiveFiles(bad, join(dir, 'bundle')), e => e.diagnostics[0].id === 'CIM-V3-ARCHIVE-PATH');
    await writeFile(join(dir, 'bundle/raw/transcript.txt'), 'tampered');
    await assert.rejects(() => validateArchiveFiles(capture, join(dir, 'bundle')), e => e.diagnostics[0].id === 'CIM-V3-EVIDENCE');
    await writeFile(join(dir, 'bundle/raw/transcript.txt'), Buffer.alloc(LIMITS.evidenceBytes + 1));
    await assert.rejects(() => validateArchiveFiles(capture, join(dir, 'bundle')), e => e.diagnostics[0].id === 'CIM-V3-LIMIT');
    await rm(join(dir, 'bundle/raw/transcript.txt'));
    await assert.rejects(() => validateArchiveFiles(capture, join(dir, 'bundle')), e => e.diagnostics[0].id === 'CIM-V3-EVIDENCE');
  } finally { assert(dir.startsWith(join(tmpdir(), 'cim-v3-archive-'))); await rm(dir, { recursive: true, force: true }); }
});

test('v3 CLI validates lesson, capture and pack without enabling compile/pack or losing actionable causes', async () => {
  for (const file of ['valid/run-custody/lesson.json', 'valid/context-chain/lesson.json', 'valid/run-custody/capture.json', 'valid/pack.json']) {
    const r = spawnSync(process.execPath, ['tools/cim-author.mjs', 'validate', join(fixtures, file)], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /schema validation only, not Player admission/);
  }
  for (const command of ['compile', 'pack']) {
    const r = spawnSync(process.execPath, ['tools/cim-author.mjs', command, join(fixtures, 'valid/run-custody/lesson.json'), '--out', 'must-not-exist.zip'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /validate only/);
  }
  const r = spawnSync(process.execPath, ['tools/cim-author.mjs', 'validate', join(fixtures, 'invalid/wrong-tab.json')], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /CIM-V3-ACTION-TAB \$\.beats\[0\]\.action_tab/); assert.match(r.stderr, /Fix:/);
});

test('v3 pack schema is validation-only with a closed deferred media map', async () => {
  const pack = JSON.parse(await readFile(join(fixtures, 'valid/pack.json'), 'utf8'));
  assert(ajv.compile(SCHEMAS.pack)(pack));
  assert.deepEqual(validateDocument(pack, 'pack').diagnostics, []);
  for (const minimum of ['0.2.6', '1.0.1', '01.1.0', '1.1.0-beta']) {
    const bad = { ...pack, cim_min: minimum }; assert(validateDocument(bad, 'pack').diagnostics.length);
  }
  const bad = structuredClone(pack); bad.lessons[0].file = '../lesson.json';
  assert(validateDocument(bad, 'pack').diagnostics.some(d => d.id === 'CIM-V3-ARCHIVE-PATH'));
});

test('v3 work preserves all 77 frozen v1/v2 files and 66 source outputs or rejection messages', async () => {
  const baseline = JSON.parse(await readFile(resolve(root, 'tests/fixtures/authoring-v3-legacy-baseline.json'), 'utf8'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  for (const [file, digest] of Object.entries(baseline.frozenFiles)) assert.equal(hash(await readFile(resolve(root, file))), digest, file);
  function signature(compile, text) {
    try { const result = compile(text); return { accepted: true, text: hash(result.text), provenance: hash(result.provenanceText) }; }
    catch (e) { return { accepted: false, diagnostics: hash(JSON.stringify({ message: e.message, diagnostics: e.diagnostics, causes: e.causes })) }; }
  }
  for (const entry of baseline.samples) {
    const text = await readFile(resolve(root, entry.file), 'utf8');
    assert.deepEqual(signature(compileV1, text), entry.v1, entry.file + ' v1');
    assert.deepEqual(signature(compileV2, text), entry.v2, entry.file + ' v2');
  }
});
