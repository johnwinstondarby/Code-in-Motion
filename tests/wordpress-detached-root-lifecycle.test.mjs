import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createWordPressLiveHost } from '../src/host/wordpress-live-host.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'r10-wordpress-experience',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
      }
    ]
  });
}

function rootHarness(instanceId) {
  const attributes = new Map([
    ['data-cim-experience', 'r10-wordpress-experience'],
    ['data-cim-instance', instanceId]
  ]);
  const rendererRoot = { instanceId };
  const root = {
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    querySelector(selector) {
      assert.equal(selector, '[data-cim-renderer-root]');
      return rendererRoot;
    }
  };
  return {
    root,
    state: () => attributes.get('data-cim-state') ?? null
  };
}

function rendererHarness() {
  const renders = [];
  let disposeCalls = 0;
  return {
    renderer: Object.freeze({
      mount() {},
      render(state, context) {
        renders.push({ node: state.node, stepId: context.stepId });
        return Promise.resolve();
      },
      dispose() {
        disposeCalls += 1;
      }
    }),
    renders,
    disposeCalls: () => disposeCalls
  };
}

function clockFixture() {
  let nextHandle = 0;
  return Object.freeze({
    now: () => 0,
    schedule() {
      return ++nextHandle;
    },
    cancel() {
      return true;
    },
    onFrame() {
      return ++nextHandle;
    }
  });
}

function mediaHarness() {
  const listeners = new Set();
  let removeCalls = 0;
  return {
    matchMedia() {
      return {
        matches: false,
        addEventListener(_type, listener) {
          listeners.add(listener);
        },
        removeEventListener(_type, listener) {
          removeCalls += 1;
          listeners.delete(listener);
        }
      };
    },
    removeCalls: () => removeCalls
  };
}

const diagnostics = Object.freeze({ report() {} });

test('R10 disposeRoot revokes only one mounted root and is single-shot', async () => {
  const experience = experienceFixture();
  const first = rootHarness('r10-one');
  const second = rootHarness('r10-two');
  const renderers = [rendererHarness(), rendererHarness()];
  const media = mediaHarness();
  let rendererIndex = 0;

  const host = createWordPressLiveHost({
    document: { querySelectorAll: () => [first.root, second.root] },
    matchMedia: media.matchMedia,
    experienceLoader: Object.freeze({ load: async () => experience }),
    rendererResolver: Object.freeze({ resolve: async () => renderers[rendererIndex++].renderer }),
    clockFactory: Object.freeze({ create: () => clockFixture() }),
    diagnostics
  });

  assert.deepEqual(await host.mount(), { mounted: 2, fallback: 0 });
  const firstPort = host.commands(first.root);
  const secondPort = host.commands(second.root);
  assert.notEqual(firstPort, null);
  assert.notEqual(secondPort, null);

  const firstDispose = host.disposeRoot(first.root);
  assert.equal(host.disposeRoot(first.root), firstDispose);
  assert.equal(host.commands(first.root), null);
  assert.equal(host.commands(second.root), secondPort);
  assert.equal(first.state(), 'fallback');
  assert.equal(second.state(), 'ready');
  assert.equal(await firstDispose, true);
  assert.equal(renderers[0].disposeCalls(), 1);
  assert.equal(renderers[1].disposeCalls(), 0);

  const siblingNavigation = await secondPort.next('transport');
  assert.equal(siblingNavigation.result, 'success');
  assert.equal(siblingNavigation.toStepId, 'step-01');
  assert.deepEqual(renderers[1].renders.at(-1), { node: 'B', stepId: 'step-01' });

  assert.equal(await host.disposeRoot({}), false);

  assert.equal(await host.dispose(), true);
  assert.equal(renderers[0].disposeCalls(), 1);
  assert.equal(renderers[1].disposeCalls(), 1);
  assert.equal(second.state(), 'fallback');
  assert.equal(media.removeCalls(), 1);
});

test('R10 page disposal and root disposal share the same per-root terminal promise', async () => {
  const experience = experienceFixture();
  const root = rootHarness('r10-shared-dispose');
  const renderer = rendererHarness();
  const media = mediaHarness();

  const host = createWordPressLiveHost({
    document: { querySelectorAll: () => [root.root] },
    matchMedia: media.matchMedia,
    experienceLoader: Object.freeze({ load: async () => experience }),
    rendererResolver: Object.freeze({ resolve: async () => renderer.renderer }),
    clockFactory: Object.freeze({ create: () => clockFixture() }),
    diagnostics
  });

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 0 });
  const rootDispose = host.disposeRoot(root.root);
  const pageDispose = host.dispose();

  assert.equal(await rootDispose, true);
  assert.equal(await pageDispose, true);
  assert.equal(renderer.disposeCalls(), 1);
  assert.equal(media.removeCalls(), 1);
});
