import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import {
  WORDPRESS_LIVE_HOST_KEYS,
  WORDPRESS_OBSERVATION_PORT_KEYS,
  createWordPressLiveHost
} from '../src/host/wordpress-live-host.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'wordpress-observation-port',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [{
      id: 'step-01',
      label: 'One',
      commentary: { text: 'One', links: [] },
      state: { node: 'B' }
    }]
  });
}

function clockFixture() {
  return Object.freeze({
    now: () => 0,
    schedule: () => 1,
    cancel: () => true,
    onFrame: () => 2
  });
}

function mediaFixture() {
  return {
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  };
}

function rootFixture() {
  const attributes = new Map([['data-cim-experience', 'wordpress-observation-port']]);
  const rendererRoot = {};
  return {
    root: {
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
    },
    rendererRoot,
    state: () => attributes.get('data-cim-state') ?? null
  };
}

function rendererFixture() {
  return Object.freeze({
    mount() {},
    render() {
      return Promise.resolve();
    },
    dispose() {}
  });
}

function diagnosticsFixture() {
  return Object.freeze({ report() {} });
}

test('R36 WordPress Host exposes a root-scoped frozen observation port only while mounted', async () => {
  const root = rootFixture();
  const host = createWordPressLiveHost({
    document: {
      querySelectorAll(selector) {
        assert.equal(selector, '[data-cim-experience]');
        return [root.root];
      }
    },
    matchMedia() {
      return mediaFixture();
    },
    experienceLoader: Object.freeze({
      load: async () => experienceFixture()
    }),
    rendererResolver: Object.freeze({
      resolve: async () => rendererFixture()
    }),
    clockFactory: Object.freeze({
      create: () => clockFixture()
    }),
    entryResolver: Object.freeze({
      resolve: () => null
    }),
    diagnostics: diagnosticsFixture()
  });

  assert.deepEqual(Object.keys(host), WORDPRESS_LIVE_HOST_KEYS);
  assert.equal(host.observations(root.root), null);
  assert.equal(host.observations({}), null);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 0 });
  assert.equal(root.state(), 'ready');

  const observation = host.observations(root.root);
  assert.notEqual(observation, null);
  assert.equal(Object.isFrozen(observation), true);
  assert.deepEqual(Object.keys(observation), WORDPRESS_OBSERVATION_PORT_KEYS);

  let snapshot = observation.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.operational.playbackIntent, false);

  const commands = host.commands(root.root);
  assert.notEqual(commands, null);
  const next = await commands.next('transport');
  assert.equal(next.result, 'success');

  snapshot = observation.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-01');

  assert.equal(await host.disposeRoot(root.root), true);
  assert.equal(host.commands(root.root), null);
  assert.equal(host.observations(root.root), null);
  assert.equal(root.state(), 'fallback');
});
