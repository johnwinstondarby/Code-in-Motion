// console/v1 slice 2: stable absolute rendering (RENDERER-CONTRACT §9; CONSOLE-RENDERER-v1 §5).
// The deterministic rendering theorem: for every destination of the compiled 18-boundary Git
// specimen, every arrival path settles to identical canonical evidence, and that evidence equals
// the committed harness evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDomSvgRenderEvidence } from '../../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../../harness/minimal-dom.mjs';
import { ingestExperience } from '../../src/experience/ingest-experience.mjs';
import { RendererCancelledError } from '../../src/renderers/interface.mjs';
import { ConsoleRendererInputError } from '../../src/renderers/subjects/console/validate-console-input.mjs';
import { CONSOLE_RISK_LABELS, createConsoleRenderer } from '../../src/renderers/subjects/console/renderer.mjs';
import { createRendererAbortCapability, createRendererClockCapability } from '../../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../../src/runtime/renderer-context.mjs';
import { classifyRendererRejection } from '../../src/runtime/renderer-outcome.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const experience = ingestExperience(JSON.parse(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8')));
const committed = JSON.parse(readFileSync(resolve(ROOT, 'harness/evidence/console-v1/git-repository-practice.json'), 'utf8'));
const IDS = ['initial', ...experience.steps.map((s) => s.id)];
let sequence = 0;

function countingScheduler() {
  const counts = { schedule: 0, onFrame: 0 };
  return {
    counts,
    now: () => 0,
    schedule: () => { counts.schedule += 1; return `d-${counts.schedule}`; },
    cancel: () => false,
    onFrame: () => { counts.onFrame += 1; return `f-${counts.onFrame}`; }
  };
}

const stateFor = (id) => (id === 'initial' ? experience.initial_state : experience.steps.find((s) => s.id === id).state);

function transition(stepId, { animate = false, fromStepId = null, reducedMotion = false } = {}) {
  sequence += 1;
  const transitionId = `console-${sequence}`;
  const abort = createRendererAbortCapability();
  const scheduler = countingScheduler();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const context = createRendererContext({
    animate, fromState: fromStepId === null ? null : stateFor(fromStepId), fromStepId, stepId,
    rendererConfig: experience.renderer_config ?? null, stepRendererConfig: null,
    transitionId, abortSignal: abort.facade, clock: clock.facade, reducedMotion
  });
  return { abort, clock, scheduler, context };
}

async function settle(renderer, stepId, options) {
  const t = transition(stepId, options);
  await renderer.render(stateFor(stepId), t.context);
  t.clock.controller.revoke();
  t.abort.controller.close();
  return t;
}

function mounted() {
  const { document, root } = createMinimalRoot();
  const renderer = createConsoleRenderer();
  renderer.mount({ root, instanceId: 'console-fixture' });
  return { renderer, root, document };
}

const PATHS = ['sequential-animated', 'direct-seek', 'reverse-absolute', 'restart-then-seek', 'recovery-restoration', 'reduced-motion', 'replay-equivalent'];

async function evidenceFor(path, target) {
  const index = IDS.indexOf(target);
  const previous = IDS[Math.max(0, index - 1)];
  const later = IDS[Math.min(IDS.length - 1, index + 1)];
  const { renderer, root, document } = mounted();
  if (path === 'sequential-animated' || path === 'replay-equivalent') {
    await settle(renderer, previous);
    await settle(renderer, target, { animate: true, fromStepId: previous });
  } else if (path === 'direct-seek') {
    await settle(renderer, target);
  } else if (path === 'reverse-absolute') {
    await settle(renderer, later);
    await settle(renderer, target);
  } else if (path === 'restart-then-seek') {
    await settle(renderer, 'initial');
    await settle(renderer, target);
  } else if (path === 'recovery-restoration') {
    await settle(renderer, later);
    root.replaceChildren(document.createElement('garbage'));
    await settle(renderer, target);
  } else if (path === 'reduced-motion') {
    await settle(renderer, previous);
    await settle(renderer, target, { animate: true, fromStepId: previous, reducedMotion: true });
  }
  const evidence = createDomSvgRenderEvidence(root);
  renderer.dispose();
  return evidence;
}

test('[CR-A01] all seven arrival paths settle to identical canonical evidence at every one of the 19 destinations', async () => {
  assert.equal(IDS.length, 19);
  for (const target of IDS) {
    const baseline = await evidenceFor('direct-seek', target);
    for (const path of PATHS) {
      const evidence = await evidenceFor(path, target);
      assert.equal(evidence.canonicalizer_id, 'cim-dom-svg/v1');
      assert.equal(evidence.render_digest, baseline.render_digest, `${target} via ${path}`);
    }
  }
});

test('[CR-A02] an uninterrupted playthrough of the whole lesson matches the committed harness evidence at every boundary', async () => {
  const { renderer, root } = mounted();
  let from = null;
  for (const [index, stepId] of IDS.entries()) {
    await settle(renderer, stepId, from === null ? {} : { animate: true, fromStepId: from });
    assert.equal(createDomSvgRenderEvidence(root).render_digest, committed.boundaries[index].render_digest, stepId);
    from = stepId;
  }
  renderer.dispose();
});

test('[CR-A03] destinations are distinguishable: 19 boundaries produce 19 distinct digests', () => {
  assert.deepEqual(committed.boundaries.map((b) => b.step), IDS);
  assert.equal(new Set(committed.boundaries.map((b) => b.render_digest)).size, 19);
});

test('[CR-A04] stable settlement consumes no time: no delayed or frame callbacks on any arrival', async () => {
  const { renderer } = mounted();
  for (const [index, stepId] of IDS.entries()) {
    const t = await settle(renderer, stepId, index === 0 ? {} : { animate: true, fromStepId: IDS[index - 1] });
    assert.deepEqual(t.scheduler.counts, { schedule: 0, onFrame: 0 }, stepId);
  }
});

test('[CR-A05] invalid destination input rejects with ConsoleRendererInputError and leaves the last stable output untouched', async () => {
  const { renderer, root } = mounted();
  await settle(renderer, 'stage-hunk--s02');
  const before = createDomSvgRenderEvidence(root);
  const bad = structuredClone(stateFor('stage-hunk--s03'));
  bad.focus = ['ghost'];
  const t = transition('stage-hunk--s03');
  let rejection;
  await assert.rejects(renderer.render(bad, t.context), (error) => { rejection = error; return error instanceof ConsoleRendererInputError && error.violations[0].rule === 'focus-target'; });
  assert.equal(createDomSvgRenderEvidence(root).render_digest, before.render_digest);
  // Runtime classifies the rejection as a renderer error (CIM-RND-004 recovery), never as cancellation.
  assert.equal(classifyRendererRejection(rejection, { abortSignal: t.context.abortSignal, transitionId: t.context.transitionId }).kind, 'error');
});

test('[CR-A06] aborted, unmounted, and disposed renders reject without touching output', async () => {
  const { renderer, root } = mounted();
  await settle(renderer, 'commit--s02');
  const before = createDomSvgRenderEvidence(root).render_digest;
  const t = transition('push--s01');
  t.abort.controller.abort('navigation');
  await assert.rejects(renderer.render(stateFor('push--s01'), t.context), (error) => error instanceof RendererCancelledError && error.reason === 'navigation');
  assert.equal(createDomSvgRenderEvidence(root).render_digest, before);
  const fresh = createConsoleRenderer();
  await assert.rejects(fresh.render(stateFor('push--s01'), transition('push--s01').context), /mounted/);
  renderer.dispose();
  await assert.rejects(renderer.render(stateFor('push--s01'), transition('push--s01').context), /disposed/);
});

// ---- presentation obligations (CONSOLE-RENDERER-v1 §4) on rendered structure ----
const find = (node, role, out = []) => {
  if (node.nodeType === 1 && node.getAttribute?.('data-role') === role) out.push(node);
  for (const child of node.childNodes ?? []) find(child, role, out);
  return out;
};
const text = (node) => (node.nodeType === 3 ? node.nodeValue : (node.childNodes ?? []).map(text).join(''));
async function rendered(stepId) { const { renderer, root } = mounted(); await settle(renderer, stepId); return root; }

test('[CR-B01] real text: commands, prompts, and output render as text nodes, with leading spaces preserved', async () => {
  const root = await rendered('check-status--s02');
  assert.equal(text(find(root, 'command')[0]), 'git status');
  assert.equal(text(find(root, 'prompt')[0]), experience.renderer_config.prompt);
  assert.ok(find(root, 'output-text').some((n) => text(n) === '        modified:   src/HeaderFix.jsx'));
});

test('[CR-B02] badge derives from the last entry risk; gutter marks persist in history', async () => {
  const reset = await rendered('discard-commit--s02');
  assert.equal(text(find(reset, 'risk-badge')[0]), CONSOLE_RISK_LABELS['cannot-be-undone']);
  const reflog = await rendered('find-in-reflog--s01');
  assert.equal(find(reflog, 'risk-badge').length, 0, 'reflog carries no risk, so no badge');
  assert.deepEqual(find(reflog, 'risk-mark').map((n) => n.getAttribute('data-risk')),
    ['free-to-undo', 'leaves-a-trace', 'leaves-a-trace', 'cannot-be-undone']);
});

test('[CR-B03] focus marks exactly the focused lines; tone is untouched by focus', async () => {
  const root = await rendered('stage-hunk--s02');
  const focused = find(root, 'output-line').filter((n) => n.getAttribute('data-focused') === 'true');
  assert.deepEqual(focused.map((n) => n.getAttribute('data-output-id')), ['hunk-removed', 'hunk-added']);
  assert.deepEqual(focused.map((n) => n.getAttribute('data-tone')), ['removed', 'added']);
  const settled = await rendered('stage-hunk--s04');
  assert.equal(find(settled, 'output-line').filter((n) => n.getAttribute('data-focused') === 'true').length, 0);
});

test('[CR-B04] interactive prompt: awaiting state has no response; settled state appends it after a Player separator', async () => {
  const waiting = await rendered('stage-hunk--s03');
  const prompt = find(waiting, 'output-line').at(-1);
  assert.equal(prompt.getAttribute('data-awaiting-response'), 'true');
  assert.equal(find(waiting, 'response').length, 0);
  const done = await rendered('stage-hunk--s04');
  const line = find(done, 'output-line').find((n) => find(n, 'response').length > 0);
  assert.equal(text(line), '(1/1) Stage this hunk [y,n,q,a,d,e,?]? y');
  assert.equal(line.getAttribute('data-awaiting-response'), null);
});

test('[CR-B05] copy controls are inert and carry the resolved value, including the safe recovery substitution', async () => {
  const root = await rendered('recover-from-reflog--s02');
  const controls = find(root, 'copy');
  assert.equal(controls.length, 8);
  assert.equal(controls.at(-1).getAttribute('data-copy'), 'git reset --hard <sha-from-your-reflog>');
  assert.equal(text(find(root, 'command').at(-1)), 'git reset --hard 7a3c91d');
  for (const control of controls) {
    assert.equal(control.localName, 'button');
    assert.equal(control.getAttribute('type'), 'button');
    assert.equal(Object.keys(control).some((k) => /^on|listener/i.test(k)), false);
  }
});
