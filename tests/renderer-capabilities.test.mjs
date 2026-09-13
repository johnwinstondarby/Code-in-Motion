import test from 'node:test';
import assert from 'node:assert/strict';

import { ABORT_SIGNAL_KEYS, RENDER_CLOCK_KEYS } from '../src/renderers/interface.mjs';
import {
  RendererCapabilityRevokedError,
  createRendererAbortCapability,
  createRendererClockCapability
} from '../src/runtime/renderer-capabilities.mjs';

function createVirtualScheduler() {
  let now = 0;
  let paused = false;
  let sequence = 0;
  const delays = new Map();
  const frames = new Map();
  const history = [];

  function nextHandle(kind) {
    sequence += 1;
    return `${kind}-${sequence}`;
  }

  return {
    now() {
      return now;
    },

    schedule(fn, ms) {
      const handle = nextHandle('delay');
      delays.set(handle, { fn, due: now + ms });
      history.push({ kind: 'delay', handle, fn });
      return handle;
    },

    cancel(handle) {
      return delays.delete(handle) || frames.delete(handle);
    },

    onFrame(fn) {
      const handle = nextHandle('frame');
      frames.set(handle, fn);
      history.push({ kind: 'frame', handle, fn });
      return handle;
    },

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
    },

    advance(ms) {
      if (paused) return;
      now += ms;
      for (const [handle, entry] of [...delays]) {
        if (entry.due <= now) {
          delays.delete(handle);
          entry.fn(now);
        }
      }
    },

    emitFrame() {
      if (paused) return;
      for (const fn of [...frames.values()]) fn(now);
    },

    history
  };
}

test('abort facade is frozen, exact, live, and cannot initiate cancellation', () => {
  const { facade, controller } = createRendererAbortCapability();

  assert.deepEqual(Object.keys(facade), ABORT_SIGNAL_KEYS);
  assert.equal(Object.isFrozen(facade), true);
  assert.equal(facade.aborted, false);
  assert.equal(facade.reason, null);
  assert.equal('dispatchEvent' in facade, false);
  assert.equal('abort' in facade, false);

  assert.throws(() => {
    facade.aborted = true;
  }, TypeError);

  const seen = [];
  facade.onAbort((reason) => seen.push(reason));
  const result = controller.abort('navigation');

  assert.equal(result.changed, true);
  assert.deepEqual(result.callbackErrors, []);
  assert.equal(facade.aborted, true);
  assert.equal(facade.reason, 'navigation');
  assert.deepEqual(seen, ['navigation']);
});

test('abort unsubscribe is scoped to the renderer callback', () => {
  const { facade, controller } = createRendererAbortCapability();
  let called = 0;
  const unsubscribe = facade.onAbort(() => { called += 1; });

  assert.equal(typeof unsubscribe, 'function');
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  controller.abort('cancelled');
  assert.equal(called, 0);
});

test('abort callback registered after abort observes the reason once', () => {
  const { facade, controller } = createRendererAbortCapability();
  controller.abort('superseded');
  const seen = [];
  const unsubscribe = facade.onAbort((reason) => seen.push(reason));

  assert.deepEqual(seen, ['superseded']);
  assert.equal(unsubscribe(), false);
});

test('closing an abort capability clears listeners without fabricating an abort', () => {
  const { facade, controller } = createRendererAbortCapability();
  let called = 0;
  facade.onAbort(() => { called += 1; });

  assert.equal(controller.close(), true);
  assert.equal(controller.close(), false);
  assert.equal(controller.abort('late').changed, false, 'closed capability cannot be aborted');
  assert.equal(facade.aborted, false);
  assert.equal(facade.reason, null);
  assert.equal(called, 0);
});

test('abort notification isolates callback failures and continues notifying', () => {
  const { facade, controller } = createRendererAbortCapability();
  const seen = [];
  facade.onAbort(() => { throw new Error('listener failed'); });
  facade.onAbort((reason) => seen.push(reason));

  const result = controller.abort('fault');
  assert.equal(result.callbackErrors.length, 1);
  assert.match(result.callbackErrors[0].message, /listener failed/);
  assert.deepEqual(seen, ['fault']);
});

test('clock facade is frozen and exposes only the four v1 methods', () => {
  const scheduler = createVirtualScheduler();
  const { facade } = createRendererClockCapability({ transitionId: 't-1', scheduler });

  assert.deepEqual(Object.keys(facade), RENDER_CLOCK_KEYS);
  assert.equal(Object.isFrozen(facade), true);
  for (const key of RENDER_CLOCK_KEYS) assert.equal(typeof facade[key], 'function');
  assert.equal('pause' in facade, false);
  assert.equal('resume' in facade, false);
});

test('clock delayed work is one-shot and renderer handles hide scheduler handles', () => {
  const scheduler = createVirtualScheduler();
  const { facade } = createRendererClockCapability({ transitionId: 't-delay', scheduler });
  const seen = [];

  const handle = facade.schedule((at) => seen.push(at), 25);
  assert.equal(typeof handle, 'symbol');
  assert.notEqual(handle, scheduler.history[0].handle);

  scheduler.advance(24);
  assert.deepEqual(seen, []);
  scheduler.advance(1);
  assert.deepEqual(seen, [25]);
  scheduler.advance(100);
  assert.deepEqual(seen, [25]);
  assert.equal(facade.cancel(handle), false, 'completed one-shot handle is no longer owned');
});

test('clock frame work repeats until cancelled and pause freezes both timing paths', () => {
  const scheduler = createVirtualScheduler();
  const { facade } = createRendererClockCapability({ transitionId: 't-frame', scheduler });
  const frames = [];
  const delays = [];

  const frameHandle = facade.onFrame((at) => frames.push(at));
  facade.schedule((at) => delays.push(at), 10);

  scheduler.emitFrame();
  assert.deepEqual(frames, [0]);

  scheduler.pause();
  scheduler.advance(20);
  scheduler.emitFrame();
  assert.deepEqual(frames, [0]);
  assert.deepEqual(delays, []);

  scheduler.resume();
  scheduler.advance(10);
  scheduler.emitFrame();
  assert.deepEqual(delays, [10]);
  assert.deepEqual(frames, [0, 10]);

  assert.equal(facade.cancel(frameHandle), true);
  scheduler.emitFrame();
  assert.deepEqual(frames, [0, 10]);
});

test('clock facade replaces source callback timestamps with virtual CiM time', () => {
  let virtualNow = 7;
  let delayed;
  let framed;
  const scheduler = {
    now() { return virtualNow; },
    schedule(fn) { delayed = fn; return 'delay-source'; },
    cancel() { return true; },
    onFrame(fn) { framed = fn; return 'frame-source'; }
  };
  const { facade } = createRendererClockCapability({ transitionId: 't-virtual', scheduler });
  const seen = [];

  facade.schedule((at) => seen.push(['delay', at]), 0);
  facade.onFrame((at) => seen.push(['frame', at]));

  virtualNow = 11;
  delayed(999999);
  virtualNow = 12;
  framed(888888);

  assert.deepEqual(seen, [['delay', 11], ['frame', 12]]);
});

test('clock revocation cancels owned work and stale source callbacks become inert', () => {
  const scheduler = createVirtualScheduler();
  const { facade, controller } = createRendererClockCapability({ transitionId: 't-stale', scheduler });
  let mutations = 0;

  facade.schedule(() => { mutations += 1; }, 50);
  facade.onFrame(() => { mutations += 10; });
  const staleDelay = scheduler.history.find((entry) => entry.kind === 'delay').fn;
  const staleFrame = scheduler.history.find((entry) => entry.kind === 'frame').fn;

  const result = controller.revoke();
  assert.equal(result.changed, true);
  assert.deepEqual(result.cancelErrors, []);
  assert.equal(controller.revoke().changed, false);

  staleDelay(50);
  staleFrame(50);
  assert.equal(mutations, 0);

  assert.throws(() => facade.now(), RendererCapabilityRevokedError);
  assert.throws(() => facade.schedule(() => {}, 0), RendererCapabilityRevokedError);
  assert.throws(() => facade.onFrame(() => {}), RendererCapabilityRevokedError);
  assert.equal(facade.cancel(Symbol('unknown')), false);
});

test('clock validates callbacks, delays, scheduler shape, and transition identity', () => {
  const scheduler = createVirtualScheduler();
  const { facade } = createRendererClockCapability({ transitionId: 't-validate', scheduler });

  assert.throws(() => facade.schedule(null, 0), TypeError);
  assert.throws(() => facade.schedule(() => {}, -1), RangeError);
  assert.throws(() => facade.schedule(() => {}, Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => facade.onFrame('nope'), TypeError);
  assert.throws(() => createRendererClockCapability({ transitionId: null, scheduler }), TypeError);
  assert.throws(() => createRendererClockCapability({ transitionId: 't-bad', scheduler: {} }), TypeError);
});
