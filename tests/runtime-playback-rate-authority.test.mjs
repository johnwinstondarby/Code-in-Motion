import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { RENDER_CONTEXT_KEYS } from '../src/renderers/interface.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';

function experience() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'playback-rate-authority',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { value: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { value: 'B' }
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

function graphContainsKey(root, target, seen = new Set()) {
  if ((typeof root !== 'object' && typeof root !== 'function') || root === null || seen.has(root)) {
    return false;
  }
  seen.add(root);

  for (const key of Reflect.ownKeys(root)) {
    if (key === target) return true;
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (descriptor && 'value' in descriptor && graphContainsKey(descriptor.value, target, seen)) {
      return true;
    }
  }
  return false;
}

test('effective playback rate never enters the renderer context graph', async () => {
  const time = virtualScheduler();
  const contexts = [];
  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      contexts.push(context);
      return Promise.resolve();
    },
    dispose() {}
  });
  const instance = createCiMInstance({
    instanceId: 'renderer-authority',
    experience: experience(),
    clock: time.scheduler,
    renderer,
    rendererRoot: {}
  });

  await instance.initialize();
  instance.setPlaybackRate(2);
  await instance.play();
  await flush();

  assert.equal(contexts.length, 2);
  for (const context of contexts) {
    assert.deepEqual(Object.keys(context).sort(), [...RENDER_CONTEXT_KEYS].sort());
    assert.equal(graphContainsKey(context, 'playbackRate'), false);
    assert.equal(graphContainsKey(context, 'setPlaybackRate'), false);
  }

  await instance.dispose();
});

test('abort acknowledgement deadline remains exactly 1000 ms of source time at 0.5x and 2x', async (t) => {
  for (const rate of [0.5, 2]) {
    await t.test(`${rate}x`, async () => {
      const time = virtualScheduler();
      const renderer = Object.freeze({
        mount() {},
        render(_state, context) {
          if (!context.animate) return Promise.resolve();
          return new Promise(() => {});
        },
        dispose() {}
      });
      const instance = createCiMInstance({
        instanceId: `abort-source-time-${rate}`,
        experience: experience(),
        clock: time.scheduler,
        renderer,
        rendererRoot: {}
      });
      const events = [];
      instance.events.subscribe((event) => events.push(event));

      await instance.initialize();
      instance.setPlaybackRate(rate);
      await instance.play();
      await flush();

      let settled = false;
      const disposal = instance.dispose().then((snapshot) => {
        settled = true;
        return snapshot;
      });
      await flush();

      time.advance(999);
      await flush();
      assert.equal(settled, false);

      time.advance(1);
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

test('renderer dispose acknowledgement deadline remains exactly 1000 ms of source time at 0.5x and 2x', async (t) => {
  for (const rate of [0.5, 2]) {
    await t.test(`${rate}x`, async () => {
      const time = virtualScheduler();
      const renderer = Object.freeze({
        mount() {},
        render() {
          return Promise.resolve();
        },
        dispose() {
          return new Promise(() => {});
        }
      });
      const instance = createCiMInstance({
        instanceId: `dispose-source-time-${rate}`,
        experience: experience(),
        clock: time.scheduler,
        renderer,
        rendererRoot: {}
      });
      const events = [];
      instance.events.subscribe((event) => events.push(event));

      await instance.initialize();
      instance.setPlaybackRate(rate);

      let settled = false;
      const disposal = instance.dispose().then((snapshot) => {
        settled = true;
        return snapshot;
      });
      await flush();

      time.advance(999);
      await flush();
      assert.equal(settled, false);

      time.advance(1);
      const snapshot = await disposal;
      assert.equal(snapshot.canonical.status, 'disposed');

      const timeout = events.find(
        (event) => event.event === EVENT_NAME.RENDERER_ERROR && event.error_code === 'CIM-RND-003'
      );
      assert.ok(timeout);
      assert.equal(timeout.timestamp_ms, 1000);
      assert.equal(timeout.details.operation, 'dispose_acknowledgement');
      assert.equal(timeout.details.timeout_ms, 1000);
      assert.equal(events.some((event) => event.event === EVENT_NAME.RENDERER_DISPOSED), false);
    });
  }
});
