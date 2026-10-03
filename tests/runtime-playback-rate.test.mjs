import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE, EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function freezeV1({ dwell = 0 } = {}) {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'rate-v1',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { value: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { value: 'B' },
        ...(dwell > 0 ? { dwell_ms: dwell } : {})
      },
      {
        id: 'step-02',
        label: 'Two',
        commentary: { text: 'Two', links: [] },
        state: { value: 'C' }
      }
    ]
  });
}

function freezeV2(rate = 1.5) {
  return freezeValidatedExperience({
    schema: 'localis.cim/v2',
    engine_min: '0.2.0',
    experience_version: '1.0.0',
    id: 'rate-v2',
    renderer: 'synthetic/v1',
    presentation: {
      title: 'Rate v2',
      description: 'Playback-rate runtime fixture.',
      subject: 'synthetic',
      beat_count: 1,
      default_playback_rate: rate
    },
    initial_state: { value: 'A' },
    steps: [
      {
        id: 'one--s01',
        label: 'One',
        beat: {
          id: 'one',
          ordinal: 1,
          heading: 'One',
          segment_ordinal: 1,
          segment_count: 1,
          final: true
        },
        commentary: { text: 'One', links: [] },
        state: { value: 'B' },
        dwell_ms: 0
      }
    ]
  });
}

function virtualScheduler() {
  let now = 0;
  let sequence = 0;
  const delays = new Map();
  const frames = new Map();

  function fireDue() {
    let fired;
    do {
      fired = false;
      const due = [...delays.entries()]
        .filter(([, entry]) => entry.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[1].sequence - b[1].sequence);
      for (const [handle, entry] of due) {
        if (!delays.delete(handle)) continue;
        entry.fn(now);
        fired = true;
      }
    } while (fired);
  }

  const scheduler = Object.freeze({
    now() {
      return now;
    },
    schedule(fn, ms) {
      const handle = `delay-${++sequence}`;
      delays.set(handle, { fn, at: now + ms, sequence });
      return handle;
    },
    cancel(handle) {
      return delays.delete(handle) || frames.delete(handle);
    },
    onFrame(fn) {
      const handle = `frame-${++sequence}`;
      frames.set(handle, fn);
      return handle;
    }
  });

  return {
    scheduler,
    advance(ms) {
      now += ms;
      fireDue();
    },
    emitFrame() {
      for (const fn of [...frames.values()]) fn(now);
    },
    pendingDelays() {
      return delays.size;
    },
    now() {
      return now;
    }
  };
}

function immediateRenderer() {
  return Object.freeze({
    mount() {},
    render() { return Promise.resolve(); },
    dispose() {}
  });
}

function timedRenderer(delayMs = 1000) {
  const contexts = [];
  let settlements = 0;
  return {
    contexts,
    get settlements() { return settlements; },
    renderer: Object.freeze({
      mount() {},
      render(_state, context) {
        contexts.push(context);
        if (!context.animate) return Promise.resolve();
        return new Promise((resolve) => {
          context.clock.schedule(() => {
            settlements += 1;
            resolve();
          }, delayMs);
        });
      },
      dispose() {}
    })
  };
}

async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function makeInstance({ experience = freezeV1(), renderer = immediateRenderer(), time = virtualScheduler(), id = 'rate-instance' } = {}) {
  return {
    time,
    instance: createCiMInstance({
      instanceId: id,
      experience,
      clock: time.scheduler,
      renderer,
      rendererRoot: {}
    })
  };
}

test('v1 starts at 1.0 and v2 starts at presentation.default_playback_rate', async () => {
  const first = makeInstance();
  assert.equal(first.instance.read.snapshot().operational.playbackRate, 1);
  await first.instance.initialize();
  assert.equal(first.instance.read.snapshot().operational.playbackRate, 1);

  const second = makeInstance({ experience: freezeV2(1.5), id: 'rate-v2-instance' });
  assert.equal(second.instance.read.snapshot().operational.playbackRate, 1.5);
  await second.instance.initialize();
  assert.equal(second.instance.read.snapshot().operational.playbackRate, 1.5);
});

test('pre-start rate change is observable and playback.started reports the effective rate', async () => {
  const { instance } = makeInstance();
  const events = [];
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();

  const changed = instance.setPlaybackRate(1.5, COMMAND_SOURCE.TRANSPORT);
  assert.equal(changed.command, 'setPlaybackRate');
  assert.equal(changed.result, 'success');
  assert.equal(instance.read.snapshot().operational.playbackRate, 1.5);

  const rateEvent = events.find((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.ok(rateEvent);
  assert.deepEqual(rateEvent.details, {
    from_rate: 1,
    to_rate: 1.5,
    transition_phase: 'idle'
  });
  assert.equal('transition_id' in rateEvent, false);

  await instance.play(COMMAND_SOURCE.TRANSPORT);
  const started = events.find((event) => event.event === EVENT_NAME.PLAYBACK_STARTED);
  assert.equal(started.details.playback_rate, 1.5);
});

test('mid-transition rate change preserves transition identity and re-arms only remaining presentation time', async () => {
  const time = virtualScheduler();
  const timed = timedRenderer(1000);
  const instance = createCiMInstance({
    instanceId: 'mid-transition',
    experience: freezeV1(),
    clock: time.scheduler,
    renderer: timed.renderer,
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();

  const play = await instance.play();
  assert.equal(play.transitionId, 'txn-2');
  time.advance(400);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');

  const rate = instance.setPlaybackRate(2);
  assert.equal(rate.transitionId, 'txn-2');
  assert.equal(instance.read.snapshot().operational.transitionId, 'txn-2');
  const rateEvent = events.find((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.equal(rateEvent.transition_id, 'txn-2');
  assert.equal(rateEvent.details.transition_phase, 'in_flight');

  time.advance(299);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');
  assert.equal(timed.settlements, 0);

  time.advance(1);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-01');
  assert.equal(timed.settlements, 1);
});

test('active dwell uses presentation time and rate changes preserve its exact remainder', async () => {
  const time = virtualScheduler();
  const instance = createCiMInstance({
    instanceId: 'rate-dwell',
    experience: freezeV1({ dwell: 1000 }),
    clock: time.scheduler,
    renderer: immediateRenderer(),
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();
  await instance.play();
  await flush();

  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-01');
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 1000);
  time.advance(400);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 600);

  instance.setPlaybackRate(2);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 600);
  const rateEvent = events.find((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.equal(rateEvent.details.transition_phase, 'idle');
  assert.equal('transition_id' in rateEvent, false);

  time.advance(299);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-01');
  time.advance(1);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-02');
});

test('rate change while paused arms no presentation work and resume uses the new rate', async () => {
  const time = virtualScheduler();
  const timed = timedRenderer(1000);
  const instance = createCiMInstance({
    instanceId: 'paused-rate',
    experience: freezeV1(),
    clock: time.scheduler,
    renderer: timed.renderer,
    rendererRoot: {}
  });
  await instance.initialize();
  await instance.play();
  time.advance(400);
  instance.pause();
  const pendingBefore = time.pendingDelays();

  instance.setPlaybackRate(2);
  assert.equal(time.pendingDelays(), pendingBefore, 'rate change while paused must arm nothing');
  time.advance(5000);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');

  await instance.play();
  time.advance(299);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');
  time.advance(1);
  await flush();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'step-01');
});

test('rate command lifecycle, no-op, range validation, and source-time timestamps are explicit', async () => {
  const time = virtualScheduler();
  const { instance } = makeInstance({ time, id: 'rate-lifecycle' });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  const before = instance.setPlaybackRate(1.5);
  assert.equal(before.result, 'rejected');
  assert.equal(before.reason, 'invalid_state');
  assert.equal(events.at(-1).event, EVENT_NAME.COMMAND_REJECTED);

  await instance.initialize();
  const countBeforeNoop = events.length;
  const noop = instance.setPlaybackRate(1);
  assert.equal(noop.result, 'no_change');
  assert.equal(events.length, countBeforeNoop, 'same-rate command emits no event');

  for (const value of [0.49, 2.01, NaN, Infinity, '1']) {
    const count = events.length;
    assert.throws(() => instance.setPlaybackRate(value), RangeError);
    assert.equal(events.length, count);
    assert.equal(instance.read.snapshot().operational.playbackRate, 1);
  }

  time.advance(25);
  instance.setPlaybackRate(2);
  const rateEvent = events.findLast((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED);
  assert.equal(rateEvent.timestamp_ms, 25, 'rate event timestamp stays on source time');

  await instance.dispose();
  const countAfterDispose = events.length;
  const after = instance.setPlaybackRate(1.5);
  assert.equal(after.result, 'rejected');
  assert.equal(after.reason, 'disposed');
  assert.equal(events.length, countAfterDispose, 'terminal disposal closes command evidence');
});
