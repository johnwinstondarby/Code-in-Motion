// console/v1 slice 3: timed presentation (RENDERER-CONTRACT §6, §9; CONSOLE-RENDERER-v1 §4.5).
// Time may change the route to a destination; it may not change the destination. Every animated
// arrival must settle byte-for-byte to the protected 19-digest oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDomSvgRenderEvidence } from '../../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../../harness/minimal-dom.mjs';
import { ingestExperience } from '../../src/experience/ingest-experience.mjs';
import { RendererCancelledError } from '../../src/renderers/interface.mjs';
import { consoleAnimationFrames, createConsoleRenderer } from '../../src/renderers/subjects/console/renderer.mjs';
import { createRendererAbortCapability, createRendererClockCapability } from '../../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../../src/runtime/renderer-context.mjs';
import { classifyRendererRejection } from '../../src/runtime/renderer-outcome.mjs';
import { drain, virtualScheduler } from './console-test-support.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const experience = ingestExperience(JSON.parse(readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8')));
const oracle = JSON.parse(readFileSync(resolve(ROOT, 'harness/evidence/console-v1/git-repository-practice.json'), 'utf8'));
const IDS = ['initial', ...experience.steps.map((s) => s.id)];
const DIGEST = Object.fromEntries(oracle.boundaries.map((b) => [b.step, b.render_digest]));
const stateFor = (id) => (id === 'initial' ? experience.initial_state : experience.steps.find((s) => s.id === id).state);
const digest = (root) => createDomSvgRenderEvidence(root).render_digest;
let sequence = 0;

function context(stepId, { fromStepId = null, animate = true, reducedMotion = false, scheduler = virtualScheduler(), rendererConfig = experience.renderer_config } = {}) {
  sequence += 1;
  const transitionId = `anim-${sequence}`;
  const abort = createRendererAbortCapability();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const ctx = createRendererContext({
    animate, fromState: fromStepId === null ? null : stateFor(fromStepId), fromStepId, stepId,
    rendererConfig, stepRendererConfig: null, transitionId,
    abortSignal: abort.facade, clock: clock.facade, reducedMotion
  });
  return { ctx, abort, clock, scheduler };
}

function mounted() {
  const { root } = createMinimalRoot();
  const renderer = createConsoleRenderer();
  renderer.mount({ root, instanceId: 'anim' });
  return { renderer, root };
}

async function settleDirect(renderer, stepId) {
  const t = context(stepId, { animate: false });
  await drain(renderer.render(stateFor(stepId), t.ctx), t.scheduler);
  t.clock.controller.revoke(); t.abort.controller.close();
}

// Each frame with a non-zero delay costs exactly one scheduled callback; zero-delay frames apply
// synchronously, and the last frame is the stable settlement.
const callbacksToSettle = (frames) => frames.filter((frame) => frame.delayMs > 0).length;

const FORWARD = IDS.slice(1).map((to, i) => [IDS[i], to]);
const ANIMATED = FORWARD.filter(([from, to]) => consoleAnimationFrames(stateFor(from), stateFor(to)) !== null);

test('[CA-01] normal animation: all 18 forward transitions settle byte-for-byte to the protected oracle', async () => {
  assert.equal(FORWARD.length, 18);
  assert.equal(ANIMATED.length, 17, 'every forward transition animates except the focus-only stage-hunk--s02 -> s03');
  for (const [from, to] of FORWARD) {
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const t = context(to, { fromStepId: from });
    await drain(renderer.render(stateFor(to), t.ctx), t.scheduler);
    assert.equal(digest(root), DIGEST[to], `${from} -> ${to}`);
    const animated = ANIMATED.some(([a, b]) => a === from && b === to);
    assert.equal(t.scheduler.counts.schedule > 0, animated, `${from} -> ${to} uses the clock exactly when it animates`);
    assert.equal(t.scheduler.counts.onFrame, 0);
  }
});

test('[CA-02] intermediate frames are real, ordered, and never show a premature ready line or a second cursor', async () => {
  for (const [from, to] of ANIMATED) {
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const t = context(to, { fromStepId: from });
    const promise = renderer.render(stateFor(to), t.ctx);
    const seen = [digest(root)];
    const cursors = (node) => (node.getAttribute?.('data-role') === 'cursor' ? 1 : 0) + (node.childNodes ?? []).reduce((n, c) => n + cursors(c), 0);
    const ready = (node) => (node.getAttribute?.('data-role') === 'ready-line' ? 1 : 0) + (node.childNodes ?? []).reduce((n, c) => n + ready(c), 0);
    while (t.scheduler.runNext()) {
      seen.push(digest(root));
      assert.ok(cursors(root) <= 1, `${to}: at most one cursor in any frame`);
      if (digest(root) !== DIGEST[to]) assert.equal(ready(root), 0, `${to}: no ready line before settlement`);
    }
    await promise;
    assert.equal(seen.at(-1), DIGEST[to]);
    const frames = consoleAnimationFrames(stateFor(from), stateFor(to));
    const intermediate = seen.slice(0, -1).some((d) => d !== DIGEST[from] && d !== DIGEST[to]);
    // A single-frame plan (one response character, one output line) has no intermediate frame:
    // its only frame is the stable settlement, which CA-11 proves arrives at its planned time.
    assert.equal(intermediate, frames.length > 1, `${from} -> ${to}`);
  }
});

test('[CA-03] uninterrupted animated playthrough of the whole lesson converges to the oracle at every boundary', async () => {
  const { renderer, root } = mounted();
  await settleDirect(renderer, 'initial');
  assert.equal(digest(root), DIGEST.initial);
  let virtualMs = 0;
  for (const [from, to] of FORWARD) {
    const t = context(to, { fromStepId: from });
    await drain(renderer.render(stateFor(to), t.ctx), t.scheduler);
    virtualMs += t.scheduler.time();
    assert.equal(digest(root), DIGEST[to], to);
    t.clock.controller.revoke(); t.abort.controller.close();
  }
  assert.ok(virtualMs > 10000, `the lesson animates over ${virtualMs} ms of virtual time`);
});

test('[CA-04] reduced motion: every forward arrival settles immediately to the oracle with no clock use', async () => {
  for (const [from, to] of ANIMATED) {
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const t = context(to, { fromStepId: from, reducedMotion: true });
    await drain(renderer.render(stateFor(to), t.ctx), t.scheduler);
    assert.equal(digest(root), DIGEST[to]);
    assert.deepEqual(t.scheduler.counts, { schedule: 0, onFrame: 0 }, to);
  }
});

// One representative transition per animation phase, plus the multi-phase arrival.
const PHASES = {
  'command typing': ['initial', 'check-status--s01'],
  'output reveal': ['check-status--s01', 'check-status--s02'],
  'interactive output reveal': ['stage-hunk--s01', 'stage-hunk--s02'],
  'response entry': ['stage-hunk--s03', 'stage-hunk--s04']
};

test('[CA-05] abort in each phase rejects as cancellation, and no queued work mutates output afterwards', async () => {
  for (const [phase, [from, to]] of Object.entries(PHASES)) {
    const frames = consoleAnimationFrames(stateFor(from), stateFor(to));
    // Abort points 0..n-1 (n = callbacks to settle) are genuinely mid-animation: before the first
    // scheduled frame, in the middle, and just before the final frame (the stable settlement).
    const n = callbacksToSettle(frames);
    for (const stopAfter of [...new Set([0, Math.floor((n - 1) / 2), n - 1])]) {
      const { renderer, root } = mounted();
      await settleDirect(renderer, from);
      const t = context(to, { fromStepId: from });
      const promise = renderer.render(stateFor(to), t.ctx);
      let settled = false;
      promise.then(() => { settled = true; }, () => {});
      for (let i = 0; i < stopAfter; i += 1) t.scheduler.runNext();
      await new Promise((r) => setImmediate(r));
      assert.equal(settled, false, `${phase} @${stopAfter}: the render is still in flight when aborted`);
      const frozen = digest(root);
      t.abort.controller.abort('navigation');
      let rejection;
      await assert.rejects(promise, (error) => { rejection = error; return error instanceof RendererCancelledError && error.reason === 'navigation'; }, `${phase} @${stopAfter}`);
      assert.equal(classifyRendererRejection(rejection, { abortSignal: t.ctx.abortSignal, transitionId: t.ctx.transitionId }).kind, 'cancelled');
      assert.equal(t.scheduler.pending(), 0, `${phase} @${stopAfter}: the renderer cancelled its pending callback`);
      t.scheduler.advanceTo(t.scheduler.time() + 60000);
      assert.equal(digest(root), frozen, `${phase} @${stopAfter}: nothing mutates after abort`);
    }
    // An abort after settlement is a no-op: the render already resolved at the oracle.
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const t = context(to, { fromStepId: from });
    const promise = renderer.render(stateFor(to), t.ctx);
    for (let i = 0; i < callbacksToSettle(frames); i += 1) t.scheduler.runNext();
    await promise;
    t.abort.controller.abort('late');
    assert.equal(digest(root), DIGEST[to], `${phase}: a late abort cannot disturb settled output`);
  }
});

test('[CA-06] recovery: after an abort mid-animation, restoring either the origin or the destination converges to the oracle', async () => {
  for (const [phase, [from, to]] of Object.entries(PHASES)) {
    for (const target of [from, to]) {
      const { renderer, root } = mounted();
      await settleDirect(renderer, from);
      const t = context(to, { fromStepId: from });
      const promise = renderer.render(stateFor(to), t.ctx);
      const frames = consoleAnimationFrames(stateFor(from), stateFor(to));
      if (callbacksToSettle(frames) > 1) t.scheduler.runNext();   // otherwise abort while the only frame is pending
      assert.notEqual(digest(root), DIGEST[to], `${phase}: aborting mid-animation`);
      t.abort.controller.abort('navigation');
      await assert.rejects(promise, RendererCancelledError);
      await settleDirect(renderer, target);
      assert.equal(digest(root), DIGEST[target], `${phase}: recover to ${target}`);
    }
  }
});

test('[CA-07] stale callbacks: queued work from a revoked facade, a superseded render, or a disposed renderer is inert', async () => {
  const [from, to] = PHASES['command typing'];
  // (a) facade revoked by Runtime without abort: queued callbacks do nothing.
  {
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const shared = virtualScheduler();
    const t = context(to, { fromStepId: from, scheduler: shared });
    renderer.render(stateFor(to), t.ctx);
    shared.runNext();
    const before = digest(root);
    t.clock.controller.revoke();
    shared.advanceTo(shared.time() + 60000);
    assert.equal(digest(root), before);
  }
  // (b) superseded: a new render on a shared scheduler starts while old callbacks remain queued.
  {
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const shared = virtualScheduler();
    const old = context(to, { fromStepId: from, scheduler: shared });
    renderer.render(stateFor(to), old.ctx).catch(() => {});
    shared.runNext();
    const fresh = context('commit--s02', { animate: false, scheduler: shared });
    await renderer.render(stateFor('commit--s02'), fresh.ctx);
    shared.advanceTo(shared.time() + 60000);
    assert.equal(digest(root), DIGEST['commit--s02'], 'the superseded animation never overwrites the newer destination');
  }
  // (c) disposed mid-animation.
  {
    const { renderer, root } = mounted();
    await settleDirect(renderer, from);
    const t = context(to, { fromStepId: from });
    renderer.render(stateFor(to), t.ctx).catch(() => {});
    t.scheduler.runNext();
    const before = digest(root);
    renderer.dispose();
    t.scheduler.advanceTo(t.scheduler.time() + 60000);
    assert.equal(digest(root), before);
  }
});

test('[CA-08] no wall-clock scheduling: animation never touches setTimeout, setInterval, or requestAnimationFrame', async () => {
  const saved = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, requestAnimationFrame: globalThis.requestAnimationFrame };
  const forbidden = (name) => () => { throw new Error(`console/v1 used ${name}`); };
  const { renderer, root } = mounted();
  await settleDirect(renderer, 'initial');
  try {
    for (const [from, to] of FORWARD) {
      const t = context(to, { fromStepId: from });
      globalThis.setTimeout = forbidden('setTimeout');
      globalThis.setInterval = forbidden('setInterval');
      globalThis.requestAnimationFrame = forbidden('requestAnimationFrame');
      const promise = renderer.render(stateFor(to), t.ctx);
      while (t.scheduler.runNext()) { /* virtual time only */ }
      Object.assign(globalThis, saved);
      await promise;
      assert.equal(digest(root), DIGEST[to]);
    }
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('[CA-09] typing:false commands appear in one step; non-canonical producer data falls back to direct settlement', async () => {
  const base = { beat: 'fetch', command: 'git fetch --all', copy: 'git fetch --all' };
  const instant = consoleAnimationFrames({ transcript: [], focus: [] }, { transcript: [{ ...base, typing: false }], focus: [] });
  assert.equal(instant.length, 1);
  assert.equal(instant[0].state.transcript[0].command, 'git fetch --all');
  const typed = consoleAnimationFrames({ transcript: [], focus: [] }, { transcript: [base], focus: [] });
  assert.equal(typed.length, base.command.length + 1);
  const reordered = structuredClone(stateFor('check-status--s02'));
  const entry = reordered.transcript[0];
  reordered.transcript[0] = Object.fromEntries(Object.entries(entry).reverse());
  assert.equal(consoleAnimationFrames(reordered, stateFor('stage-hunk--s01')), null, 'unequal prefixes never animate');
});

test('[CA-10] the animation plan is a pure function of (from, to): repeated planning is identical and inputs are untouched', () => {
  for (const [from, to] of ANIMATED) {
    const a = consoleAnimationFrames(stateFor(from), stateFor(to));
    const b = consoleAnimationFrames(stateFor(from), stateFor(to));
    assert.deepEqual(a, b);
    assert.ok(Object.isFrozen(stateFor(to).transcript), 'the frozen destination state was not replaced');
  }
});

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

// Records the virtual time at which each visible change happens during one animated arrival.
async function timeline(from, to, fromState = stateFor(from), toState = stateFor(to)) {
  deepFreeze(fromState); deepFreeze(toState);
  const { renderer, root } = mounted();
  await settleDirect(renderer, from);
  if (fromState !== stateFor(from)) {
    const t0 = context(from, { animate: false });
    await renderer.render(fromState, t0.ctx);
  }
  const t = context(to, { fromStepId: from });
  const ctx = createRendererContext({
    animate: true, fromState, fromStepId: from, stepId: to, rendererConfig: experience.renderer_config, stepRendererConfig: null,
    transitionId: t.ctx.transitionId, abortSignal: t.ctx.abortSignal, clock: t.ctx.clock, reducedMotion: false
  });
  let last = digest(root);
  const changes = [];
  const promise = renderer.render(toState, ctx);
  if (digest(root) !== last) { changes.push(0); last = digest(root); }
  while (t.scheduler.runNext()) {
    if (digest(root) !== last) { changes.push(t.scheduler.time()); last = digest(root); }
  }
  await promise;
  return { changes, settledAt: t.scheduler.time(), root };
}

test('[CA-11] exact timing: 45 ms per character, 350 ms Enter, 250 ms first line, 90 ms per line, 500 ms before a response, and no settlement delay', async () => {
  // Command typing from an empty command at t=0: 10 characters, settled at exactly 10 x 45 ms.
  const typing = await timeline('initial', 'check-status--s01');
  assert.deepEqual(typing.changes, [0, 45, 90, 135, 180, 225, 270, 315, 360, 405, 450]);
  assert.equal(typing.settledAt, 450, 'no extra delay after the last character');

  // Output reveal when the command is already shown: first line after 250 ms, then 90 ms per line.
  const lines = stateFor('check-status--s02').transcript[0].output.length;
  const reveal = await timeline('check-status--s01', 'check-status--s02');
  assert.equal(reveal.changes[0], 250, 'frame zero honors its 250 ms delay; nothing appears at t=0');
  assert.deepEqual(reveal.changes, Array.from({ length: lines }, (_, i) => 250 + 90 * i));
  assert.equal(reveal.settledAt, 250 + 90 * (lines - 1));

  // Response entry: the single response character, and settlement, arrive at exactly 500 ms.
  const response = await timeline('stage-hunk--s03', 'stage-hunk--s04');
  assert.deepEqual(response.changes, [500]);
  assert.equal(response.settledAt, 500);

  // Enter: typing followed by output in one arrival (synthetic, using the specimen prompt).
  const from = { transcript: [], focus: [] };
  const to = { transcript: [{ beat: 'list', command: 'ls', copy: 'ls', output: [{ text: 'a', tone: 'normal' }, { text: 'b', tone: 'normal' }] }], focus: [] };
  const enter = await timeline('initial', 'list--s01', from, to);
  assert.deepEqual(enter.changes, [0, 45, 90, 440, 530], 'type "ls", Enter 350 ms, then lines 90 ms apart');
  assert.equal(enter.settledAt, 530);
});

test('[CA-12] near misses: a same-entry change to any phase-invariant field, or to revealed output, settles directly', async () => {
  const awaiting = stateFor('stage-hunk--s03');
  const answered = stateFor('stage-hunk--s04');
  assert.notEqual(consoleAnimationFrames(awaiting, answered), null, 'the genuine phase advance animates');
  const commandOnly = stateFor('stage-hunk--s01');
  const revealed = stateFor('stage-hunk--s02');
  assert.notEqual(consoleAnimationFrames(commandOnly, revealed), null);
  const mutateLast = (state, change) => { const s = structuredClone(state); change(s.transcript.at(-1)); return s; };
  const nearMisses = {
    'prompt changed': [awaiting, mutateLast(answered, (e) => { e.prompt = '~/elsewhere $'; })],
    'risk changed': [awaiting, mutateLast(answered, (e) => { e.risk = 'cannot-be-undone'; })],
    'risk removed': [awaiting, mutateLast(answered, (e) => { delete e.risk; })],
    'copy changed': [awaiting, mutateLast(answered, (e) => { e.copy = 'git add -A'; })],
    'typing changed': [commandOnly, mutateLast(revealed, (e) => { e.typing = false; })],
    'revealed output changed': [awaiting, mutateLast(answered, (e) => { e.output[0] = { text: 'diff --git a/x b/x', tone: 'dim' }; })],
    'revealed output truncated': [awaiting, mutateLast(answered, (e) => { e.output = e.output.slice(1); })]
  };
  for (const [name, [from, to]] of Object.entries(nearMisses)) {
    deepFreeze(from); deepFreeze(to);
    assert.equal(consoleAnimationFrames(from, to), null, name);
    const { renderer, root } = mounted();
    const t0 = context('origin', { animate: false });
    await renderer.render(from, t0.ctx);
    const t = context('near-miss', { animate: false });   // borrow its clock and abort facades only
    const ctx = createRendererContext({
      animate: true, fromState: from, fromStepId: 'origin', stepId: 'near-miss', rendererConfig: experience.renderer_config, stepRendererConfig: null,
      transitionId: t.ctx.transitionId, abortSignal: t.ctx.abortSignal, clock: t.ctx.clock, reducedMotion: false
    });
    await renderer.render(to, ctx);
    assert.deepEqual(t.scheduler.counts, { schedule: 0, onFrame: 0 }, `${name}: settled directly`);
    const direct = mounted();
    const td = context('near-miss', { animate: false });
    await direct.renderer.render(to, td.ctx);
    assert.equal(digest(root), digest(direct.root), `${name}: identical to a direct render`);
  }
});
