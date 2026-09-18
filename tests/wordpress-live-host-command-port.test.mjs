import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import {
  WORDPRESS_COMMAND_PORT_KEYS,
  createWordPressLiveHost
} from '../src/host/wordpress-live-host.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'wordpress-command-port',
    renderer: 'synthetic/v1',
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

function clockFixture() {
  let nextHandle = 0;
  const timers = new Map();
  return Object.freeze({
    now: () => 0,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      timers.set(handle, { fn, ms });
      return handle;
    },
    cancel(handle) {
      return timers.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      timers.set(handle, { fn, frame: true });
      return handle;
    }
  });
}

function rootHarness() {
  const attributes = new Map([['data-cim-experience', 'wordpress-command-port']]);
  const rendererRoot = {};
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
  return { root, rendererRoot, state: () => attributes.get('data-cim-state') ?? null };
}

function mediaHarness() {
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

test('WordPress Host exposes only a frozen root-scoped command port after successful mount', async () => {
  const { root } = rootHarness();
  const renders = [];
  const renderer = Object.freeze({
    mount() {},
    render(state, context) {
      renders.push({ state, context });
      return Promise.resolve();
    },
    dispose() {}
  });

  const host = createWordPressLiveHost({
    document: { querySelectorAll: () => [root] },
    matchMedia: mediaHarness(),
    experienceLoader: Object.freeze({ load: async () => experienceFixture() }),
    rendererResolver: Object.freeze({ resolve: async () => renderer }),
    clockFactory: Object.freeze({ create: () => clockFixture() }),
    entryResolver: Object.freeze({ resolve: () => null }),
    diagnostics: Object.freeze({ report() {} })
  });

  assert.equal(host.commands(root), null);
  assert.equal(host.commands({}), null);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 0 });
  const commands = host.commands(root);

  assert.ok(commands);
  assert.equal(Object.isFrozen(commands), true);
  assert.deepEqual(Object.keys(commands), WORDPRESS_COMMAND_PORT_KEYS);
  assert.deepEqual(WORDPRESS_COMMAND_PORT_KEYS, [
    'play', 'pause', 'next', 'previous', 'seek', 'home', 'end', 'restart'
  ]);
  assert.equal('read' in commands, false);
  assert.equal('events' in commands, false);
  assert.equal('identity' in commands, false);
  assert.equal('dispose' in commands, false);

  const outcome = await commands.next('transport');
  assert.equal(outcome.result, 'success');
  assert.equal(outcome.toStepId, 'step-01');
  assert.equal(renders.length, 2);
  assert.equal(renders[1].state.node, 'B');
  assert.equal(renders[1].context.stepId, 'step-01');

  const dispose = host.dispose();
  assert.equal(host.commands(root), null);
  assert.equal(await dispose, true);
  assert.equal(host.commands(root), null);
});
