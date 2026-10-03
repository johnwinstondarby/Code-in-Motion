import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMAND_SOURCE, EVENT_NAME } from '../src/contracts/events.mjs';
import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { createConsoleRenderer } from '../src/renderers/subjects/console/renderer.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPERIENCE = ingestExperience(JSON.parse(
  readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8')
));
const ORACLE = JSON.parse(
  readFileSync(resolve(ROOT, 'harness/evidence/console-v1/git-repository-practice.json'), 'utf8')
);
const DIGEST = Object.fromEntries(
  ORACLE.boundaries.map((boundary) => [boundary.step, boundary.render_digest])
);
const TARGET_STEP = 'check-status--s02';
const digest = (root) => createDomSvgRenderEvidence(root).render_digest;

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
      if (nextEntry()?.entry.at <= ms) {
        throw new Error('advanceTo may move source time only after all due work has been drained.');
      }
      now = Math.max(now, ms);
    }
  };
}

async function advanceSourceTo(source, targetMs) {
  for (;;) {
    const next = source.nextTime();
    if (next === null || next > targetMs) break;
    assert.equal(source.runNext(), true);
    await flush();
  }
  source.advanceTo(targetMs);
  await flush();
}

async function makeRuntime({ id, initializationSource }) {
  const source = sourceScheduler();
  const { root } = createMinimalRoot();
  const instance = createCiMInstance({
    instanceId: id,
    experience: EXPERIENCE,
    clock: source.scheduler,
    renderer: createConsoleRenderer(),
    rendererRoot: root
  });
  const events = [];
  const boundaries = [];
  instance.events.subscribe((event) => {
    events.push(event);
    if (event.event === EVENT_NAME.STEP_CHANGED) {
      boundaries.push(Object.freeze({
        step: event.step_id,
        timestamp_ms: event.timestamp_ms,
        render_digest: digest(root)
      }));
    }
  });

  await instance.initialize({ source: initializationSource });
  await flush();
  boundaries.unshift(Object.freeze({
    step: 'initial',
    timestamp_ms: source.time(),
    render_digest: digest(root)
  }));

  return { source, root, instance, events, boundaries };
}

function projectRateEvent(event) {
  return Object.freeze({
    timestamp_ms: event.timestamp_ms,
    step_id: event.step_id,
    from_rate: event.details.from_rate,
    to_rate: event.details.to_rate,
    transition_phase: event.details.transition_phase,
    has_transition_id: Object.hasOwn(event, 'transition_id')
  });
}

function buildReplayRecord(events) {
  const startedIndex = events.findIndex((event) => event.event === EVENT_NAME.PLAYBACK_STARTED);
  assert.ok(startedIndex >= 0, 'recorded session contains playback.started');
  const started = events[startedIndex];
  const postStartRateEvents = events
    .slice(startedIndex + 1)
    .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED)
    .map((event) => Object.freeze({
      timestamp_ms: event.timestamp_ms,
      rate: event.details.to_rate,
      step_id: event.step_id,
      transition_phase: event.details.transition_phase
    }));

  return Object.freeze({
    playbackStart: Object.freeze({
      timestamp_ms: started.timestamp_ms,
      rate: started.details.playback_rate
    }),
    rateChanges: Object.freeze(postStartRateEvents)
  });
}

async function driveToTarget(source, instance, targetStepId) {
  let guard = 0;
  while (instance.read.snapshot().canonical.currentStepId !== targetStepId) {
    if (!source.runNext()) {
      throw new Error(`no scheduled presentation work remains before ${targetStepId}`);
    }
    await flush();
    guard += 1;
    if (guard > 1000) throw new Error(`presentation did not reach ${targetStepId}`);
  }
}

async function recordOriginalSession() {
  const run = await makeRuntime({
    id: 'rate-replay-original',
    initializationSource: COMMAND_SOURCE.HOST
  });
  const { source, instance, events } = run;

  const preStart = instance.setPlaybackRate(2, COMMAND_SOURCE.HOST);
  assert.equal(preStart.result, 'success');
  const play = await instance.play(COMMAND_SOURCE.HOST);
  assert.equal(play.result, 'success');
  await flush();

  await advanceSourceTo(source, 100);
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');
  assert.equal(instance.setPlaybackRate(0.5, COMMAND_SOURCE.HOST).result, 'success');

  await advanceSourceTo(source, 1000);
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'check-status--s01');
  assert.equal(instance.read.snapshot().operational.transitionPhase, 'idle');
  assert.equal(instance.setPlaybackRate(1.25, COMMAND_SOURCE.HOST).result, 'success');

  await advanceSourceTo(source, 2000);
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'check-status--s01');
  assert.equal(instance.read.snapshot().operational.transitionPhase, 'in_flight');
  assert.equal(instance.setPlaybackRate(2, COMMAND_SOURCE.HOST).result, 'success');

  await driveToTarget(source, instance, TARGET_STEP);
  await flush();

  const record = buildReplayRecord(events);
  const rateEvents = events
    .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED)
    .map(projectRateEvent);
  const started = events.find((event) => event.event === EVENT_NAME.PLAYBACK_STARTED);

  return { ...run, record, rateEvents, started };
}

async function replayRecordedSession(record) {
  const run = await makeRuntime({
    id: 'rate-replay-copy',
    initializationSource: COMMAND_SOURCE.REPLAY
  });
  const { source, instance, events } = run;

  assert.equal(source.time(), record.playbackStart.timestamp_ms);
  assert.equal(
    instance.setPlaybackRate(record.playbackStart.rate, COMMAND_SOURCE.REPLAY).result,
    'success',
    'replay restores the recorded effective start rate before playback begins'
  );
  const play = await instance.play(COMMAND_SOURCE.REPLAY);
  assert.equal(play.result, 'success');
  await flush();

  for (const change of record.rateChanges) {
    await advanceSourceTo(source, change.timestamp_ms);
    const snapshot = instance.read.snapshot();
    assert.equal(snapshot.canonical.currentStepId, change.step_id, 'rate change is replayed at its recorded semantic boundary');
    assert.equal(snapshot.operational.transitionPhase, change.transition_phase);
    assert.equal(instance.setPlaybackRate(change.rate, COMMAND_SOURCE.REPLAY).result, 'success');
  }

  await driveToTarget(source, instance, TARGET_STEP);
  await flush();

  const rateEvents = events
    .filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED)
    .map(projectRateEvent);
  const started = events.find((event) => event.event === EVENT_NAME.PLAYBACK_STARTED);

  return { ...run, rateEvents, started };
}

test('recorded playback-rate events reproduce the exact Runtime presentation schedule under replay', async () => {
  const original = await recordOriginalSession();

  assert.equal(original.started.details.playback_rate, 2, 'playback.started records the effective start rate');
  assert.deepEqual(original.rateEvents, [
    {
      timestamp_ms: 0,
      step_id: 'initial',
      from_rate: 1,
      to_rate: 2,
      transition_phase: 'idle',
      has_transition_id: false
    },
    {
      timestamp_ms: 100,
      step_id: 'initial',
      from_rate: 2,
      to_rate: 0.5,
      transition_phase: 'in_flight',
      has_transition_id: true
    },
    {
      timestamp_ms: 1000,
      step_id: 'check-status--s01',
      from_rate: 0.5,
      to_rate: 1.25,
      transition_phase: 'idle',
      has_transition_id: false
    },
    {
      timestamp_ms: 2000,
      step_id: 'check-status--s01',
      from_rate: 1.25,
      to_rate: 2,
      transition_phase: 'in_flight',
      has_transition_id: true
    }
  ]);

  assert.deepEqual(
    original.boundaries.map(({ step, timestamp_ms }) => ({ step, timestamp_ms })),
    [
      { step: 'initial', timestamp_ms: 0 },
      { step: 'check-status--s01', timestamp_ms: 600 },
      { step: 'check-status--s02', timestamp_ms: 2390 }
    ],
    'expected schedule is derived from 450 ms typing, 900 ms dwell, and 1330 ms output reveal under the recorded rates'
  );
  assert.deepEqual(
    original.boundaries.map(({ step, render_digest }) => ({ step, render_digest })),
    ORACLE.boundaries.slice(0, 3),
    'original run converges to the protected oracle at every committed boundary'
  );

  const replay = await replayRecordedSession(original.record);

  assert.equal(replay.started.timestamp_ms, original.started.timestamp_ms);
  assert.equal(replay.started.details.playback_rate, original.started.details.playback_rate);
  assert.deepEqual(replay.rateEvents, original.rateEvents, 'replay reproduces every recorded rate change at the same source time and semantic position');
  assert.deepEqual(replay.boundaries, original.boundaries, 'replay reproduces the exact source-time boundary schedule and canonical renderer evidence');
  assert.equal(replay.source.time(), 2390);

  await original.instance.dispose();
  await replay.instance.dispose();
});
