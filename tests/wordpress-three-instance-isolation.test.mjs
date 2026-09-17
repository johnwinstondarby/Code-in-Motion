import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createLiveHostCiMInstance } from '../src/host/cim-instance.mjs';
import { createWordPressLiveHost } from '../src/host/wordpress-live-host.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'shared-wordpress-experience',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
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

function rootHarness(instanceId) {
  const attributes = new Map([
    ['data-cim-experience', 'shared-wordpress-experience'],
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
    rendererRoot,
    state: () => attributes.get('data-cim-state') ?? null
  };
}

function rendererHarness() {
  const renders = [];
  let mountCount = 0;
  let disposeCount = 0;
  const renderer = Object.freeze({
    mount() {
      mountCount += 1;
    },
    render(state, context) {
      renders.push(Object.freeze({ node: state.node, stepId: context.stepId }));
      return Promise.resolve();
    },
    dispose() {
      disposeCount += 1;
    }
  });
  return {
    renderer,
    renders,
    mountCount: () => mountCount,
    disposeCount: () => disposeCount
  };
}

function clockFixture(identity) {
  let nextHandle = 0;
  const active = new Set();
  return Object.freeze({
    identity,
    now: () => identity,
    schedule() {
      const handle = `${identity}:timer:${++nextHandle}`;
      active.add(handle);
      return handle;
    },
    cancel(handle) {
      return active.delete(handle);
    },
    onFrame() {
      const handle = `${identity}:frame:${++nextHandle}`;
      active.add(handle);
      return handle;
    }
  });
}

function matchMediaHarness() {
  const listeners = new Set();
  const list = {
    matches: false,
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.delete(listener);
    }
  };
  return () => list;
}

function reducedMotionCapabilities() {
  const preference = Object.freeze({ read: () => false });
  const changes = Object.freeze({
    subscribe() {
      const unsubscribe = () => undefined;
      return Object.freeze(unsubscribe);
    }
  });
  return { preference, changes };
}

const diagnostics = Object.freeze({ report() {} });

test('R9 WordPress page host composes three isolated instances over one shared Experience', async () => {
  const experience = experienceFixture();
  const roots = ['instance-one', 'instance-two', 'instance-three'].map(rootHarness);
  const loaded = [];
  const renderers = [];
  const clocks = [];

  const host = createWordPressLiveHost({
    document: { querySelectorAll: () => roots.map((entry) => entry.root) },
    matchMedia: matchMediaHarness(),
    experienceLoader: Object.freeze({
      load: async () => {
        loaded.push(experience);
        return experience;
      }
    }),
    rendererResolver: Object.freeze({
      resolve: async () => {
        const entry = rendererHarness();
        renderers.push(entry);
        return entry.renderer;
      }
    }),
    clockFactory: Object.freeze({
      create: () => {
        const clock = clockFixture(clocks.length + 1);
        clocks.push(clock);
        return clock;
      }
    }),
    diagnostics
  });

  assert.deepEqual(await host.mount(), { mounted: 3, fallback: 0 });
  assert.equal(loaded.length, 3);
  assert.equal(loaded.every((value) => value === experience), true);
  assert.equal(Object.isFrozen(experience), true);

  assert.equal(renderers.length, 3);
  assert.equal(new Set(renderers.map((entry) => entry.renderer)).size, 3);
  assert.equal(renderers.every((entry) => entry.mountCount() === 1), true);

  assert.equal(clocks.length, 3);
  assert.equal(new Set(clocks).size, 3);
  assert.equal(new Set(clocks.map((clock) => clock.identity)).size, 3);

  const ports = roots.map((entry) => host.commands(entry.root));
  assert.equal(ports.every((port) => port !== null && Object.isFrozen(port)), true);
  assert.equal(new Set(ports).size, 3);
  assert.deepEqual(roots.map((entry) => entry.state()), ['ready', 'ready', 'ready']);
  assert.deepEqual(renderers.map((entry) => entry.renders), [
    [{ node: 'A', stepId: 'initial' }],
    [{ node: 'A', stepId: 'initial' }],
    [{ node: 'A', stepId: 'initial' }]
  ]);

  const secondNext = await ports[1].next('transport');
  assert.equal(secondNext.result, 'success');
  assert.equal(secondNext.toStepId, 'step-01');
  assert.deepEqual(renderers[0].renders, [{ node: 'A', stepId: 'initial' }]);
  assert.deepEqual(renderers[1].renders, [
    { node: 'A', stepId: 'initial' },
    { node: 'B', stepId: 'step-01' }
  ]);
  assert.deepEqual(renderers[2].renders, [{ node: 'A', stepId: 'initial' }]);

  const firstEnd = await ports[0].end('transport');
  assert.equal(firstEnd.result, 'success');
  assert.equal(firstEnd.toStepId, 'step-02');
  assert.deepEqual(renderers[0].renders.at(-1), { node: 'C', stepId: 'step-02' });
  assert.deepEqual(renderers[1].renders.at(-1), { node: 'B', stepId: 'step-01' });
  assert.deepEqual(renderers[2].renders.at(-1), { node: 'A', stepId: 'initial' });

  assert.equal(await host.dispose(), true);
  assert.deepEqual(roots.map((entry) => entry.state()), ['fallback', 'fallback', 'fallback']);
  assert.equal(renderers.every((entry) => entry.disposeCount() === 1), true);
  assert.equal(roots.every((entry) => host.commands(entry.root) === null), true);
});

test('R9 one live Host facade can dispose without altering sibling live facades', async () => {
  const experience = experienceFixture();
  const reducedMotion = reducedMotionCapabilities();
  const renderers = [rendererHarness(), rendererHarness(), rendererHarness()];

  const instances = await Promise.all(renderers.map((entry, index) => createLiveHostCiMInstance({
    instanceId: `live-${index + 1}`,
    experience,
    clock: clockFixture(index + 1),
    renderer: entry.renderer,
    rendererRoot: { index },
    reducedMotionPreference: reducedMotion.preference,
    reducedMotionChanges: reducedMotion.changes,
    diagnostics
  })));

  await Promise.all(instances.map((instance) => instance.initialize()));
  await instances[0].dispose();

  assert.equal(renderers[0].disposeCount(), 1);
  assert.equal(renderers[1].disposeCount(), 0);
  assert.equal(renderers[2].disposeCount(), 0);

  const secondNext = await instances[1].next('transport');
  const thirdEnd = await instances[2].end('transport');
  assert.equal(secondNext.result, 'success');
  assert.equal(secondNext.toStepId, 'step-01');
  assert.equal(thirdEnd.result, 'success');
  assert.equal(thirdEnd.toStepId, 'step-02');

  await Promise.all([instances[1].dispose(), instances[2].dispose()]);
  assert.deepEqual(renderers.map((entry) => entry.disposeCount()), [1, 1, 1]);
});
