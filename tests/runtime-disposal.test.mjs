import test from 'node:test';
import assert from 'node:assert/strict';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';
import { EVENT_NAME } from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';

function experience({ dwell = 0 } = {}) {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'dispose-fixture',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' },
        ...(dwell ? { dwell_ms: dwell } : {})
      },
      {
        id: 'step-02',
        label: 'Two',
        commentary: { text: 'Two', links: [] },
        state: { node: 'C' }
      }
    ]
  });
}

function virtualScheduler() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const scheduler = Object.freeze({
    now: () => now,
    schedule(fn, ms) { const h = ++id; timers.set(h, { at: now + ms, fn }); return h; },
    cancel(h) { return timers.delete(h); },
    onFrame(fn) { const h = ++id; timers.set(h, { at: Number.POSITIVE_INFINITY, fn }); return h; }
  });
  return {
    scheduler,
    advance(ms) {
      now += ms;
      const due = [...timers.entries()].filter(([,e]) => e.at <= now).sort((a,b)=>a[1].at-b[1].at);
      for (const [h,e] of due) if (timers.delete(h)) e.fn();
    },
    count: () => timers.size
  };
}

async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

const root = {};

function immediateRenderer({ disposeError = null } = {}) {
  const metrics = { mount: 0, render: 0, dispose: 0 };
  return {
    metrics,
    renderer: Object.freeze({
      mount() { metrics.mount += 1; },
      render() { metrics.render += 1; return Promise.resolve(); },
      dispose() { metrics.dispose += 1; if (disposeError) throw disposeError; }
    })
  };
}

function pendingPlaybackRenderer() {
  const metrics = { dispose: 0, aborts: 0 };
  let pending = null;
  return {
    metrics,
    get pending() { return pending; },
    renderer: Object.freeze({
      mount() {},
      render(_state, context) {
        if (!context.animate) return Promise.resolve();
        return new Promise((resolve, reject) => {
          let settled = false;
          const off = context.abortSignal.onAbort((reason) => {
            if (settled) return;
            settled = true;
            metrics.aborts += 1;
            off();
            reject(new Error(`cancelled:${reason}`));
          });
          pending = {
            resolve() { if (settled) return false; settled = true; off(); resolve(); return true; }
          };
        });
      },
      dispose() { metrics.dispose += 1; }
    })
  };
}

test('idle disposal is terminal, idempotent, and closes semantic evidence after renderer.disposed', async () => {
  const time = virtualScheduler();
  const r = immediateRenderer();
  const instance = createCiMInstance({ instanceId: 'idle', experience: experience(), clock: time.scheduler, renderer: r.renderer, rendererRoot: root });
  const events = [];
  instance.events.subscribe((e) => events.push(e));
  await instance.initialize();

  const disposed = await instance.dispose();
  assert.equal(disposed.canonical.status, 'disposed');
  assert.deepEqual(disposed.operational, {
    playbackIntent: false,
    transitionId: null,
    transitionPhase: 'idle',
    dwellRemainingMs: 0,
    activeAbortState: null
  });
  assert.equal(r.metrics.dispose, 1);
  assert.equal(events.at(-1).event, EVENT_NAME.RENDERER_DISPOSED);

  const eventCount = events.length;
  const after = await instance.next();
  assert.equal(after.result, 'rejected');
  assert.equal(after.reason, 'disposed');
  assert.equal(events.length, eventCount);

  const again = await instance.dispose();
  assert.equal(again.canonical.status, 'disposed');
  assert.equal(r.metrics.dispose, 1);
});

test('dispose cancels a paused playback transition, abandons its target, and prevents stale commit', async () => {
  const time = virtualScheduler();
  const r = pendingPlaybackRenderer();
  const instance = createCiMInstance({ instanceId: 'paused', experience: experience(), clock: time.scheduler, renderer: r.renderer, rendererRoot: root });
  const events = [];
  instance.events.subscribe((e) => events.push(e));
  await instance.initialize();
  await instance.play();
  await flush();
  assert.equal(instance.read.snapshot().canonical.targetStepId, 'step-01');
  instance.pause();
  assert.equal(instance.read.snapshot().canonical.status, 'paused');

  await instance.dispose();
  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.status, 'disposed');
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.operational.transitionId, null);
  assert.equal(snapshot.operational.activeAbortState, null);
  assert.equal(r.metrics.aborts, 1);
  assert.equal(r.metrics.dispose, 1);
  assert.equal(r.pending.resolve(), false);
  assert.equal(events.some((e) => e.event === EVENT_NAME.STEP_CHANGED), false);
  assert.ok(events.some((e) => e.event === EVENT_NAME.PLAYBACK_STOPPED && e.details.reason === 'dispose'));
  assert.ok(events.some((e) => e.event === EVENT_NAME.TRANSITION_CANCELLED && e.details.reason === 'dispose'));
  assert.ok(events.some((e) => e.event === EVENT_NAME.RENDERER_CANCELLED));
  assert.equal(events.at(-1).event, EVENT_NAME.RENDERER_DISPOSED);
});

test('dispose cancels dwell with its exact remainder and no timer can publish afterward', async () => {
  const time = virtualScheduler();
  const r = immediateRenderer();
  const instance = createCiMInstance({ instanceId: 'dwell', experience: experience({ dwell: 100 }), clock: time.scheduler, renderer: r.renderer, rendererRoot: root });
  const events = [];
  instance.events.subscribe((e) => events.push(e));
  await instance.initialize();
  await instance.play();
  await flush();
  time.advance(40);
  assert.equal(instance.read.snapshot().operational.dwellRemainingMs, 60);

  await instance.dispose();
  const cancelled = events.find((e) => e.event === EVENT_NAME.DWELL_CANCELLED);
  assert.equal(cancelled.details.reason, 'dispose');
  assert.equal(cancelled.details.dwell_remaining_ms, 60);
  assert.equal('command_id' in cancelled, false);
  assert.equal(instance.read.snapshot().canonical.status, 'disposed');

  const count = events.length;
  time.advance(5000);
  await flush();
  assert.equal(events.length, count);
  assert.equal(events.some((e) => e.event === EVENT_NAME.DWELL_COMPLETED), false);
});

test('dispose interrupts active renderer recovery without misclassifying disposal as restoration failure', async () => {
  const time = virtualScheduler();
  let renderCount = 0;
  let recoveryAbort = 0;
  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      renderCount += 1;
      if (renderCount === 1) return Promise.resolve();
      if (renderCount === 2) return Promise.reject(new Error('destination failed'));
      return new Promise((_resolve, reject) => {
        context.abortSignal.onAbort((reason) => { recoveryAbort += 1; reject(new Error(`recovery:${reason}`)); });
      });
    },
    dispose() {}
  });
  const instance = createCiMInstance({ instanceId: 'recovery', experience: experience(), clock: time.scheduler, renderer, rendererRoot: root });
  const events = [];
  instance.events.subscribe((e) => events.push(e));
  await instance.initialize();

  const navigation = instance.next();
  for (let i = 0; i < 20 && !events.some((e) => e.event === EVENT_NAME.RECOVERY_STARTED); i += 1) await flush();
  assert.ok(events.some((e) => e.event === EVENT_NAME.RECOVERY_STARTED));

  const disposal = instance.dispose();
  await assert.rejects(navigation, /destination failed/);
  await disposal;

  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.status, 'disposed');
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.error, null);
  assert.equal(recoveryAbort, 1);
  assert.equal(events.some((e) => e.event === EVENT_NAME.RECOVERY_FAILED), false);
  assert.equal(events.some((e) => e.event === EVENT_NAME.INSTANCE_FAULTED), false);
  assert.equal(events.at(-1).event, EVENT_NAME.RENDERER_DISPOSED);
});

test('dispose advances fallback-faulted Core only to disposed and preserves terminal fault evidence', async () => {
  const time = virtualScheduler();
  let renderCount = 0;
  const renderer = Object.freeze({
    mount() {},
    render() {
      renderCount += 1;
      if (renderCount === 1) return Promise.resolve();
      if (renderCount === 2) return Promise.reject(new Error('destination failed'));
      return Promise.reject(new Error('restoration failed'));
    },
    dispose() {}
  });
  const instance = createCiMInstance({ instanceId: 'faulted', experience: experience(), clock: time.scheduler, renderer, rendererRoot: root });
  await instance.initialize();
  await assert.rejects(instance.next(), /destination failed/);
  assert.equal(instance.read.snapshot().canonical.status, 'faulted');
  assert.equal(instance.read.snapshot().canonical.error.code, 'CIM-RND-006');

  await instance.dispose();
  const snapshot = instance.read.snapshot();
  assert.equal(snapshot.canonical.status, 'disposed');
  assert.equal(snapshot.canonical.error.code, 'CIM-RND-006');
  assert.equal(snapshot.canonical.error.recoveryClass, 'fallback');
});

test('renderer dispose failure still leaves Core terminal and closes the event stream', async () => {
  const time = virtualScheduler();
  const failure = new Error('dispose failed');
  const r = immediateRenderer({ disposeError: failure });
  const instance = createCiMInstance({ instanceId: 'dispose-error', experience: experience(), clock: time.scheduler, renderer: r.renderer, rendererRoot: root });
  const events = [];
  instance.events.subscribe((e) => events.push(e));
  await instance.initialize();

  await assert.rejects(instance.dispose(), /dispose failed/);
  assert.equal(instance.read.snapshot().canonical.status, 'disposed');
  assert.equal(events.at(-1).event, EVENT_NAME.RENDERER_ERROR);
  assert.equal(events.at(-1).details.operation, 'dispose');
  const count = events.length;
  const outcome = await instance.pause();
  assert.equal(outcome.reason, 'disposed');
  assert.equal(events.length, count);
});

test('dispose during initial settlement aborts the lifecycle render and never publishes step.initial', async () => {
  const time = virtualScheduler();
  let aborts = 0;
  let disposeCount = 0;
  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      return new Promise((_resolve, reject) => {
        context.abortSignal.onAbort((reason) => { aborts += 1; reject(new Error(`initial:${reason}`)); });
      });
    },
    dispose() { disposeCount += 1; }
  });
  const instance = createCiMInstance({ instanceId: 'initial-dispose', experience: experience(), clock: time.scheduler, renderer, rendererRoot: root });
  const events = [];
  instance.events.subscribe((e) => events.push(e));

  const initialization = instance.initialize();
  await flush();
  const disposal = instance.dispose();
  await assert.rejects(initialization, /initial:dispose/);
  await disposal;

  assert.equal(aborts, 1);
  assert.equal(disposeCount, 1);
  assert.equal(instance.read.snapshot().canonical.status, 'disposed');
  assert.equal(events.some((e) => e.event === EVENT_NAME.STEP_INITIAL), false);
  assert.ok(events.some((e) => e.event === EVENT_NAME.RENDERER_CANCELLED));
  assert.equal(events.at(-1).event, EVENT_NAME.RENDERER_DISPOSED);
});
