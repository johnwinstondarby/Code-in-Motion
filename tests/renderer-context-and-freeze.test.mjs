import test from 'node:test';
import assert from 'node:assert/strict';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createRendererContext } from '../src/runtime/renderer-context.mjs';
import { createRendererAbortCapability, createRendererClockCapability } from '../src/runtime/renderer-capabilities.mjs';
import { RENDER_CONTEXT_KEYS } from '../src/renderers/interface.mjs';

function scheduler() {
  return {
    now: () => 5,
    schedule: () => 'delay',
    cancel: () => true,
    onFrame: () => 'frame'
  };
}

function capabilities() {
  return {
    abortSignal: createRendererAbortCapability().facade,
    clock: createRendererClockCapability({ transitionId: 't-1', scheduler: scheduler() }).facade
  };
}

function baseContext(overrides = {}) {
  const experience = freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'fixture',
    renderer: 'synthetic/v1',
    renderer_config: { scale: 1 },
    initial_state: { node: 'A' },
    steps: [{
      id: 'step-01',
      label: 'Step 1',
      commentary: { text: 'One', links: [] },
      state: { node: 'B' },
      renderer_config: { emphasis: 'high' }
    }]
  });
  const caps = capabilities();

  return {
    animate: false,
    fromState: null,
    fromStepId: null,
    stepId: 'step-01',
    rendererConfig: experience.renderer_config,
    stepRendererConfig: experience.steps[0].renderer_config,
    transitionId: 't-1',
    abortSignal: caps.abortSignal,
    clock: caps.clock,
    reducedMotion: false,
    ...overrides
  };
}

test('validated experience is deep-frozen in place across state, config, commentary, and links', () => {
  const experience = {
    schema: 'localis.cim/v1',
    renderer_config: { nested: { speed: 1 } },
    initial_state: { nodes: [{ id: 'A' }] },
    steps: [{
      id: 'step-01',
      state: { nodes: [{ id: 'B' }] },
      renderer_config: { emphasis: { level: 2 } },
      commentary: { text: 'One', links: [{ id: 'ref', label: 'Ref', href: '#ref' }] }
    }]
  };

  const frozen = freezeValidatedExperience(experience);
  assert.equal(frozen, experience);
  assert.equal(Object.isFrozen(experience), true);
  assert.equal(Object.isFrozen(experience.renderer_config.nested), true);
  assert.equal(Object.isFrozen(experience.initial_state.nodes), true);
  assert.equal(Object.isFrozen(experience.initial_state.nodes[0]), true);
  assert.equal(Object.isFrozen(experience.steps), true);
  assert.equal(Object.isFrozen(experience.steps[0].state.nodes[0]), true);
  assert.equal(Object.isFrozen(experience.steps[0].renderer_config.emphasis), true);
  assert.equal(Object.isFrozen(experience.steps[0].commentary.links[0]), true);

  assert.throws(() => { experience.steps[0].state.nodes[0].id = 'mutated'; }, TypeError);
  assert.equal(experience.steps[0].state.nodes[0].id, 'B');
});

test('freeze boundary rejects accessor-backed data without invoking the getter', () => {
  let invoked = 0;
  const experience = { schema: 'localis.cim/v1' };
  Object.defineProperty(experience, 'initial_state', {
    enumerable: true,
    get() {
      invoked += 1;
      return { hidden: true };
    }
  });

  assert.throws(() => freezeValidatedExperience(experience), /data properties/);
  assert.equal(invoked, 0);
});

test('freeze boundary rejects hidden authority and non-JSON values', () => {
  const hidden = { schema: 'localis.cim/v1' };
  Object.defineProperty(hidden, 'control', { enumerable: false, value: () => {} });
  assert.throws(() => freezeValidatedExperience(hidden), /hidden properties/);

  assert.throws(() => freezeValidatedExperience({ state: undefined }), /JSON data/);
  assert.throws(() => freezeValidatedExperience({ state: Number.NaN }), /finite/);
  assert.throws(() => freezeValidatedExperience({ state: new Date() }), /Object or null prototypes/);

  const cyclic = { schema: 'localis.cim/v1' };
  cyclic.self = cyclic;
  assert.throws(() => freezeValidatedExperience(cyclic), /cannot contain cycles/);
});

test('render context output has the exact canonical key order and is frozen', () => {
  const input = baseContext();
  const shuffled = Object.fromEntries(Object.entries(input).reverse());
  const context = createRendererContext(shuffled);

  assert.deepEqual(Object.keys(context), RENDER_CONTEXT_KEYS);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(context.rendererConfig, input.rendererConfig);
  assert.equal(context.stepRendererConfig, input.stepRendererConfig);
  assert.notEqual(context.rendererConfig, context.stepRendererConfig);

  assert.throws(() => { context.stepId = 'other'; }, TypeError);
  assert.equal(context.stepId, 'step-01');
});

test('render context rejects missing, extra, symbol, and accessor input fields', () => {
  const missing = baseContext();
  delete missing.clock;
  assert.throws(() => createRendererContext(missing), /missing: clock/);

  assert.throws(() => createRendererContext({ ...baseContext(), runtime: {} }), /extra: runtime/);

  const symbolKey = baseContext();
  symbolKey[Symbol('authority')] = () => {};
  assert.throws(() => createRendererContext(symbolKey), /symbol keys/);

  let invoked = 0;
  const accessor = baseContext();
  Object.defineProperty(accessor, 'stepId', {
    enumerable: true,
    get() {
      invoked += 1;
      return 'step-01';
    }
  });
  assert.throws(() => createRendererContext(accessor), /data property/);
  assert.equal(invoked, 0);
});

test('absolute and animated predecessor rules are enforced', () => {
  const frozenPrior = Object.freeze({ node: 'A' });

  assert.throws(() => createRendererContext(baseContext({ fromState: frozenPrior, fromStepId: 'initial' })), /non-animated absolute/);
  assert.throws(() => createRendererContext(baseContext({ animate: true })), /requires both predecessor/);
  assert.throws(() => createRendererContext(baseContext({ animate: true, fromState: frozenPrior, fromStepId: null })), /both be present/);

  const animated = createRendererContext(baseContext({
    animate: true,
    fromState: frozenPrior,
    fromStepId: 'initial'
  }));
  assert.equal(animated.fromState, frozenPrior);
  assert.equal(animated.fromStepId, 'initial');
});

test('render context requires frozen experience references and exact frozen capability facades', () => {
  assert.throws(() => createRendererContext(baseContext({ rendererConfig: { scale: 1 } })), /rendererConfig must be frozen/);
  assert.throws(() => createRendererContext(baseContext({ stepRendererConfig: [] })), /plain object or null/);
  assert.throws(() => createRendererContext(baseContext({ fromState: { node: 'A' }, fromStepId: 'initial', animate: true })), /fromState object\/array values must be frozen/);

  assert.throws(() => createRendererContext(baseContext({ abortSignal: Object.freeze({ aborted: false, reason: null, onAbort() {}, extra: true }) })), /abortSignal must expose exactly/);
  assert.throws(() => createRendererContext(baseContext({ clock: Object.freeze({ now() {}, schedule() {}, cancel() {} }) })), /clock must expose exactly/);
});

test('renderer configs remain separate and null optional configs stay explicit', () => {
  const context = createRendererContext(baseContext({ rendererConfig: null, stepRendererConfig: null }));
  assert.equal(context.rendererConfig, null);
  assert.equal(context.stepRendererConfig, null);
  assert.equal(Object.keys(context).length, 10);
});
