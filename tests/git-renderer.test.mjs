import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../src/renderers/interface.mjs';
import { createGitRenderer } from '../src/renderers/subjects/git/renderer.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from '../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../src/runtime/renderer-context.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = 'http://www.w3.org/1999/xhtml';
let transitionSequence = 0;

class FakeDocument {
  createElement(localName) {
    return new FakeElement(this, localName);
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
  constructor(ownerDocument, localName) {
    this.nodeType = 1;
    this.localName = localName;
    this.namespaceURI = HTML;
    this.attributes = [];
    this.childNodes = [];
    this.ownerDocument = ownerDocument;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    const existing = this.attributes.findIndex((attribute) => attribute.localName === name);
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

function attribute(node, name) {
  return node.attributes.find((entry) => entry.localName === name)?.value ?? null;
}

function createScheduler() {
  let sequence = 0;
  const frames = new Map();

  return {
    now() {
      return 0;
    },
    schedule() {
      throw new Error('Git renderer test does not use delayed scheduling.');
    },
    cancel(handle) {
      return frames.delete(handle);
    },
    onFrame(fn) {
      sequence += 1;
      const handle = 'frame-' + sequence;
      frames.set(handle, fn);
      return handle;
    },
    frame() {
      for (const fn of [...frames.values()]) fn(0);
    }
  };
}

async function experienceFixture() {
  const source = JSON.parse(await readFile(resolve(ROOT, 'experiences/git/git-basic-cycle.json'), 'utf8'));
  return freezeValidatedExperience(source);
}

function stateFor(experience, stepId) {
  if (stepId === 'initial') return experience.initial_state;
  return experience.steps.find((step) => step.id === stepId).state;
}

function configFor(experience, stepId) {
  if (stepId === 'initial') return null;
  return experience.steps.find((step) => step.id === stepId).renderer_config ?? null;
}

function transition(experience, { stepId, animate = false, fromStepId = null, reducedMotion = false }) {
  transitionSequence += 1;
  const transitionId = 'git-' + transitionSequence;
  const abort = createRendererAbortCapability();
  const scheduler = createScheduler();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const context = createRendererContext({
    animate,
    fromState: fromStepId === null ? null : stateFor(experience, fromStepId),
    fromStepId,
    stepId,
    rendererConfig: experience.renderer_config,
    stepRendererConfig: configFor(experience, stepId),
    transitionId,
    abortSignal: abort.facade,
    clock: clock.facade,
    reducedMotion
  });
  return { abort, scheduler, clock, context };
}

function mountedRenderer() {
  const document = new FakeDocument();
  const root = new FakeElement(document, 'div');
  const renderer = createGitRenderer();
  renderer.mount({ root });
  return { document, root, renderer };
}

async function settle(renderer, experience, options) {
  const item = transition(experience, options);
  const promise = renderer.render(stateFor(experience, options.stepId), item.context);
  if (options.animate && !options.reducedMotion) {
    item.scheduler.frame();
    item.scheduler.frame();
  }
  await promise;
  item.clock.controller.revoke();
  item.abort.controller.close();
}

test('R27 Git renderer exposes the four-place model and step focus', async () => {
  const experience = await experienceFixture();
  const { root, renderer } = mountedRenderer();
  await settle(renderer, experience, { stepId: 'step-03' });

  const section = root.childNodes[0];
  assert.equal(attribute(section, 'data-cim-renderer'), 'git/v1');
  assert.equal(attribute(section, 'data-step'), 'step-03');
  assert.equal(attribute(section, 'data-git-focus'), 'index');

  const lanes = section.childNodes.find((node) => attribute(node, 'data-role') === 'git-lanes');
  assert.ok(lanes);
  assert.deepEqual(
    lanes.childNodes.map((node) => attribute(node, 'data-git-lane')),
    ['working-tree', 'index', 'local', 'remote']
  );

  renderer.dispose();
});

test('R27 Git renderer settles animated and absolute arrival to identical evidence', async () => {
  const experience = await experienceFixture();

  const direct = mountedRenderer();
  await settle(direct.renderer, experience, { stepId: 'step-04' });
  const directEvidence = createDomSvgRenderEvidence(direct.root);

  const animated = mountedRenderer();
  await settle(animated.renderer, experience, { stepId: 'step-03' });
  await settle(animated.renderer, experience, {
    stepId: 'step-04',
    animate: true,
    fromStepId: 'step-03'
  });
  const animatedEvidence = createDomSvgRenderEvidence(animated.root);

  assert.equal(animatedEvidence.canonicalizer_id, directEvidence.canonicalizer_id);
  assert.equal(animatedEvidence.render_digest, directEvidence.render_digest);

  direct.renderer.dispose();
  animated.renderer.dispose();
});

test('R27 Git observation steps can share subject state while rendering different focus', async () => {
  const experience = await experienceFixture();
  assert.deepEqual(stateFor(experience, 'step-01'), stateFor(experience, 'step-02'));

  const status = mountedRenderer();
  await settle(status.renderer, experience, { stepId: 'step-01' });
  const statusOutput = status.root.childNodes[0];

  const diff = mountedRenderer();
  await settle(diff.renderer, experience, { stepId: 'step-02' });
  const diffOutput = diff.root.childNodes[0];

  assert.equal(attribute(statusOutput, 'data-git-focus'), 'overview');
  assert.equal(attribute(diffOutput, 'data-git-focus'), 'working-tree');

  status.renderer.dispose();
  diff.renderer.dispose();
});

test('R27 Git renderer abort preserves the last stable output', async () => {
  const experience = await experienceFixture();
  const { root, renderer } = mountedRenderer();
  await settle(renderer, experience, { stepId: 'step-03' });
  const before = createDomSvgRenderEvidence(root);

  const item = transition(experience, {
    stepId: 'step-04',
    animate: true,
    fromStepId: 'step-03'
  });
  const promise = renderer.render(stateFor(experience, 'step-04'), item.context);

  item.scheduler.frame();
  item.abort.controller.abort('navigation');

  await assert.rejects(
    promise,
    (error) => error instanceof RendererCancelledError && error.reason === 'navigation'
  );

  const after = createDomSvgRenderEvidence(root);
  assert.equal(after.render_digest, before.render_digest);

  item.clock.controller.revoke();
  item.abort.controller.close();
  renderer.dispose();
});
