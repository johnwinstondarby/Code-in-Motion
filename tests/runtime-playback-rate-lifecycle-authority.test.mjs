import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experience(rate = 1) {
  return freezeValidatedExperience({
    schema: 'localis.cim/v2',
    engine_min: '0.2.0',
    experience_version: '1.0.0',
    id: `playback-rate-lifecycle-${String(rate).replace('.', '-')}`,
    renderer: 'synthetic/v1',
    presentation: {
      title: 'Playback rate lifecycle authority',
      description: 'Lifecycle and source-time authority fixture.',
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
    }
  };
}

async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function countRateEvents(events) {
  return events.filter((event) => event.event === EVENT_NAME.PLAYBACK_RATE_CHANGED).length;
}

function assertRejectedRateChange({ instance, events, nextRate, reason }) {
  const before = instance.read.snapshot();
  const rateEventCount = countRateEvents(events);
  const rejectedCount = events.filter((event) => event.event === EVENT_NAME.COMMAND_REJECTED).length;

  const outcome = instance.setPlaybackRate(nextRate);

  assert.equal(outcome.command, 'setPlaybackRate');
  assert.equal(outcome.result, 'rejected');
  assert.equal(outcome.reason, reason);
  assert.deepEqual(instance.read.snapshot(), before, 'rejected rate command must not change Runtime or Core state');
  assert.equal(countRateEvents(events), rateEventCount, 'rejected rate command must not emit playback.rate_changed');
  assert.equal(
    events.filter((event) => event.event === EVENT_NAME.COMMAND_REJECTED).length,
    rejectedCount + 1,
    'rejected rate command must retain normal command-rejection evidence while the stream is open'
  );
}

test('initialization-in-progress rejects rate changes and lifecycle abort acknowledgement stays on source time', async (t) => {
  for (const rate of [0.5, 2]) {
    await t.test(`${rate}x`, async () => {
      const time = virtualScheduler();
      const renderer = Object.freeze({
        mount() {},
        render() {
          return new Promise(() => {});
        },
        dispose() {}
      });
      const instance = createCiMInstance({
        instanceId: `rate-initializing-${rate}`,
        experience: experience(rate),
        clock: time.scheduler,
        renderer,
        rendererRoot: {}
      });
      const events = [];
      instance.events.subscribe((event) => events.push(event));

      const initialization = instance.initialize();
      await flush();
      assert.equal(instance.read.snapshot().operational.playbackRate, rate);
      assertRejectedRateChange({
        instance,
        events,
        nextRate: rate === 0.5 ? 2 : 0.5,
        reason: 'invalid_state'
      });

      let disposalSettled = false;
      const disposal = instance.dispose().then((snapshot) => {
        disposalSettled = true;
        return snapshot;
      });
      await assert.rejects(initialization, /initialization cancelled by disposal/);
      await flush();

      time.advance(999);
      await flush();
      assert.equal(disposalSettled, false);

      time.advance(1);
      await flush();
      assert.equal(disposalSettled, true, 'lifecycle abort acknowledgement deadline settles exactly at 1000 source ms');
      const snapshot = await disposal;
      assert.equal(snapshot.canonical.status, 'disposed');

      const timeout = events.find(
        (event) => event.event === EVENT_NAME.RENDERER_ERROR && event.error_code === 'CIM-RND-002'
      );
      assert.ok(timeout);
      assert.equal(timeout.timestamp_ms, 1000);
      assert.equal(timeout.details.operation, 'abort_acknowledgement');
      assert.equal(timeout.details.timeout_ms, 1000);
    });
  }
});

test('active recovery rejects rate changes and lifecycle abort acknowledgement stays on source time', async (t) => {
  for (const rate of [0.5, 2]) {
    await t.test(`${rate}x`, async () => {
      const time = virtualScheduler();
      const destinationError = new Error(`destination failed at ${rate}x`);
      let renderCount = 0;
      const renderer = Object.freeze({
        mount() {},
        render() {
          renderCount += 1;
          if (renderCount === 1) return Promise.resolve();
          if (renderCount === 2) return Promise.reject(destinationError);
          return new Promise(() => {});
        },
        dispose() {}
      });
      const instance = createCiMInstance({
        instanceId: `rate-recovery-${rate}`,
        experience: experience(rate),
        clock: time.scheduler,
        renderer,
        rendererRoot: {}
      });
      const events = [];
      instance.events.subscribe((event) => events.push(event));

      await instance.initialize();
      const navigation = instance.next();
      const navigationRejected = assert.rejects(navigation, (error) => error === destinationError);
      for (let i = 0; i < 20 && !events.some((event) => event.event === EVENT_NAME.RECOVERY_STARTED); i += 1) {
        await flush();
      }
      assert.ok(events.some((event) => event.event === EVENT_NAME.RECOVERY_STARTED));
      assert.equal(instance.read.snapshot().operational.playbackRate, rate);
      assertRejectedRateChange({
        instance,
        events,
        nextRate: rate === 0.5 ? 2 : 0.5,
        reason: 'invalid_state'
      });

      let disposalSettled = false;
      const disposal = instance.dispose().then((snapshot) => {
        disposalSettled = true;
        return snapshot;
      });
      await navigationRejected;
      await flush();

      time.advance(999);
      await flush();
      assert.equal(disposalSettled, false);

      time.advance(1);
      await flush();
      assert.equal(disposalSettled, true, 'lifecycle abort acknowledgement deadline settles exactly at 1000 source ms');
      const snapshot = await disposal;
      assert.equal(snapshot.canonical.status, 'disposed');

      const timeout = events.find(
        (event) => event.event === EVENT_NAME.RENDERER_ERROR && event.error_code === 'CIM-RND-002'
      );
      assert.ok(timeout);
      assert.equal(timeout.timestamp_ms, 1000);
      assert.equal(timeout.details.operation, 'abort_acknowledgement');
      assert.equal(timeout.details.timeout_ms, 1000);
    });
  }
});

test('faulted state rejects rate changes without changing state or emitting a rate event', async () => {
  const time = virtualScheduler();
  const destinationError = new Error('destination failed');
  const restorationError = new Error('restoration failed');
  let renderCount = 0;
  const renderer = Object.freeze({
    mount() {},
    render() {
      renderCount += 1;
      if (renderCount === 1) return Promise.resolve();
      if (renderCount === 2) return Promise.reject(destinationError);
      return Promise.reject(restorationError);
    },
    dispose() {}
  });
  const instance = createCiMInstance({
    instanceId: 'rate-faulted',
    experience: experience(1.5),
    clock: time.scheduler,
    renderer,
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await assert.rejects(instance.next(), (error) => error === destinationError);
  assert.equal(instance.read.snapshot().canonical.status, 'faulted');
  assertRejectedRateChange({ instance, events, nextRate: 2, reason: 'faulted' });

  await instance.dispose();
});

test('disposal in progress rejects rate changes before terminal disposal', async () => {
  const time = virtualScheduler();
  let renderCount = 0;
  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      renderCount += 1;
      if (renderCount === 1) return Promise.resolve();
      return new Promise(() => {});
    },
    dispose() {}
  });
  const instance = createCiMInstance({
    instanceId: 'rate-disposing',
    experience: experience(1.5),
    clock: time.scheduler,
    renderer,
    rendererRoot: {}
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));

  await instance.initialize();
  await instance.play();
  await flush();
  assert.equal(instance.read.snapshot().operational.transitionPhase, 'in_flight');

  let disposalSettled = false;
  const disposal = instance.dispose().then((snapshot) => {
    disposalSettled = true;
    return snapshot;
  });
  assertRejectedRateChange({ instance, events, nextRate: 2, reason: 'invalid_state' });

  time.advance(999);
  await flush();
  assert.equal(disposalSettled, false);
  time.advance(1);
  const snapshot = await disposal;
  assert.equal(snapshot.canonical.status, 'disposed');
});
