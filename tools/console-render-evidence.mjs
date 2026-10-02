// Canonical render evidence for compiled console/v1 experiences, through the harness-owned
// cim-dom-svg/v1 canonicalizer (RENDERER-CONTRACT §11).
//   node tools/console-render-evidence.mjs --write   regenerate committed evidence
//   node tools/console-render-evidence.mjs --check   fail unless committed evidence is current
// Evidence is produced by direct, non-animated settlement at every boundary. Equivalence of the
// other arrival paths is proven by tests/conformance/console-absolute-state.test.mjs.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { createConsoleRenderer } from '../src/renderers/subjects/console/renderer.mjs';
import { createRendererAbortCapability, createRendererClockCapability } from '../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../src/runtime/renderer-context.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONSOLE_EVIDENCE_BUILDS = Object.freeze([
  Object.freeze({ experience: 'experiences/git/git-repository-practice.json', evidence: 'harness/evidence/console-v1/git-repository-practice.json' })
]);

const inertScheduler = () => ({
  now: () => 0,
  schedule: () => { throw new Error('evidence settlement must not schedule'); },
  cancel: () => false,
  onFrame: () => { throw new Error('evidence settlement must not request frames'); }
});

export async function settleDirect(renderer, experience, stepId, sequence) {
  const step = stepId === 'initial' ? null : experience.steps.find((s) => s.id === stepId);
  const transitionId = `evidence-${sequence}`;
  const abort = createRendererAbortCapability();
  const clock = createRendererClockCapability({ transitionId, scheduler: inertScheduler() });
  const context = createRendererContext({
    animate: false, fromState: null, fromStepId: null, stepId,
    rendererConfig: experience.renderer_config ?? null,
    stepRendererConfig: step?.renderer_config ?? null,
    transitionId, abortSignal: abort.facade, clock: clock.facade, reducedMotion: false
  });
  await renderer.render(step ? step.state : experience.initial_state, context);
  clock.controller.revoke();
  abort.controller.close();
}

export async function buildConsoleEvidence(experienceText) {
  const experience = ingestExperience(JSON.parse(experienceText));
  const boundaries = [];
  const ids = ['initial', ...experience.steps.map((s) => s.id)];
  for (const [index, stepId] of ids.entries()) {
    const { root } = createMinimalRoot();
    const renderer = createConsoleRenderer();
    renderer.mount({ root, instanceId: 'evidence' });
    await settleDirect(renderer, experience, stepId, index);
    boundaries.push({ step: stepId, render_digest: createDomSvgRenderEvidence(root).render_digest });
    renderer.dispose();
  }
  const evidence = {
    canonicalizer_id: 'cim-dom-svg/v1',
    renderer: 'console/v1',
    experience_id: experience.id,
    experience_version: experience.experience_version,
    experience_sha256: createHash('sha256').update(experienceText, 'utf8').digest('hex'),
    boundaries
  };
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

async function main(mode) {
  for (const build of CONSOLE_EVIDENCE_BUILDS) {
    const text = await buildConsoleEvidence(await readFile(resolve(ROOT, build.experience), 'utf8'));
    const target = resolve(ROOT, build.evidence);
    if (mode === '--write') { await writeFile(target, text, 'utf8'); console.log(`Wrote ${build.evidence}.`); continue; }
    let committed = null;
    try { committed = await readFile(target, 'utf8'); } catch { /* reported below */ }
    if (committed !== text) throw new Error(`console/v1 render evidence ${build.evidence} is missing or stale; review the rendering change, then run npm run evidence:console.`);
  }
  if (mode === '--check') console.log(`PASS: R42 console/v1 canonical render evidence (${CONSOLE_EVIDENCE_BUILDS.length} experience(s)).`);
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invoked === import.meta.url) {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') { console.error('Usage: node tools/console-render-evidence.mjs --write | --check'); process.exitCode = 2; }
  else main(mode).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
