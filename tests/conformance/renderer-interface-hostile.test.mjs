import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RENDER_CONTEXT_KEYS,
  RendererCancelledError
} from '../../src/renderers/interface.mjs';
import {
  RendererCapabilityViolationError,
  assertRendererContextCapabilities
} from '../../src/renderers/capability-inspector.mjs';
import { freezeValidatedExperience } from '../../src/experience/freeze-validated-experience.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from '../../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../../src/runtime/renderer-context.mjs';
import { classifyRendererRejection } from '../../src/runtime/renderer-outcome.mjs';
import {
  canonicalizeDomSvg,
  createDomSvgRenderEvidence
} from '../../harness/canonicalize-dom-svg.mjs';

const HTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';

function attr(name, value, { namespaceURI = null, localName = name } = {}) {
  return { name, localName, namespaceURI, value };
}

function element(localName, { namespaceURI = HTML, attributes = [], children = [] } = {}) {
  return { nodeType: 1, localName, namespaceURI, attributes, childNodes: children };
}

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

function createScheduler() {
  let now = 0;
  let sequence = 0;
  const delays = new Map();
  const frames = new Map();
  const history = [];

  return {
    now() {
      return now;
    },

    setNow(value) {
      now = value;
    },

    schedule(fn, ms) {
      sequence += 1;
      const handle = `delay-${sequence}`;
      delays.set(handle, { fn, due: now + ms });
      history.push({ kind: 'delay', handle, fn });
      return handle;
    },

    cancel(handle) {
      return delays.delete(handle) || frames.delete(handle);
    },

    onFrame(fn) {
      sequence += 1;
      const handle = `frame-${sequence}`;
      frames.set(handle, fn);
      history.push({ kind: 'frame', handle, fn });
      return handle;
    },

    advance(ms) {
      now += ms;
      for (const [handle, entry] of [...delays]) {
        if (entry.due <= now) {
          delays.delete(handle);
          entry.fn(999999);
        }
      }
    },

    frame() {
      for (const fn of [...frames.values()]) fn(888888);
    },

    history
  };
}

function frozenExperience() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'hostile-fixture',
    renderer: 'synthetic/v1',
    renderer_config: { theme: 'instrument' },
    initial_state: { node: 'A' },
    steps: [{
      id: 'step-01',
      label: 'Step 1',
      commentary: { text: 'One', links: [] },
      state: { node: 'B' },
      renderer_config: { emphasis: 'high' }
    }]
  });
}

function contextFixture(overrides = {}) {
  const experience = frozenExperience();
  const abort = createRendererAbortCapability();
  const scheduler = createScheduler();
  const clock = createRendererClockCapability({ transitionId: 't-1', scheduler });
  const input = {
    animate: false,
    fromState: null,
    fromStepId: null,
    stepId: 'step-01',
    rendererConfig: experience.renderer_config,
    stepRendererConfig: experience.steps[0].renderer_config,
    transitionId: 't-1',
    abortSignal: abort.facade,
    clock: clock.facade,
    reducedMotion: false,
    ...overrides
  };

  return {
    experience,
    input,
    abort,
    clock,
    scheduler,
    context: () => createRendererContext(input)
  };
}

test('[RC-H01] exact renderer context rejects one extra authority-bearing field', () => {
  const fixture = contextFixture({ runtime: Object.freeze({}) });
  assert.throws(() => fixture.context(), /extra: runtime/);

  const clean = contextFixture().context();
  assert.deepEqual(Object.keys(clean), RENDER_CONTEXT_KEYS);
  assert.equal(Object.isFrozen(clean), true);
});

test('[RC-H02] nested function authority fails even under frozen plain data', () => {
  const rendererConfig = Object.freeze({
    view: Object.freeze({
      mode: 'compact',
      refreshPreview() {}
    })
  });

  assert.throws(
    () => contextFixture({ rendererConfig }).context(),
    /reachable function capability is outside the renderer allowlist/
  );
});

test('[RC-H03] prototype methods and getters are detected without invoking getters', () => {
  class InnocentBox {
    refreshPreview() {}
  }

  const classValue = Object.freeze(new InnocentBox());
  const raw = contextFixture().context();
  const hostile = Object.freeze({ ...raw, rendererConfig: classValue });
  assert.throws(
    () => assertRendererContextCapabilities(hostile),
    (error) => error instanceof RendererCapabilityViolationError && /refreshPreview/.test(error.path)
  );

  let invoked = 0;
  const getterValue = {};
  Object.defineProperty(getterValue, 'preview', {
    enumerable: true,
    get() {
      invoked += 1;
      return () => 'authority';
    }
  });
  Object.freeze(getterValue);

  assert.throws(() => contextFixture({ rendererConfig: getterValue }).context(), /accessor properties are prohibited/);
  assert.equal(invoked, 0);
});

test('[RC-H04] renderer inputs remain unchanged after mutation attempts', () => {
  const fixture = contextFixture();
  const context = fixture.context();
  const before = JSON.stringify(fixture.experience);

  assert.throws(() => { context.stepId = 'step-evil'; }, TypeError);
  assert.throws(() => { context.rendererConfig.theme = 'mutated'; }, TypeError);
  assert.throws(() => { fixture.experience.steps[0].state.node = 'mutated'; }, TypeError);
  assert.throws(() => { fixture.experience.steps[0].commentary.text = 'mutated'; }, TypeError);

  assert.equal(JSON.stringify(fixture.experience), before);
  assert.equal(context.stepId, 'step-01');
  assert.equal(context.rendererConfig.theme, 'instrument');
});

test('[RC-H05] abort authority remains Runtime-owned and read-only to the renderer', () => {
  const fixture = contextFixture();
  const context = fixture.context();

  assert.equal('abort' in context.abortSignal, false);
  assert.equal('dispatchEvent' in context.abortSignal, false);
  assert.throws(() => { context.abortSignal.aborted = true; }, TypeError);
  assert.equal(context.abortSignal.aborted, false);

  fixture.abort.controller.abort('navigation');
  assert.equal(context.abortSignal.aborted, true);
  assert.equal(context.abortSignal.reason, 'navigation');
});

test('[RC-H06] expected cancellation requires both Runtime abort and matching distinguished outcome', () => {
  const fixture = contextFixture();
  const context = fixture.context();
  const cancellation = new RendererCancelledError('navigation');

  assert.equal(
    classifyRendererRejection(cancellation, { abortSignal: context.abortSignal, transitionId: context.transitionId }).kind,
    'error',
    'renderer cannot declare cancellation before Runtime aborts'
  );

  fixture.abort.controller.abort('navigation');
  const accepted = classifyRendererRejection(cancellation, {
    abortSignal: context.abortSignal,
    transitionId: context.transitionId
  });
  assert.deepEqual(accepted, {
    kind: 'cancelled',
    transitionId: 't-1',
    reason: 'navigation'
  });
  assert.equal(Object.isFrozen(accepted), true);

  assert.equal(
    classifyRendererRejection(new RendererCancelledError('other'), {
      abortSignal: context.abortSignal,
      transitionId: context.transitionId
    }).kind,
    'error',
    'reason mismatch fails closed'
  );

  assert.equal(
    classifyRendererRejection(new Error('renderer fault'), {
      abortSignal: context.abortSignal,
      transitionId: context.transitionId
    }).kind,
    'error',
    'ordinary renderer failures remain failures after abort'
  );
});

test('[RC-H07] revoked clock makes stale delayed and frame callbacks inert', () => {
  const fixture = contextFixture();
  const context = fixture.context();
  let mutations = 0;

  context.clock.schedule(() => { mutations += 1; }, 25);
  context.clock.onFrame(() => { mutations += 10; });

  const staleDelay = fixture.scheduler.history.find((entry) => entry.kind === 'delay').fn;
  const staleFrame = fixture.scheduler.history.find((entry) => entry.kind === 'frame').fn;

  fixture.clock.controller.revoke();
  staleDelay(12345);
  staleFrame(12345);

  assert.equal(mutations, 0);
  assert.throws(() => context.clock.schedule(() => {}, 0), /revoked/);
  assert.throws(() => context.clock.onFrame(() => {}), /revoked/);
});

test('[RC-H08] renderer timing callbacks receive only virtual CiM time', () => {
  const fixture = contextFixture();
  const context = fixture.context();
  const seen = [];

  context.clock.schedule((at) => seen.push(['delay', at]), 5);
  context.clock.onFrame((at) => seen.push(['frame', at]));

  fixture.scheduler.setNow(5);
  fixture.scheduler.advance(0);
  fixture.scheduler.frame();

  assert.deepEqual(seen, [['delay', 5], ['frame', 5]]);
});

test('[RC-H09] experience and step renderer configuration remain separate references', () => {
  const fixture = contextFixture();
  const context = fixture.context();

  assert.equal(context.rendererConfig, fixture.experience.renderer_config);
  assert.equal(context.stepRendererConfig, fixture.experience.steps[0].renderer_config);
  assert.notEqual(context.rendererConfig, context.stepRendererConfig);
  assert.deepEqual(context.rendererConfig, { theme: 'instrument' });
  assert.deepEqual(context.stepRendererConfig, { emphasis: 'high' });
});

test('[RC-H10] canonicalization normalizes only documented representation noise', () => {
  const left = element('div', {
    attributes: [attr('class', 'panel'), attr('aria-live', 'polite')],
    children: [text('alpha\r\nbeta')]
  });
  const equivalent = element('div', {
    attributes: [attr('aria-live', 'polite'), attr('class', 'panel')],
    children: [text('alpha\nbeta')]
  });
  const semanticChange = element('div', {
    attributes: [attr('aria-live', 'off'), attr('class', 'panel')],
    children: [text('alpha\nbeta')]
  });

  assert.equal(canonicalizeDomSvg(left), canonicalizeDomSvg(equivalent));
  assert.notEqual(canonicalizeDomSvg(left), canonicalizeDomSvg(semanticChange));
});

test('[RC-H11] generated identifiers normalize only when explicitly declared', () => {
  const declared = (id) => element('svg', {
    namespaceURI: SVG,
    children: [element('g', {
      namespaceURI: SVG,
      attributes: [attr('id', id), attr('data-cim-generated-id', 'stable-node')]
    })]
  });
  const unmarked = (id) => element('svg', {
    namespaceURI: SVG,
    children: [element('g', { namespaceURI: SVG, attributes: [attr('id', id)] })]
  });

  assert.equal(canonicalizeDomSvg(declared('runtime-a')), canonicalizeDomSvg(declared('runtime-b')));
  assert.notEqual(canonicalizeDomSvg(unmarked('runtime-a')), canonicalizeDomSvg(unmarked('runtime-b')));
});

test('[RC-H12] render evidence is versioned and unsupported output fails closed', () => {
  const root = element('div', { attributes: [attr('data-state', 'A')] });
  const evidence = createDomSvgRenderEvidence(root);

  assert.deepEqual(Object.keys(evidence), ['render_digest', 'canonicalizer_id']);
  assert.equal(evidence.canonicalizer_id, 'cim-dom-svg/v1');
  assert.match(evidence.render_digest, /^sha256:[0-9a-f]{64}$/);

  const unsupported = element('div', { children: [{ nodeType: 11, childNodes: [] }] });
  assert.throws(() => createDomSvgRenderEvidence(unsupported), /unsupported DOM nodeType 11/);
});
