import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RendererCapabilityViolationError,
  RENDER_CAPABILITY_MAX_DEPTH,
  assertRendererContextCapabilities
} from '../src/renderers/capability-inspector.mjs';
import { createRendererContext } from '../src/runtime/renderer-context.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from '../src/runtime/renderer-capabilities.mjs';

function scheduler() {
  return {
    now: () => 10,
    schedule: () => 'delay-source',
    cancel: () => true,
    onFrame: () => 'frame-source'
  };
}

function capabilityPair() {
  return {
    abortSignal: createRendererAbortCapability().facade,
    clock: createRendererClockCapability({ transitionId: 't-1', scheduler: scheduler() }).facade
  };
}

function rawContext(overrides = {}) {
  const caps = capabilityPair();
  return Object.freeze({
    animate: false,
    fromState: null,
    fromStepId: null,
    stepId: 'step-01',
    rendererConfig: Object.freeze({ nested: Object.freeze({ label: 'safe' }) }),
    stepRendererConfig: null,
    transitionId: 't-1',
    abortSignal: caps.abortSignal,
    clock: caps.clock,
    reducedMotion: false,
    ...overrides
  });
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

test('valid renderer context passes capability inspection and construction', () => {
  const input = { ...rawContext() };
  const context = createRendererContext(input);

  assert.equal(assertRendererContextCapabilities(context), true);
  assert.equal(Object.isFrozen(context), true);
});

test('plain class instance with innocuous prototype method fails capability inspection', () => {
  class ValueBox {
    refreshPreview() {}
  }

  const value = Object.freeze(new ValueBox());
  assert.throws(
    () => assertRendererContextCapabilities(rawContext({ rendererConfig: value })),
    (error) => error instanceof RendererCapabilityViolationError && /refreshPreview/.test(error.path)
  );
});

test('unknown getter on a nested object is detected without invocation', () => {
  let invoked = 0;
  const config = {};
  Object.defineProperty(config, 'authority', {
    enumerable: true,
    get() {
      invoked += 1;
      return () => 'live';
    }
  });
  Object.freeze(config);

  assert.throws(
    () => createRendererContext({ ...rawContext(), rendererConfig: config }),
    /accessor properties are prohibited/
  );
  assert.equal(invoked, 0);
});

test('prototype getter is detected without invocation', () => {
  let invoked = 0;
  class LazyValue {
    get authority() {
      invoked += 1;
      return () => 'live';
    }
  }

  const value = Object.freeze(new LazyValue());
  assert.throws(
    () => assertRendererContextCapabilities(rawContext({ rendererConfig: value })),
    /accessor properties are prohibited/
  );
  assert.equal(invoked, 0);
});

test('function hidden in an otherwise plausible frozen config fails closed', () => {
  const config = Object.freeze({ format: 'compact', refreshPreview() {} });

  assert.throws(
    () => createRendererContext({ ...rawContext(), rendererConfig: config }),
    /reachable function capability is outside the renderer allowlist/
  );
});

test('abort facade state must remain read-only accessor projections', () => {
  const fakeAbort = Object.freeze({
    aborted: false,
    reason: null,
    onAbort() {}
  });

  assert.throws(
    () => createRendererContext({ ...rawContext(), abortSignal: fakeAbort }),
    /abort state must be exposed through a getter with no setter/
  );
});

test('clock facade exact keys do not permit non-function authority slots', () => {
  const fakeClock = Object.freeze({
    now: 10,
    schedule() {},
    cancel() {},
    onFrame() {}
  });

  assert.throws(
    () => createRendererContext({ ...rawContext(), clock: fakeClock }),
    /clock facade methods must be function-valued data properties/
  );
});

test('custom prototype capability on an otherwise exact clock facade fails', () => {
  const prototype = { refreshTimeline() {} };
  const fakeClock = Object.create(prototype);
  Object.assign(fakeClock, {
    now() { return 10; },
    schedule() { return Symbol('delay'); },
    cancel() { return false; },
    onFrame() { return Symbol('frame'); }
  });
  Object.freeze(fakeClock);

  assert.throws(
    () => createRendererContext({ ...rawContext(), clock: fakeClock }),
    (error) => error instanceof RendererCapabilityViolationError && /refreshTimeline/.test(error.path)
  );
});

test('capability walk fails closed when the context graph exceeds eight object edges', () => {
  let config = { leaf: true };
  for (let index = 0; index < RENDER_CAPABILITY_MAX_DEPTH; index += 1) {
    config = { child: config };
  }
  deepFreeze(config);

  assert.throws(
    () => createRendererContext({ ...rawContext(), rendererConfig: config }),
    /maximum depth of 8 object edges/
  );
});
