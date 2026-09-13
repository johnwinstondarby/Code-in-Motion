import test from 'node:test';
import assert from 'node:assert/strict';

import { createDomSvgRenderEvidence } from '../../harness/canonicalize-dom-svg.mjs';
import { freezeValidatedExperience } from '../../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../../src/renderers/interface.mjs';
import { createSyntheticRenderer } from '../../src/renderers/subjects/synthetic/renderer.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from '../../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../../src/runtime/renderer-context.mjs';

const HTML = 'http://www.w3.org/1999/xhtml';
let transitionSequence = 0;

class FakeDocument {
  createElement(localName) {
    return new FakeElement(this, localName, HTML);
  }

  createTextNode(value) {
    return {
      nodeType: 3,
      nodeValue: String(value),
      childNodes: [],
      ownerDocument: this
    };
  }
}

class FakeElement {
  constructor(ownerDocument, localName, namespaceURI = HTML) {
    this.nodeType = 1;
    this.localName = localName;
    this.namespaceURI = namespaceURI;
    this.attributes = [];
    this.childNodes = [];
    this.ownerDocument = ownerDocument;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    const existing = this.attributes.findIndex((attribute) =>
      attribute.namespaceURI == null && attribute.localName === name
    );
    const record = { name, localName: name, namespaceURI: null, value: stringValue };
    if (existing >= 0) this.attributes[existing] = record;
    else this.attributes.push(record);
  }

  appendChild(node) {
    this.childNodes.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.childNodes = [...nodes];
  }
}

function createScheduler() {
  let now = 0;
  let sequence = 0;
  const delays = new Map();
  const frames = new Map();

  return {
    now() {
      return now;
    },

    schedule(fn, ms) {
      sequence += 1;
      const handle = `delay-${sequence}`;
      delays.set(handle, { fn, due: now + ms });
      return handle;
    },

    cancel(handle) {
      return delays.delete(handle) || frames.delete(handle);
    },

    onFrame(fn) {
      sequence += 1;
      const handle = `frame-${sequence}`;
      frames.set(handle, fn);
      return handle;
    },

    advance(ms) {
      now += ms;
      for (const [handle, entry] of [...delays]) {
        if (entry.due <= now) {
          delays.delete(handle);
          entry.fn(now);
        }
      }
    },

    frame() {
      now += 16;
      for (const fn of [...frames.values()]) fn(now);
    },

    activeFrames() {
      return frames.size;
    }
  };
}

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'synthetic-absolute-state',
    renderer: 'synthetic/v1',
    renderer_config: { prefix: '[' },
    initial_state: { node: 'I', detail: 'initial' },
    steps: [
      {
        id: 'step-01',
        label: 'A',
        commentary: { text: 'A', links: [] },
        state: { node: 'A', detail: 'prior' },
        renderer_config: { suffix: ')' }
      },
      {
        id: 'step-02',
        label: 'B',
        commentary: { text: 'B', links: [] },
        state: { node: 'B', detail: 'target' },
        renderer_config: { suffix: ']' }
      },
      {
        id: 'step-03',
        label: 'C',
        commentary: { text: 'C', links: [] },
        state: { node: 'C', detail: 'later' },
        renderer_config: { suffix: '}' }
      }
    ]
  });
}

function stateFor(experience, stepId) {
  if (stepId === 'initial') return experience.initial_state;
  return experience.steps.find((step) => step.id === stepId).state;
}

function stepConfigFor(experience, stepId) {
  if (stepId === 'initial') return null;
  return experience.steps.find((step) => step.id === stepId).renderer_config ?? null;
}

function createTransition(experience, {
  stepId,
  animate = false,
  fromStepId = null,
  reducedMotion = false
}) {
  transitionSequence += 1;
  const transitionId = `synthetic-${transitionSequence}`;
  const abort = createRendererAbortCapability();
  const scheduler = createScheduler();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const fromState = fromStepId === null ? null : stateFor(experience, fromStepId);

  const context = createRendererContext({
    animate,
    fromState,
    fromStepId,
    stepId,
    rendererConfig: experience.renderer_config ?? null,
    stepRendererConfig: stepConfigFor(experience, stepId),
    transitionId,
    abortSignal: abort.facade,
    clock: clock.facade,
    reducedMotion
  });

  return { abort, scheduler, clock, context };
}

async function settle(renderer, experience, options) {
  const transition = createTransition(experience, options);
  const promise = renderer.render(stateFor(experience, options.stepId), transition.context);

  if (options.animate && !options.reducedMotion) {
    transition.scheduler.frame();
    transition.scheduler.frame();
  }

  await promise;
  transition.clock.controller.revoke();
  transition.abort.controller.close();
  return transition;
}

function mountedRenderer() {
  const document = new FakeDocument();
  const root = new FakeElement(document, 'div');
  const renderer = createSyntheticRenderer();
  renderer.mount({ root, instanceId: 'fixture-instance' });
  return { renderer, root, document };
}

async function evidenceForPath(path) {
  const experience = experienceFixture();
  const { renderer, root, document } = mountedRenderer();

  if (path === 'sequential-animated' || path === 'replay-equivalent') {
    await settle(renderer, experience, { stepId: 'step-01' });
    await settle(renderer, experience, {
      stepId: 'step-02',
      animate: true,
      fromStepId: 'step-01'
    });
  } else if (path === 'direct-seek') {
    await settle(renderer, experience, { stepId: 'step-02' });
  } else if (path === 'reverse-absolute') {
    await settle(renderer, experience, { stepId: 'step-03' });
    await settle(renderer, experience, { stepId: 'step-02' });
  } else if (path === 'restart-then-seek') {
    await settle(renderer, experience, { stepId: 'initial' });
    await settle(renderer, experience, { stepId: 'step-02' });
  } else if (path === 'recovery-restoration') {
    await settle(renderer, experience, { stepId: 'step-03' });
    root.replaceChildren(document.createElement('garbage'));
    await settle(renderer, experience, { stepId: 'step-02' });
  } else if (path === 'reduced-motion') {
    await settle(renderer, experience, { stepId: 'step-01' });
    await settle(renderer, experience, {
      stepId: 'step-02',
      animate: true,
      fromStepId: 'step-01',
      reducedMotion: true
    });
  } else {
    throw new Error(`unknown path ${path}`);
  }

  const evidence = createDomSvgRenderEvidence(root);
  renderer.dispose();
  return { evidence, root };
}

test('[RC-A01] seven arrival paths settle to identical canonical evidence', async () => {
  const paths = [
    'sequential-animated',
    'direct-seek',
    'reverse-absolute',
    'restart-then-seek',
    'recovery-restoration',
    'reduced-motion',
    'replay-equivalent'
  ];

  const results = [];
  for (const path of paths) results.push([path, await evidenceForPath(path)]);

  const baseline = results[0][1].evidence;
  for (const [path, result] of results.slice(1)) {
    assert.equal(result.evidence.canonicalizer_id, baseline.canonicalizer_id, path);
    assert.equal(result.evidence.render_digest, baseline.render_digest, path);
  }

  assert.equal(baseline.canonicalizer_id, 'cim-dom-svg/v1');
});

test('[RC-A02] animated settlement waits for the virtual frame loop', async () => {
  const experience = experienceFixture();
  const { renderer } = mountedRenderer();
  await settle(renderer, experience, { stepId: 'step-01' });

  const transition = createTransition(experience, {
    stepId: 'step-02',
    animate: true,
    fromStepId: 'step-01'
  });

  let settled = false;
  const promise = renderer.render(experience.steps[1].state, transition.context).then(() => {
    settled = true;
  });

  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(transition.scheduler.activeFrames(), 1);

  transition.scheduler.frame();
  await Promise.resolve();
  assert.equal(settled, false);

  transition.scheduler.frame();
  await promise;
  assert.equal(settled, true);
  assert.equal(transition.scheduler.activeFrames(), 0);

  transition.clock.controller.revoke();
  transition.abort.controller.close();
  renderer.dispose();
});

test('[RC-A03] canonical evidence detects a path-dependent stable-output leak', async () => {
  const direct = await evidenceForPath('direct-seek');
  const leaked = await evidenceForPath('direct-seek');

  leaked.root.childNodes[0].setAttribute('data-arrival-path', 'direct');
  const leakedEvidence = createDomSvgRenderEvidence(leaked.root);

  assert.notEqual(leakedEvidence.render_digest, direct.evidence.render_digest);
});

test('[RC-A04] abort during animation rejects distinctly and preserves the last stable output', async () => {
  const experience = experienceFixture();
  const { renderer, root } = mountedRenderer();
  await settle(renderer, experience, { stepId: 'step-01' });
  const before = createDomSvgRenderEvidence(root);

  const transition = createTransition(experience, {
    stepId: 'step-02',
    animate: true,
    fromStepId: 'step-01'
  });
  const promise = renderer.render(experience.steps[1].state, transition.context);

  transition.scheduler.frame();
  transition.abort.controller.abort('navigation');

  await assert.rejects(
    promise,
    (error) => error instanceof RendererCancelledError && error.reason === 'navigation'
  );

  const after = createDomSvgRenderEvidence(root);
  assert.equal(after.render_digest, before.render_digest);

  transition.clock.controller.revoke();
  transition.abort.controller.close();
  renderer.dispose();
});
