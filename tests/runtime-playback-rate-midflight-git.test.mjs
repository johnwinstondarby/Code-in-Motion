import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import {
  CONSOLE_ANIMATION_TIMING,
  consoleAnimationFrames,
  createConsoleRenderer
} from '../src/renderers/subjects/console/renderer.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from '../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../src/runtime/renderer-context.mjs';
import { createPresentationScheduler } from '../src/runtime/presentation-scheduler.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const experience = ingestExperience(JSON.parse(
  readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8')
));
const oracle = JSON.parse(
  readFileSync(resolve(ROOT, 'harness/evidence/console-v1/git-repository-practice.json'), 'utf8')
);
const IDS = ['initial', ...experience.steps.map((step) => step.id)];
const FORWARD = IDS.slice(1).map((to, index) => [IDS[index], to]);
const DIGEST = Object.fromEntries(oracle.boundaries.map((boundary) => [boundary.step, boundary.render_digest]));
const CHANGE_AT_SOURCE_MS = 6696;

const stateFor = (stepId) => (
  stepId === 'initial'
    ? experience.initial_state
    : experience.steps.find((step) => step.id === stepId).state
);
const configFor = (stepId) => (
  stepId === 'initial'
    ? null
    : experience.steps.find((step) => step.id === stepId).renderer_config ?? null
);
const digest = (root) => createDomSvgRenderEvidence(root).render_digest;

async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function sourceScheduler() {
  let now = 0;
  let sequence = 0;
  const queue = new Map();

  function nextEntry() {
    let next = null;
    for (const [handle, entry] of queue.entries()) {
      if (
        next === null ||
        entry.at < next.entry.at ||
        (entry.at === next.entry.at && entry.order < next.entry.order)
      ) {
        next = { handle, entry };
      }
    }
    return next;
  }

  const scheduler = Object.freeze({
    now() {
      return now;
    },
    schedule(fn, ms) {
      sequence += 1;
      queue.set(sequence, { fn, at: now + ms, order: sequence });
      return sequence;
    },
    cancel(handle) {
      return queue.delete(handle);
    },
    onFrame(fn) {
      sequence += 1;
      queue.set(sequence, { fn, at: now + 16, order: sequence });
      return sequence;
    }
  });

  return {
    ...scheduler,
    scheduler,
    time: () => now,
    pending: () => queue.size,
    nextTime() {
      return nextEntry()?.entry.at ?? null;
    },
    runNext() {
      const next = nextEntry();
      if (next === null) return false;
      queue.delete(next.handle);
      now = next.entry.at;
      next.entry.fn(now);
      return true;
    },
    advanceTo(ms) {
      for (;;) {
        const next = nextEntry();
        if (next === null || next.entry.at > ms) break;
        this.runNext();
      }
      now = Math.max(now, ms);
    }
  };
}

function renderContext({ stepId, fromStepId, scheduler, transitionId, animate }) {
  const abort = createRendererAbortCapability();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const context = createRendererContext({
    animate,
    fromState: fromStepId === null ? null : stateFor(fromStepId),
    fromStepId,
    stepId,
    rendererConfig: experience.renderer_config ?? null,
    stepRendererConfig: configFor(stepId),
    transitionId,
    abortSignal: abort.facade,
    clock: clock.facade,
    reducedMotion: false
  });
  return { context, abort, clock };
}

function observe(promise) {
  const settlement = { state: 'pending', error: null };
  promise.then(
    () => { settlement.state = 'resolved'; },
    (error) => { settlement.state = 'rejected'; settlement.error = error; }
  );
  return settlement;
}

async function runOneCallback({ settlement, source, root, stepId, frames }) {
  if (!source.runNext()) {
    await flush();
    if (settlement.state === 'pending' && source.pending() === 0) {
      throw new Error(`${stepId}: render never settled and no source-time work remains.`);
    }
    return false;
  }
  frames.push(Object.freeze({ step: stepId, digest: digest(root) }));
  await flush();
  return true;
}

async function driveToSettlement({ settlement, source, root, stepId, frames }) {
  while (settlement.state === 'pending') {
    await runOneCallback({ settlement, source, root, stepId, frames });
  }
  if (settlement.state === 'rejected') throw settlement.error;
}

async function runGitPlaythrough({ changeAtSourceMs = null } = {}) {
  const source = sourceScheduler();
  const presentation = createPresentationScheduler({ sourceScheduler: source.scheduler, initialRate: 1 });
  const { root } = createMinimalRoot();
  const renderer = createConsoleRenderer();
  renderer.mount({ root, instanceId: changeAtSourceMs === null ? 'rate-midflight-baseline' : 'rate-midflight-change' });

  const initial = renderContext({
    stepId: 'initial',
    fromStepId: null,
    scheduler: presentation.scheduler,
    transitionId: 'rate-midflight-initial',
    animate: false
  });
  await renderer.render(stateFor('initial'), initial.context);
  initial.clock.controller.revoke();
  initial.abort.controller.close();

  const boundaries = [Object.freeze({ step: 'initial', render_digest: digest(root) })];
  const frames = [];
  let changed = false;
  let changeProof = null;

  for (const [index, [fromStepId, stepId]] of FORWARD.entries()) {
    const plan = consoleAnimationFrames(stateFor(fromStepId), stateFor(stepId));
    const presentationDuration = plan === null
      ? 0
      : plan.reduce((sum, frame) => sum + frame.delayMs, 0);
    const transitionStartSource = source.time();

    const transition = renderContext({
      stepId,
      fromStepId,
      scheduler: presentation.scheduler,
      transitionId: `rate-midflight-${index + 1}`,
      animate: true
    });
    const promise = renderer.render(stateFor(stepId), transition.context);
    const settlement = observe(promise);
    frames.push(Object.freeze({ step: stepId, digest: digest(root) }));
    await flush();

    const changeFallsInside = (
      changeAtSourceMs !== null &&
      !changed &&
      transitionStartSource < changeAtSourceMs &&
      transitionStartSource + presentationDuration > changeAtSourceMs
    );

    if (changeFallsInside) {
      const fromState = stateFor(fromStepId);
      const toState = stateFor(stepId);
      assert.equal(
        toState.transcript.length,
        fromState.transcript.length + 1,
        'the ADR feasibility change point must occur while a new command is being typed'
      );
      const entry = toState.transcript.at(-1);
      assert.notEqual(entry.typing, false, 'the ADR feasibility change point must use typed command timing');
      const localOffset = changeAtSourceMs - transitionStartSource;
      const typingDuration = entry.command.length * CONSOLE_ANIMATION_TIMING.typeCharMs;
      assert.ok(localOffset > 0 && localOffset < typingDuration, 'the ADR feasibility change point must be strictly mid-typing');

      while (
        settlement.state === 'pending' &&
        source.nextTime() !== null &&
        source.nextTime() <= changeAtSourceMs
      ) {
        await runOneCallback({ settlement, source, root, stepId, frames });
      }
      assert.equal(settlement.state, 'pending', 'the renderer remains in flight at the rate-change point');
      assert.ok(source.nextTime() > changeAtSourceMs, 'the next renderer callback remains in the future at the change point');

      source.advanceTo(changeAtSourceMs);
      await flush();
      assert.notEqual(digest(root), DIGEST[stepId], 'rate changes before the destination settles');

      const beforeNow = transition.context.clock.now();
      const result = presentation.control.setRate(2);
      const afterNow = transition.context.clock.now();
      assert.deepEqual(result, { changed: true, fromRate: 1, toRate: 2 });
      assert.equal(beforeNow, changeAtSourceMs, 'presentation time matches source time before the 1x change');
      assert.equal(afterNow, beforeNow, 'rate re-anchoring preserves renderer-facing presentation now exactly');

      changed = true;
      changeProof = Object.freeze({ stepId, localOffset, typingDuration, sourceMs: source.time() });
    }

    await driveToSettlement({ settlement, source, root, stepId, frames });

    boundaries.push(Object.freeze({ step: stepId, render_digest: digest(root) }));
    transition.clock.controller.revoke();
    transition.abort.controller.close();
    assert.equal(source.pending(), 0, `${stepId}: no source-time work remains after settlement`);
  }

  renderer.dispose();
  return Object.freeze({
    sourceMs: source.time(),
    frames: Object.freeze(frames),
    boundaries: Object.freeze(boundaries),
    changed,
    changeProof
  });
}

test('renderer-facing clock preserves now and remaining presentation work across 2x to 0.5x re-anchoring', () => {
  const source = sourceScheduler();
  const presentation = createPresentationScheduler({ sourceScheduler: source.scheduler, initialRate: 2 });
  const clock = createRendererClockCapability({
    transitionId: 'rate-now-probe',
    scheduler: presentation.scheduler
  });

  let fired = null;
  clock.facade.schedule((presentationNow) => {
    fired = Object.freeze({ sourceMs: source.time(), presentationMs: presentationNow });
  }, 1000);

  source.advanceTo(200);
  assert.equal(clock.facade.now(), 400, '2x exposes 400 presentation ms after 200 source ms');

  const result = presentation.control.setRate(0.5);
  assert.deepEqual(result, { changed: true, fromRate: 2, toRate: 0.5 });
  assert.equal(clock.facade.now(), 400, 'changing rate does not jump renderer-facing presentation time');

  source.advanceTo(1399);
  assert.equal(fired, null, '600 remaining presentation ms have not elapsed before source 1400');
  source.advanceTo(1400);
  assert.deepEqual(fired, { sourceMs: 1400, presentationMs: 1000 });

  clock.controller.revoke();
});

test('Git specimen 1x to 2x mid-typing change matches the ADR 0047 feasibility schedule and oracle', async () => {
  const baseline = await runGitPlaythrough();
  const changed = await runGitPlaythrough({ changeAtSourceMs: CHANGE_AT_SOURCE_MS });

  assert.equal(baseline.sourceMs, 12760, '1x baseline remains the accepted feasibility duration');
  assert.equal(changed.changed, true, 'the rate change occurred during the playthrough');
  assert.equal(changed.changeProof.sourceMs, CHANGE_AT_SOURCE_MS);
  assert.equal(changed.sourceMs, 9728, '1x to 2x mid-typing playthrough matches the accepted feasibility duration');

  assert.deepEqual(baseline.boundaries, oracle.boundaries, 'baseline converges to all 19 protected boundaries');
  assert.deepEqual(changed.boundaries, oracle.boundaries, 'mid-flight rate change converges to all 19 protected boundaries');
  assert.deepEqual(changed.frames, baseline.frames, 'mid-flight rate change preserves the complete renderer frame sequence');
});
