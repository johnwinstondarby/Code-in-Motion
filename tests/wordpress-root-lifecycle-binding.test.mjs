import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORDPRESS_ROOT_LIFECYCLE_KEYS,
  WORDPRESS_ROOT_LIFECYCLE_OPTIONS_KEYS,
  createWordPressRootLifecycleBinding
} from '../wordpress/assets/root-lifecycle-binding.mjs';

function observerHarness() {
  let callback = null;
  let instance = null;
  const observeCalls = [];
  let disconnectCalls = 0;

  class MutationObserverHarness {
    constructor(fn) {
      callback = fn;
      instance = this;
    }

    observe(target, options) {
      observeCalls.push({ target, options });
    }

    disconnect() {
      disconnectCalls += 1;
    }
  }

  return {
    MutationObserver: MutationObserverHarness,
    trigger() {
      assert.notEqual(callback, null);
      callback([]);
    },
    instance: () => instance,
    observeCalls,
    disconnectCalls: () => disconnectCalls
  };
}

function root(connected = true) {
  return { isConnected: connected };
}

test('R10 root lifecycle binding is exact, frozen, and installs one subtree observer', () => {
  const observer = observerHarness();
  const observeTarget = {};
  const first = root();
  const second = root();
  const roots = Object.freeze([first, second]);
  const detached = [];
  const options = {
    MutationObserver: observer.MutationObserver,
    observeTarget,
    roots,
    onDetached: (value) => detached.push(value)
  };

  assert.deepEqual(Object.keys(options), WORDPRESS_ROOT_LIFECYCLE_OPTIONS_KEYS);
  const binding = createWordPressRootLifecycleBinding(options);

  assert.equal(Object.isFrozen(binding), true);
  assert.deepEqual(Object.keys(binding), WORDPRESS_ROOT_LIFECYCLE_KEYS);
  assert.equal(observer.instance() instanceof observer.MutationObserver, true);
  assert.equal(observer.observeCalls.length, 1);
  assert.equal(observer.observeCalls[0].target, observeTarget);
  assert.deepEqual(observer.observeCalls[0].options, { childList: true, subtree: true });
  assert.equal(Object.isFrozen(observer.observeCalls[0].options), true);
  assert.deepEqual(detached, []);

  assert.equal(binding.dispose(), null);
  assert.equal(binding.dispose(), null);
  assert.equal(observer.disconnectCalls(), 1);
});

test('R10 connected mutation and direct connected reparent do not detach a tracked root', () => {
  const observer = observerHarness();
  const first = root(true);
  const second = root(true);
  const detached = [];
  const binding = createWordPressRootLifecycleBinding({
    MutationObserver: observer.MutationObserver,
    observeTarget: {},
    roots: Object.freeze([first, second]),
    onDetached: (value) => detached.push(value)
  });

  observer.trigger();
  assert.deepEqual(detached, []);

  // A native appendChild() move between connected parents can generate removal and
  // insertion mutation records in one checkpoint while the moved root remains connected.
  first.isConnected = true;
  observer.trigger();
  assert.deepEqual(detached, []);

  binding.dispose();
});

test('R10 permanent disconnection detaches exactly one root and leaves its sibling tracked', () => {
  const observer = observerHarness();
  const first = root(true);
  const second = root(true);
  const detached = [];
  const binding = createWordPressRootLifecycleBinding({
    MutationObserver: observer.MutationObserver,
    observeTarget: {},
    roots: Object.freeze([first, second]),
    onDetached: (value) => detached.push(value)
  });

  first.isConnected = false;
  observer.trigger();
  assert.deepEqual(detached, [first]);

  observer.trigger();
  assert.deepEqual(detached, [first]);

  second.isConnected = false;
  observer.trigger();
  assert.deepEqual(detached, [first, second]);

  binding.dispose();
});

test('R10 disposal closes observation before later mutation delivery', () => {
  const observer = observerHarness();
  const first = root(true);
  const detached = [];
  const binding = createWordPressRootLifecycleBinding({
    MutationObserver: observer.MutationObserver,
    observeTarget: {},
    roots: Object.freeze([first]),
    onDetached: (value) => detached.push(value)
  });

  binding.dispose();
  first.isConnected = false;
  observer.trigger();
  assert.deepEqual(detached, []);
});

test('R10 lifecycle binding rejects widened or malformed authority', () => {
  const observer = observerHarness();
  const first = root(true);
  const valid = {
    MutationObserver: observer.MutationObserver,
    observeTarget: {},
    roots: Object.freeze([first]),
    onDetached() {}
  };

  assert.throws(() => createWordPressRootLifecycleBinding({ ...valid, extra: true }), /must contain exactly/);
  assert.throws(() => createWordPressRootLifecycleBinding({ ...valid, roots: [first] }), /roots must be a frozen array/);
  assert.throws(() => createWordPressRootLifecycleBinding({ ...valid, MutationObserver: null }), /constructor function/);
  assert.throws(() => createWordPressRootLifecycleBinding({ ...valid, onDetached: null }), /onDetached must be a function/);
  assert.throws(() => createWordPressRootLifecycleBinding({
    ...valid,
    roots: Object.freeze([{ isConnected: 'yes' }])
  }), /isConnected must be boolean/);
});
