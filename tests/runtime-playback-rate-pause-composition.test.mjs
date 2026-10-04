import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EVENT_NAME } from '../src/contracts/events.mjs';
import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import {
  consoleAnimationFrames,
  createConsoleRenderer
} from '../src/renderers/subjects/console/renderer.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPERIENCE_TEXT = readFileSync(
  resolve(ROOT, 'experiences/git/git-repository-practice.json'),
  'utf8'
);
const oracle = JSON.parse(
  readFileSync(resolve(ROOT, 'harness/evidence/console-v1/git-repository-practice.json'), 'utf8')
);
const DIGEST = Object.fromEntries(
  oracle.boundaries.map((boundary) => [boundary.step, boundary.render_digest])
);
const digest = (root) => createDomSvgRenderEvidence(root).render_digest;

function experienceAtRate(rate) {
  const document = JSON.parse(EXPERIENCE_TEXT);
  document.presentation.default_playback_rate = rate;
  return ingestExperience(document);
}

function stateFor(experience, stepId) {
  return stepId === 'initial'
    ? experience.initial_state
    : experience.steps.find((step) => step.id === stepId).state;
}

async function flush() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
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
    scheduler,
    time: () => now,
    pending: () => queue.size,
    nextTime: () => nextEntry()?.entry.at ?? null,
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

function capturingConsoleRenderer(contexts) {
  const renderer = createConsoleRenderer();
  return Object.freeze({
    mount(context) {
      return renderer.mount(context);
    },
    render(state, context) {
      contexts.push(context);
      return renderer.render(state, context);
    },
    dispose() {
      return renderer.dispose();
    }
  });
}

async function makeRuntime({ fromStepId, id }) {
  const experience = experienceAtRate(2);
  const source = sourceScheduler();
  const { root } = createMinimalRoot();
  const contexts = [];
  const instance = createCiMInstance({
    instanceId: id,
    experience,
    clock: source.scheduler,
    renderer: capturingConsoleRenderer(contexts),
    rendererRoot: root
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  if (fromStepId !== 'initial') await instance.seek(fromStepId);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, fromStepId);
  assert.equal(instance.read.snapshot().operational.playbackRate, 2);
  assert.equal(source.time(), 0, 'discrete setup consumes no source time');

  return { experience, source, root, contexts, instance, events };
}

function assertStrictlyInsideScheduledInterval(plan, presentationTimeMs, label) {
  let intervalStartMs = 0;
  for (const frame of plan) {
    const intervalEndMs = intervalStartMs + frame.delayMs;
    if (presentationTimeMs > intervalStartMs && presentationTimeMs < intervalEndMs) return;
    intervalStartMs = intervalEndMs;
  }
  assert.fail(`${label}: pause point must lie strictly inside a scheduled renderer interval`);
}

async function provePausedAnimationPhase({
  label,
  fromStepId,
  toStepId,
  pauseAtSourceMs,
  expectedPresentationMs,
  id
}) {
  const { experience, source, root, contexts, instance, events } = await makeRuntime({
    fromStepId,
    id
  });
  const plan = consoleAnimationFrames(
    stateFor(experience, fromStepId),
    stateFor(experience, toStepId)
  );
  assert.ok(plan, `${label}: transition has an animation plan`);
  const presentationMs = plan.reduce((sum, frame) => sum + frame.delayMs, 0);
  assert.equal(presentationMs, expectedPresentationMs, `${label}: presentation duration is pinned`);
  const consumedPresentationMs = pauseAtSourceMs * 2;
  assertStrictlyInsideScheduledInterval(plan, consumedPresentationMs, label);

  const eventStart = events.length;
  const play = await instance.play();
  await flush();
  const transitionId = play.transitionId;
  assert.ok(transitionId, `${label}: transition starts`);
  assert.equal(instance.read.snapshot().operational.transitionId, transitionId);
  assert.ok(source.pending() > 0, `${label}: renderer work is armed before pause`);

  source.advanceTo(pauseAtSourceMs);
  await flush();
  const beforePause = instance.read.snapshot();
  assert.equal(beforePause.canonical.currentStepId, fromStepId);
  assert.equal(beforePause.operational.transitionId, transitionId);
  assert.equal(beforePause.operational.transitionPhase, 'in_flight');

  const activeContext = contexts.at(-1);
  assert.ok(activeContext, `${label}: renderer context is captured`);
  assert.equal(
    activeContext.clock.now(),
    consumedPresentationMs,
    `${label}: renderer-facing clock reflects 2x presentation time at pause`
  );
  const frozenDigest = digest(root);

  const paused = instance.pause();
  assert.equal(paused.result, 'success');
  assert.equal(paused.transitionId, transitionId);
  assert.equal(instance.read.snapshot().canonical.status, 'paused');
  assert.equal(instance.read.snapshot().operational.transitionId, transitionId);
  assert.equal(source.pending(), 0, `${label}: pause cancels all armed renderer work`);

  const pausedCanonical = instance.read.snapshot().canonical;
  const stepChangedBefore = events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).length;
  const rateOutcome = instance.setPlaybackRate(0.5);
  assert.equal(rateOutcome.result, 'success');
  assert.equal(rateOutcome.transitionId, transitionId);
  assert.equal(instance.read.snapshot().operational.playbackRate, 0.5);
  assert.deepEqual(instance.read.snapshot().canonical, pausedCanonical, `${label}: paused rate change preserves Core state`);
  assert.equal(source.pending(), 0, `${label}: changing rate while paused arms no work`);
  assert.equal(activeContext.clock.now(), consumedPresentationMs, `${label}: rate change does not move paused renderer time`);
  assert.equal(
    events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).length,
    stepChangedBefore,
    `${label}: paused rate change emits no step change`
  );

  const rateEvents = events
    .slice(eventStart)
    .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.equal(rateEvents.length, 1, `${label}: exactly one rate event is emitted`);
  assert.equal(rateEvents[0].timestamp_ms, pauseAtSourceMs);
  assert.equal(rateEvents[0].transition_id, transitionId);
  assert.deepEqual(rateEvents[0].details, {
    from_rate: 2,
    to_rate: 0.5,
    transition_phase: 'in_flight'
  });

  const frozenSourceUntil = pauseAtSourceMs + 60000;
  source.advanceTo(frozenSourceUntil);
  await flush();
  assert.equal(digest(root), frozenDigest, `${label}: DOM stays frozen for 60 seconds of source time`);
  assert.equal(activeContext.clock.now(), consumedPresentationMs, `${label}: renderer clock stays frozen for 60 seconds`);
  assert.equal(source.pending(), 0, `${label}: paused source advance does not arm work`);
  assert.equal(instance.read.snapshot().canonical.currentStepId, fromStepId);

  const remainingPresentationMs = presentationMs - consumedPresentationMs;
  assert.ok(remainingPresentationMs > 0, `${label}: pause occurs before settlement`);
  const expectedAfterResumeSourceMs = remainingPresentationMs / 0.5;
  const resumeAtSourceMs = source.time();

  const resumed = await instance.play();
  assert.equal(resumed.transitionId, transitionId);
  assert.equal(instance.read.snapshot().operational.transitionId, transitionId);
  assert.ok(source.pending() > 0, `${label}: resume re-arms preserved work at the new rate`);

  source.advanceTo(resumeAtSourceMs + expectedAfterResumeSourceMs - 1);
  await flush();
  assert.equal(
    instance.read.snapshot().canonical.currentStepId,
    fromStepId,
    `${label}: destination does not settle one source ms early`
  );

  source.advanceTo(resumeAtSourceMs + expectedAfterResumeSourceMs);
  await flush();
  const settled = instance.read.snapshot();
  assert.equal(settled.canonical.currentStepId, toStepId, `${label}: destination settles at the exact preserved remainder`);
  assert.equal(settled.operational.transitionId, null);
  assert.equal(settled.operational.transitionPhase, 'idle');
  assert.equal(digest(root), DIGEST[toStepId], `${label}: resumed render converges to the protected oracle`);

  await instance.dispose();
}

test('pause composition: command typing freezes at 2x, changes to 0.5x while paused, and resumes only the remainder', async () => {
  await provePausedAnimationPhase({
    label: 'command typing',
    fromStepId: 'initial',
    toStepId: 'check-status--s01',
    pauseAtSourceMs: 100,
    expectedPresentationMs: 450,
    id: 'rate-pause-typing'
  });
});

test('pause composition: output reveal preserves the 1,010 ms interior remainder and resumes it at 0.5x', async () => {
  await provePausedAnimationPhase({
    label: 'output reveal',
    fromStepId: 'check-status--s01',
    toStepId: 'check-status--s02',
    pauseAtSourceMs: 160,
    expectedPresentationMs: 1330,
    id: 'rate-pause-output'
  });
});

test('pause composition: interactive output reveal freezes and resumes only its preserved remainder', async () => {
  await provePausedAnimationPhase({
    label: 'interactive output reveal',
    fromStepId: 'stage-hunk--s01',
    toStepId: 'stage-hunk--s02',
    pauseAtSourceMs: 160,
    expectedPresentationMs: 1060,
    id: 'rate-pause-interactive-output'
  });
});

test('pause composition: response entry freezes at 2x, changes to 0.5x while paused, and resumes only the remainder', async () => {
  await provePausedAnimationPhase({
    label: 'response entry',
    fromStepId: 'stage-hunk--s03',
    toStepId: 'stage-hunk--s04',
    pauseAtSourceMs: 100,
    expectedPresentationMs: 500,
    id: 'rate-pause-response'
  });
});

test('pause composition: authored dwell preserves its presentation remainder across a paused rate change', async () => {
  const { source, instance, events } = await makeRuntime({
    fromStepId: 'stage-hunk--s02',
    id: 'rate-pause-dwell'
  });
  const eventStart = events.length;

  await instance.play();
  await flush();
  let snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'stage-hunk--s03');
  assert.equal(snapshot.operational.transitionId, null);
  assert.equal(snapshot.operational.transitionPhase, 'idle');
  assert.equal(snapshot.operational.dwellRemainingMs, 900);

  source.advanceTo(100);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.operational.dwellRemainingMs, 700, '100 source ms at 2x consumes 200 presentation ms');

  const paused = instance.pause();
  assert.equal(paused.result, 'success');
  assert.equal(source.pending(), 0, 'paused dwell has no armed source work');
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 700);

  const canonicalBeforeRate = instance.read.snapshot().canonical;
  const rateOutcome = instance.setPlaybackRate(0.5);
  assert.equal(rateOutcome.result, 'success');
  assert.equal(rateOutcome.transitionId, null);
  assert.deepEqual(instance.read.snapshot().canonical, canonicalBeforeRate);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 700);
  assert.equal(source.pending(), 0, 'changing rate during paused dwell arms nothing');

  const rateEvents = events
    .slice(eventStart)
    .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.equal(rateEvents.length, 1);
  assert.equal(rateEvents[0].timestamp_ms, 100);
  assert.equal('transition_id' in rateEvents[0], false);
  assert.deepEqual(rateEvents[0].details, {
    from_rate: 2,
    to_rate: 0.5,
    transition_phase: 'idle'
  });

  source.advanceTo(60100);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.operational.dwellRemainingMs, 700, 'paused dwell remainder is frozen for 60 seconds');
  assert.equal(events.filter((event) => event.event === EVENT_NAME.DWELL_COMPLETED).length, 0);
  assert.equal(source.pending(), 0);

  await instance.play();
  const resumeAtSourceMs = source.time();
  assert.equal(instance.read.snapshot().canonical.status, 'playing');
  assert.ok(source.pending() > 0, 'resume arms the preserved dwell remainder');

  source.advanceTo(resumeAtSourceMs + 1399);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'stage-hunk--s03');
  assert.equal(snapshot.operational.transitionId, null);
  assert.equal(
    snapshot.operational.dwellRemainingMs,
    0.5,
    'one source ms before a 0.5x deadline leaves half a presentation millisecond'
  );

  source.advanceTo(resumeAtSourceMs + 1400);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'stage-hunk--s03');
  assert.ok(snapshot.operational.transitionId, 'next transition starts exactly after 700 presentation ms at 0.5x');
  assert.equal(snapshot.operational.transitionPhase, 'in_flight');

  const dwellCompleted = events.find((event) => event.event === EVENT_NAME.DWELL_COMPLETED);
  assert.ok(dwellCompleted);
  assert.equal(dwellCompleted.timestamp_ms, resumeAtSourceMs + 1400);

  await instance.dispose();
});
