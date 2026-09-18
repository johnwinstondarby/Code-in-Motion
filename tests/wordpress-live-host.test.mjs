import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import {
  WORDPRESS_CLOCK_FACTORY_KEYS,
  WORDPRESS_ENTRY_RESOLVER_KEYS,
  WORDPRESS_EXPERIENCE_LOADER_KEYS,
  WORDPRESS_LIVE_HOST_KEYS,
  WORDPRESS_LIVE_HOST_OPTIONS_KEYS,
  WORDPRESS_MOUNT_RESULT_KEYS,
  WORDPRESS_RENDERER_RESOLVER_KEYS,
  createWordPressLiveHost
} from '../src/host/wordpress-live-host.mjs';

function experienceFixture(id = 'wordpress-host-experience') {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id,
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

function clockFixture() {
  let now = 0;
  let nextHandle = 0;
  const timers = new Map();
  return Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      timers.set(handle, { at: now + ms, fn });
      return handle;
    },
    cancel(handle) {
      return timers.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      timers.set(handle, { at: Number.POSITIVE_INFINITY, fn });
      return handle;
    }
  });
}

function rendererFixture({ renderError = null, disposeError = null } = {}) {
  const contexts = [];
  let mountCalls = 0;
  let disposeCalls = 0;
  const renderer = Object.freeze({
    mount() {
      mountCalls += 1;
    },
    render(_state, context) {
      contexts.push(context);
      if (renderError !== null) return Promise.reject(renderError);
      return Promise.resolve();
    },
    dispose() {
      disposeCalls += 1;
      if (disposeError !== null) return Promise.reject(disposeError);
    }
  });
  return {
    renderer,
    contexts,
    mountCalls: () => mountCalls,
    disposeCalls: () => disposeCalls
  };
}

function mediaHarness({ initial = false, queryError = null, removeError = null } = {}) {
  let matches = initial;
  let queryCalls = 0;
  let addCalls = 0;
  let removeCalls = 0;
  const listeners = new Set();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      addCalls += 1;
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change');
      removeCalls += 1;
      if (removeError !== null) throw removeError;
      listeners.delete(listener);
    }
  };

  return {
    matchMedia(query) {
      queryCalls += 1;
      if (queryError !== null) throw queryError;
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return mediaQueryList;
    },
    setMatches(value) {
      matches = value;
    },
    emit() {
      for (const listener of [...listeners]) listener({ type: 'change' });
    },
    queryCalls: () => queryCalls,
    addCalls: () => addCalls,
    removeCalls: () => removeCalls,
    listenerCount: () => listeners.size
  };
}

function rootHarness({
  experienceId = 'wordpress-host-experience',
  instanceId = null,
  rendererRoot = {},
  failReadyOnce = false
} = {}) {
  const attributes = new Map();
  if (experienceId !== null) attributes.set('data-cim-experience', experienceId);
  if (instanceId !== null) attributes.set('data-cim-instance', instanceId);
  const writes = [];
  let readyFailurePending = failReadyOnce;

  const root = {
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      writes.push([name, String(value)]);
      if (name === 'data-cim-state' && value === 'ready' && readyFailurePending) {
        readyFailurePending = false;
        throw new Error('ready projection failed');
      }
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
    state: () => attributes.get('data-cim-state') ?? null,
    writes
  };
}

function documentHarness(roots, { queryError = null } = {}) {
  let queryCalls = 0;
  return {
    document: {
      querySelectorAll(selector) {
        queryCalls += 1;
        assert.equal(selector, '[data-cim-experience]');
        if (queryError !== null) throw queryError;
        return roots;
      }
    },
    queryCalls: () => queryCalls
  };
}

function diagnosticsHarness({ throwOnReport = false } = {}) {
  const records = [];
  return {
    diagnostics: Object.freeze({
      report(record) {
        records.push(record);
        if (throwOnReport) throw new Error('diagnostic sink failed');
      }
    }),
    records
  };
}

function capabilityHarness({
  load,
  resolve,
  create = () => clockFixture(),
  resolveEntry = () => null
}) {
  return {
    experienceLoader: Object.freeze({ load }),
    rendererResolver: Object.freeze({ resolve }),
    clockFactory: Object.freeze({ create }),
    entryResolver: Object.freeze({ resolve: resolveEntry })
  };
}

function hostOptions({
  roots = [rootHarness().root],
  media = mediaHarness(),
  diagnostics = diagnosticsHarness(),
  load = async (id) => experienceFixture(id),
  resolve = async () => rendererFixture().renderer,
  create = () => clockFixture(),
  resolveEntry = () => null,
  document = documentHarness(roots).document
} = {}) {
  const capabilities = capabilityHarness({ load, resolve, create, resolveEntry });
  return {
    options: {
      document,
      matchMedia: media.matchMedia,
      experienceLoader: capabilities.experienceLoader,
      rendererResolver: capabilities.rendererResolver,
      clockFactory: capabilities.clockFactory,
      entryResolver: capabilities.entryResolver,
      diagnostics: diagnostics.diagnostics
    },
    media,
    diagnostics,
    ...capabilities
  };
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

test('WordPress live Host surface and dependency capability contracts are exact and frozen', async () => {
  const root = rootHarness({ instanceId: 'wp-one' });
  const recording = rendererFixture();
  const source = hostOptions({
    roots: [root.root],
    resolve: async () => recording.renderer
  });

  assert.deepEqual(Object.keys(source.options), WORDPRESS_LIVE_HOST_OPTIONS_KEYS);
  assert.deepEqual(Object.keys(source.experienceLoader), WORDPRESS_EXPERIENCE_LOADER_KEYS);
  assert.deepEqual(Object.keys(source.rendererResolver), WORDPRESS_RENDERER_RESOLVER_KEYS);
  assert.deepEqual(Object.keys(source.clockFactory), WORDPRESS_CLOCK_FACTORY_KEYS);
  assert.deepEqual(Object.keys(source.entryResolver), WORDPRESS_ENTRY_RESOLVER_KEYS);

  const host = createWordPressLiveHost(source.options);
  assert.equal(Object.isFrozen(host), true);
  assert.deepEqual(Object.keys(host), WORDPRESS_LIVE_HOST_KEYS);

  const firstMount = host.mount();
  assert.equal(host.mount(), firstMount);
  const result = await firstMount;
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result), WORDPRESS_MOUNT_RESULT_KEYS);
  assert.deepEqual(result, { mounted: 1, fallback: 0 });
  assert.equal(root.state(), 'ready');
  assert.equal(recording.mountCalls(), 1);

  const firstDispose = host.dispose();
  assert.equal(host.dispose(), firstDispose);
  assert.equal(await firstDispose, true);
  assert.equal(root.state(), 'fallback');
});

test('one WordPress page host shares exactly one reduced-motion source across multiple live instances', async () => {
  const first = rootHarness({ experienceId: 'shared', instanceId: null });
  const second = rootHarness({ experienceId: 'shared', instanceId: null });
  const media = mediaHarness();
  const source = hostOptions({ roots: [first.root, second.root], media });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 2, fallback: 0 });
  assert.equal(media.queryCalls(), 1);
  assert.equal(media.addCalls(), 1);
  assert.equal(media.listenerCount(), 1);
  assert.equal(first.state(), 'ready');
  assert.equal(second.state(), 'ready');

  await host.dispose();
  assert.equal(media.removeCalls(), 1);
  assert.equal(media.listenerCount(), 0);
  assert.equal(first.state(), 'fallback');
  assert.equal(second.state(), 'fallback');
});

test('experience load failure is isolated to one WordPress root and uses CIM-HST-001', async () => {
  const bad = rootHarness({ experienceId: 'bad', instanceId: 'bad-instance' });
  const good = rootHarness({ experienceId: 'good', instanceId: 'good-instance' });
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({
    roots: [bad.root, good.root],
    diagnostics,
    load: async (id) => {
      if (id === 'bad') throw new Error('load failed');
      return experienceFixture(id);
    }
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 1 });
  assert.equal(bad.state(), 'fallback');
  assert.equal(good.state(), 'ready');
  assert.equal(diagnostics.records.length, 1);
  assert.equal(diagnostics.records[0].code, 'CIM-HST-001');
  assert.equal(diagnostics.records[0].component, 'host');
  assert.equal(diagnostics.records[0].instanceId, 'bad-instance');
  assert.equal(diagnostics.records[0].operation, 'experience_load');
  assert.equal(Object.isFrozen(diagnostics.records[0]), true);

  await host.dispose();
});

test('duplicate explicit instance identity fails only the duplicate invocation', async () => {
  const first = rootHarness({ experienceId: 'one', instanceId: 'duplicate' });
  const second = rootHarness({ experienceId: 'two', instanceId: 'duplicate' });
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({ roots: [first.root, second.root], diagnostics });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 1 });
  assert.equal(first.state(), 'ready');
  assert.equal(second.state(), 'fallback');
  assert.equal(diagnostics.records.length, 1);
  assert.equal(diagnostics.records[0].code, 'CIM-HST-004');
  assert.equal(diagnostics.records[0].operation, 'invocation');
  assert.match(diagnostics.records[0].message, /must be unique/);

  await host.dispose();
});

test('blank experience identity remains static fallback and never reaches the loader', async () => {
  const root = rootHarness({ experienceId: '   ', instanceId: 'blank-experience' });
  let loadCalls = 0;
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({
    roots: [root.root],
    diagnostics,
    load: async () => {
      loadCalls += 1;
      return experienceFixture();
    }
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 1 });
  assert.equal(loadCalls, 0);
  assert.equal(root.state(), 'fallback');
  assert.equal(diagnostics.records[0].code, 'CIM-HST-004');
  assert.equal(diagnostics.records[0].operation, 'invocation');

  await host.dispose();
});

test('renderer resolution failure preserves renderer ownership and page fallback', async () => {
  const root = rootHarness({ instanceId: 'renderer-failure' });
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({
    roots: [root.root],
    diagnostics,
    resolve: async () => {
      throw new Error('renderer unavailable');
    }
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 1 });
  assert.equal(root.state(), 'fallback');
  assert.equal(diagnostics.records[0].code, 'CIM-RND-001');
  assert.equal(diagnostics.records[0].component, 'renderer');
  assert.equal(diagnostics.records[0].operation, 'renderer_resolve');
  assert.equal(await host.dispose(), true);
});

test('Runtime initialization failure is cleaned up before the WordPress root settles to fallback', async () => {
  const root = rootHarness({ instanceId: 'initialization-failure' });
  const recording = rendererFixture({ renderError: new Error('initial render failed') });
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({
    roots: [root.root],
    diagnostics,
    resolve: async () => recording.renderer
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 1 });
  assert.equal(root.state(), 'fallback');
  assert.equal(recording.disposeCalls(), 1);
  assert.equal(diagnostics.records.some((record) => record.operation === 'initialize'), true);

  await host.dispose();
});

test('ready projection failure disposes the initialized instance and restores fallback projection', async () => {
  const root = rootHarness({ instanceId: 'ready-failure', failReadyOnce: true });
  const recording = rendererFixture();
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({
    roots: [root.root],
    diagnostics,
    resolve: async () => recording.renderer
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 1 });
  assert.equal(root.state(), 'fallback');
  assert.equal(recording.disposeCalls(), 1);
  assert.equal(diagnostics.records.some((record) => record.operation === 'ready_projection'), true);

  await host.dispose();
});

test('reduced-motion source construction failure leaves every discovered root in fallback before loading', async () => {
  const first = rootHarness({ experienceId: 'one' });
  const second = rootHarness({ experienceId: 'two' });
  const media = mediaHarness({ queryError: new Error('matchMedia unavailable') });
  const diagnostics = diagnosticsHarness();
  let loadCalls = 0;
  const source = hostOptions({
    roots: [first.root, second.root],
    media,
    diagnostics,
    load: async (id) => {
      loadCalls += 1;
      return experienceFixture(id);
    }
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 2 });
  assert.equal(loadCalls, 0);
  assert.equal(first.state(), 'fallback');
  assert.equal(second.state(), 'fallback');
  assert.equal(diagnostics.records.length, 2);
  assert.equal(diagnostics.records.every((record) => record.operation === 'reduced_motion_source'), true);

  await host.dispose();
});

test('dispose during a pending experience load closes the shared source and prevents late Runtime construction', async () => {
  const root = rootHarness({ instanceId: 'pending-load' });
  const pending = deferred();
  const media = mediaHarness();
  let resolveCalls = 0;
  let clockCalls = 0;
  const source = hostOptions({
    roots: [root.root],
    media,
    load: () => pending.promise,
    resolve: async () => {
      resolveCalls += 1;
      return rendererFixture().renderer;
    },
    create: () => {
      clockCalls += 1;
      return clockFixture();
    }
  });
  const host = createWordPressLiveHost(source.options);

  const mountPromise = host.mount();
  assert.equal(media.listenerCount(), 1);
  const disposePromise = host.dispose();
  assert.equal(media.removeCalls(), 1);
  assert.equal(media.listenerCount(), 0);

  pending.resolve(experienceFixture('pending-load'));
  assert.deepEqual(await mountPromise, { mounted: 0, fallback: 1 });
  assert.equal(await disposePromise, true);
  assert.equal(resolveCalls, 0);
  assert.equal(clockCalls, 0);
  assert.equal(root.state(), 'fallback');
});

test('diagnostic sink failure cannot escape per-root fallback handling', async () => {
  const root = rootHarness({ experienceId: 'bad', instanceId: 'diagnostic-failure' });
  const diagnostics = diagnosticsHarness({ throwOnReport: true });
  const source = hostOptions({
    roots: [root.root],
    diagnostics,
    load: async () => {
      throw new Error('load failed');
    }
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 1 });
  assert.equal(root.state(), 'fallback');
  assert.equal(diagnostics.records.length, 1);
  assert.equal(await host.dispose(), true);
});

test('page-host disposal reports shared source teardown failure while retaining single-shot promise identity', async () => {
  const root = rootHarness({ instanceId: 'source-dispose-failure' });
  const removalFailure = new Error('native remove failed');
  const media = mediaHarness({ removeError: removalFailure });
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({ roots: [root.root], media, diagnostics });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 0 });
  const firstDispose = host.dispose();
  assert.equal(host.dispose(), firstDispose);
  await assert.rejects(firstDispose, (error) => error === removalFailure);
  assert.equal(diagnostics.records.some(
    (record) => record.operation === 'reduced_motion_source_dispose'
  ), true);
  assert.equal(root.state(), 'fallback');
});

test('no CiM roots produces a quiet zero-result without constructing browser preference observation', async () => {
  const media = mediaHarness();
  const source = hostOptions({ roots: [], media });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 0 });
  assert.equal(media.queryCalls(), 0);
  assert.equal(media.listenerCount(), 0);
  assert.equal(await host.dispose(), true);
});

test('WordPress live Host rejects widened or mutable injected production capabilities', () => {
  const root = rootHarness();
  const media = mediaHarness();
  const diagnostics = diagnosticsHarness();
  const document = documentHarness([root.root]).document;
  const valid = capabilityHarness({
    load: async (id) => experienceFixture(id),
    resolve: async () => rendererFixture().renderer
  });

  assert.throws(() => createWordPressLiveHost({
    document,
    matchMedia: media.matchMedia,
    experienceLoader: { load: valid.experienceLoader.load },
    rendererResolver: valid.rendererResolver,
    clockFactory: valid.clockFactory,
    diagnostics: diagnostics.diagnostics
  }), /experience loader must be frozen/);

  assert.throws(() => createWordPressLiveHost({
    document,
    matchMedia: media.matchMedia,
    experienceLoader: valid.experienceLoader,
    rendererResolver: Object.freeze({ resolve: valid.rendererResolver.resolve, extra() {} }),
    clockFactory: valid.clockFactory,
    diagnostics: diagnostics.diagnostics
  }), /renderer resolver must contain exactly/);

  assert.throws(() => createWordPressLiveHost({
    document,
    matchMedia: media.matchMedia,
    experienceLoader: valid.experienceLoader,
    rendererResolver: valid.rendererResolver,
    clockFactory: valid.clockFactory,
    diagnostics: diagnostics.diagnostics,
    extra: true
  }), /live Host options must contain exactly/);
});


test('WordPress live Host initializes directly at a resolved deep-link boundary', async () => {
  const root = rootHarness({ instanceId: 'deep-link-instance' });
  const recording = rendererFixture();
  const source = hostOptions({
    roots: [root.root],
    resolve: async () => recording.renderer,
    resolveEntry: () => Object.freeze({ stepId: 'step-01', source: 'deep_link' })
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 0 });
  assert.equal(root.state(), 'ready');
  assert.equal(recording.contexts.length, 1);
  assert.equal(recording.contexts[0].stepId, 'step-01');
  assert.equal(recording.contexts[0].fromStepId, null);

  await host.dispose();
});

test('invalid WordPress deep-link resolution records CIM-HST-002 and opens at initial', async () => {
  const root = rootHarness({ instanceId: 'invalid-deep-link' });
  const recording = rendererFixture();
  const diagnostics = diagnosticsHarness();
  const source = hostOptions({
    roots: [root.root],
    diagnostics,
    resolve: async () => recording.renderer,
    resolveEntry: () => { throw new TypeError('unknown deep-link boundary'); }
  });
  const host = createWordPressLiveHost(source.options);

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 0 });
  assert.equal(root.state(), 'ready');
  assert.equal(recording.contexts[0].stepId, 'initial');
  assert.equal(diagnostics.records.length, 1);
  assert.equal(diagnostics.records[0].code, 'CIM-HST-002');
  assert.equal(diagnostics.records[0].operation, 'deep_link_resolve');

  await host.dispose();
});
