import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EVENT_NAME } from '../src/contracts/events.mjs';
import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { createConsoleRenderer } from '../src/renderers/subjects/console/renderer.mjs';
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

async function makeRuntime({ fromStepId, rate = 2, id }) {
  const source = sourceScheduler();
  const { root } = createMinimalRoot();
  const renderer = createConsoleRenderer();
  const instance = createCiMInstance({
    instanceId: id,
    experience: experienceAtRate(rate),
    clock: source.scheduler,
    renderer,
    rendererRoot: root
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  if (fromStepId !== 'initial') await instance.seek(fromStepId);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, fromStepId);
  assert.equal(instance.read.snapshot().operational.playbackRate, rate);
  assert.equal(source.time(), 0, 'discrete setup consumes no source time');

  return { source, root, instance, events };
}

async function runAnimatedPhase({
  fromStepId,
  toStepId,
  id,
  changeAtSourceMs = null,
  expectedSourceMs
}) {
  const { source, root, instance, events } = await makeRuntime({
    fromStepId,
    rate: 2,
    id
  });
  const eventStart = events.length;
  const play = await instance.play();
  await flush();
  const transitionId = play.transitionId;
  assert.ok(transitionId);
  assert.equal(instance.read.snapshot().operational.transitionId, transitionId);
  assert.equal(instance.read.snapshot().operational.transitionPhase, 'in_flight');

  const frames = [Object.freeze({ step: toStepId, digest: digest(root) })];

  if (changeAtSourceMs !== null) {
    while (source.nextTime() !== null && source.nextTime() <= changeAtSourceMs) {
      assert.equal(source.runNext(), true);
      frames.push(Object.freeze({ step: toStepId, digest: digest(root) }));
      await flush();
    }
    assert.equal(instance.read.snapshot().canonical.currentStepId, fromStepId);
    assert.equal(instance.read.snapshot().operational.transitionId, transitionId);
    assert.ok(source.nextTime() > changeAtSourceMs);

    source.advanceTo(changeAtSourceMs);
    await flush();
    const before = instance.read.snapshot();
    const stepChangedBefore = events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).length;

    const outcome = instance.setPlaybackRate(0.5);
    const after = instance.read.snapshot();
    assert.equal(outcome.result, 'success');
    assert.equal(outcome.transitionId, transitionId);
    assert.deepEqual(after.canonical, before.canonical, 'rate change preserves Core state');
    assert.equal(after.operational.transitionId, transitionId, 'rate change preserves transition identity');
    assert.equal(after.operational.transitionPhase, before.operational.transitionPhase);
    assert.equal(after.operational.playbackIntent, before.operational.playbackIntent);
    assert.equal(after.operational.playbackRate, 0.5);
    assert.equal(
      events.filter((event) => event.event === EVENT_NAME.STEP_CHANGED).length,
      stepChangedBefore,
      'rate change emits no semantic step change'
    );

    const rateEvents = events
      .slice(eventStart)
      .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
    assert.equal(rateEvents.length, 1, 'accepted mid-flight change emits exactly one rate event');
    assert.equal(rateEvents[0].timestamp_ms, changeAtSourceMs);
    assert.equal(rateEvents[0].transition_id, transitionId);
    assert.deepEqual(rateEvents[0].details, {
      from_rate: 2,
      to_rate: 0.5,
      transition_phase: 'in_flight'
    });
  }

  let guard = 0;
  while (instance.read.snapshot().canonical.currentStepId !== toStepId) {
    if (!source.runNext()) throw new Error(`${fromStepId} -> ${toStepId}: no scheduled renderer work remains.`);
    frames.push(Object.freeze({ step: toStepId, digest: digest(root) }));
    await flush();
    guard += 1;
    if (guard > 1000) throw new Error(`${fromStepId} -> ${toStepId}: renderer did not settle.`);
  }

  assert.equal(source.time(), expectedSourceMs);
  assert.equal(digest(root), DIGEST[toStepId]);
  await instance.dispose();
  return Object.freeze({ frames: Object.freeze(frames), sourceMs: source.time() });
}

test('2x to 0.5x during real Console output reveal preserves frames, transition identity, and exact remaining time', async () => {
  const baseline = await runAnimatedPhase({
    fromStepId: 'check-status--s01',
    toStepId: 'check-status--s02',
    id: 'rate-output-baseline',
    expectedSourceMs: 665
  });
  const changed = await runAnimatedPhase({
    fromStepId: 'check-status--s01',
    toStepId: 'check-status--s02',
    id: 'rate-output-change',
    changeAtSourceMs: 200,
    expectedSourceMs: 2060
  });

  assert.deepEqual(changed.frames, baseline.frames, 'output reveal frame sequence is rate-independent');
});

test('2x to 0.5x during real Console response entry preserves frames, transition identity, and exact remaining time', async () => {
  const baseline = await runAnimatedPhase({
    fromStepId: 'stage-hunk--s03',
    toStepId: 'stage-hunk--s04',
    id: 'rate-response-baseline',
    expectedSourceMs: 250
  });
  const changed = await runAnimatedPhase({
    fromStepId: 'stage-hunk--s03',
    toStepId: 'stage-hunk--s04',
    id: 'rate-response-change',
    changeAtSourceMs: 100,
    expectedSourceMs: 700
  });

  assert.deepEqual(changed.frames, baseline.frames, 'response-entry frame sequence is rate-independent');
});

test('2x to 0.5x during authored dwell preserves the exact remainder and starts no transition early', async () => {
  const { source, instance, events } = await makeRuntime({
    fromStepId: 'stage-hunk--s02',
    rate: 2,
    id: 'rate-dwell-change'
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
  assert.equal(snapshot.operational.dwellRemainingMs, 700);
  const canonicalBefore = snapshot.canonical;

  const outcome = instance.setPlaybackRate(0.5);
  snapshot = instance.read.snapshot();
  assert.equal(outcome.result, 'success');
  assert.equal(outcome.transitionId, null);
  assert.deepEqual(snapshot.canonical, canonicalBefore, 'dwell rate change preserves Core state');
  assert.equal(snapshot.operational.transitionId, null, 'dwell rate change does not manufacture a transition');
  assert.equal(snapshot.operational.transitionPhase, 'idle');
  assert.equal(snapshot.operational.dwellRemainingMs, 700, 'dwell preserves its presentation-time remainder');
  assert.equal(snapshot.operational.playbackRate, 0.5);

  const rateEvents = events
    .slice(eventStart)
    .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.equal(rateEvents.length, 1, 'dwell change emits exactly one rate event');
  assert.equal(rateEvents[0].timestamp_ms, 100);
  assert.equal('transition_id' in rateEvents[0], false);
  assert.deepEqual(rateEvents[0].details, {
    from_rate: 2,
    to_rate: 0.5,
    transition_phase: 'idle'
  });

  source.advanceTo(1499);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'stage-hunk--s03');
  assert.equal(snapshot.operational.transitionId, null, 'next transition has not started before the preserved dwell remainder elapses');

  source.advanceTo(1500);
  await flush();
  snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'stage-hunk--s03');
  assert.ok(snapshot.operational.transitionId, 'next transition starts exactly when the preserved dwell remainder elapses');
  assert.equal(snapshot.operational.transitionPhase, 'in_flight');

  const dwellCompleted = events
    .slice(eventStart)
    .find((event) => event.event === EVENT_NAME.DWELL_COMPLETED);
  assert.ok(dwellCompleted);
  assert.equal(dwellCompleted.timestamp_ms, 1500, 'dwell completion remains source-time observable');

  await instance.dispose();
});
