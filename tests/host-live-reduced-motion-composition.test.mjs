import test from 'node:test';
import assert from 'node:assert/strict';

import { createReducedMotionPreferenceSource } from '../src/accessibility/reduced-motion-preference-source.mjs';
import { CIM_INSTANCE_PUBLIC_KEYS } from '../src/contracts/runtime-instance.mjs';
import { SESSION_STATUS } from '../src/contracts/session.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import {
  HOST_DIAGNOSTIC_KEYS,
  HOST_DIAGNOSTIC_RECORD_KEYS,
  HOST_LIVE_CIM_INSTANCE_KEYS,
  HOST_LIVE_CIM_INSTANCE_OPTIONS_KEYS,
  HOST_RETAINED_RUNTIME_KEYS,
  createHostCiMInstance,
  createLiveHostCiMInstance
} from '../src/host/cim-instance.mjs';

function experienceFixture(id = 'host-live-reduced-motion') {
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

function rendererFixture({ disposeError = null } = {}) {
  const contexts = [];
  let disposeCalls = 0;
  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      contexts.push(context);
      return Promise.resolve();
    },
    dispose() {
      disposeCalls += 1;
      if (disposeError !== null) return Promise.reject(disposeError);
    }
  });
  return { renderer, contexts, disposeCalls: () => disposeCalls };
}

function sourceHarness(initialMatches = false) {
  let matches = initialMatches;
  const nativeListeners = new Set();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      nativeListeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change');
      nativeListeners.delete(listener);
    }
  };

  const source = createReducedMotionPreferenceSource({
    matchMedia() {
      return mediaQueryList;
    }
  });

  return {
    source,
    setMatches(value) {
      matches = value;
    },
    emit() {
      for (const listener of [...nativeListeners]) listener({ type: 'change' });
    },
    nativeListenerCount: () => nativeListeners.size
  };
}

function diagnosticsHarness({ throwOnReport = false } = {}) {
  const records = [];
  const diagnostics = Object.freeze({
    report(record) {
      records.push(record);
      if (throwOnReport) throw new Error('diagnostic sink failed');
    }
  });
  return { diagnostics, records };
}

function liveOptions({
  instanceId = 'host-live-instance',
  experience = experienceFixture(),
  clock = clockFixture(),
  recording = rendererFixture(),
  source = sourceHarness(false).source,
  diagnostics = diagnosticsHarness().diagnostics
} = {}) {
  return {
    options: {
      instanceId,
      experience,
      clock,
      renderer: recording.renderer,
      rendererRoot: {},
      reducedMotionPreference: source.preference,
      reducedMotionChanges: source.changes,
      diagnostics
    },
    recording
  };
}

function runtimePublicKeys(instance) {
  const ownKeys = Reflect.ownKeys(instance);
  const prototypeKeys = Reflect.ownKeys(Object.getPrototypeOf(instance)).filter(
    (key) => key !== 'constructor'
  );
  return [...ownKeys, ...prototypeKeys];
}

function graphContainsKey(root, target, seen = new Set()) {
  if ((typeof root !== 'object' && typeof root !== 'function') || root === null || seen.has(root)) {
    return false;
  }
  seen.add(root);

  for (const key of Reflect.ownKeys(root)) {
    if (key === target) return true;
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (descriptor && 'value' in descriptor && graphContainsKey(descriptor.value, target, seen)) {
      return true;
    }
  }
  return false;
}

test('Runtime public contract and Host live facade partition stay exact', () => {
  const source = sourceHarness(false);
  const staticInstance = createHostCiMInstance({
    instanceId: 'surface-runtime',
    experience: experienceFixture('surface-runtime-experience'),
    clock: clockFixture(),
    renderer: rendererFixture().renderer,
    rendererRoot: {},
    reducedMotionPreference: source.source.preference
  });

  assert.deepEqual(new Set(runtimePublicKeys(staticInstance)), new Set(CIM_INSTANCE_PUBLIC_KEYS));
  assert.deepEqual(
    new Set([...HOST_LIVE_CIM_INSTANCE_KEYS, ...HOST_RETAINED_RUNTIME_KEYS]),
    new Set(CIM_INSTANCE_PUBLIC_KEYS)
  );
  assert.deepEqual(HOST_RETAINED_RUNTIME_KEYS, ['adoptReducedMotion']);
});

test('live Host construction returns the exact frozen facade and retains adoption privately', async () => {
  const source = sourceHarness(false);
  const { options } = liveOptions({ source: source.source });
  assert.deepEqual(Object.keys(options), HOST_LIVE_CIM_INSTANCE_OPTIONS_KEYS);

  const instance = await createLiveHostCiMInstance(options);
  assert.equal(Object.isFrozen(instance), true);
  assert.deepEqual(Object.keys(instance), HOST_LIVE_CIM_INSTANCE_KEYS);
  assert.equal('adoptReducedMotion' in instance, false);
  assert.equal(graphContainsKey(instance, 'adoptReducedMotion'), false);
  assert.equal(typeof instance.initialize, 'function');
  assert.equal(typeof instance.dispose, 'function');

  await instance.dispose();
  source.source.changes.dispose();
});

test('live Host construction closes the read-construct-subscribe race with a post-subscription re-read', async () => {
  let reads = 0;
  let subscriber = null;
  const preference = Object.freeze({
    read() {
      reads += 1;
      return reads === 1 ? false : true;
    }
  });
  const changes = Object.freeze({
    subscribe(listener) {
      subscriber = listener;
      return Object.freeze(() => {
        subscriber = null;
        return true;
      });
    },
    dispose() {}
  });
  const diagnostics = diagnosticsHarness();
  const recording = rendererFixture();

  const instance = await createLiveHostCiMInstance({
    instanceId: 'race-instance',
    experience: experienceFixture('race-experience'),
    clock: clockFixture(),
    renderer: recording.renderer,
    rendererRoot: {},
    reducedMotionPreference: preference,
    reducedMotionChanges: changes,
    diagnostics: diagnostics.diagnostics
  });

  assert.equal(reads, 2);
  assert.equal(typeof subscriber, 'function');
  await instance.initialize();
  assert.equal(recording.contexts[0].reducedMotion, true);
  await instance.dispose();
});

test('live preference changes adopt once without rerendering the stable boundary', async () => {
  const source = sourceHarness(false);
  const recording = rendererFixture();
  const { options } = liveOptions({ source: source.source, recording });
  const instance = await createLiveHostCiMInstance(options);

  await instance.initialize();
  assert.equal(recording.contexts.length, 1);
  assert.equal(recording.contexts[0].reducedMotion, false);

  source.setMatches(true);
  source.emit();
  assert.equal(recording.contexts.length, 1);

  await instance.next('transport');
  assert.equal(recording.contexts.length, 2);
  assert.equal(recording.contexts[1].reducedMotion, true);

  await instance.dispose();
  source.source.changes.dispose();
});

test('one Accessibility source can serve two Host compositions and disposing A cannot affect B', async () => {
  const source = sourceHarness(false);
  const diagnosticsA = diagnosticsHarness();
  const diagnosticsB = diagnosticsHarness();
  const recordingA = rendererFixture();
  const recordingB = rendererFixture();

  const instanceA = await createLiveHostCiMInstance(liveOptions({
    instanceId: 'shared-a',
    experience: experienceFixture('shared-a-experience'),
    recording: recordingA,
    source: source.source,
    diagnostics: diagnosticsA.diagnostics
  }).options);
  const instanceB = await createLiveHostCiMInstance(liveOptions({
    instanceId: 'shared-b',
    experience: experienceFixture('shared-b-experience'),
    recording: recordingB,
    source: source.source,
    diagnostics: diagnosticsB.diagnostics
  }).options);

  await instanceA.initialize();
  await instanceB.initialize();
  await instanceA.dispose();

  assert.equal(source.nativeListenerCount(), 1);
  source.setMatches(true);
  source.emit();
  assert.deepEqual(diagnosticsA.records, []);
  assert.deepEqual(diagnosticsB.records, []);

  await instanceB.next('transport');
  assert.equal(recordingB.contexts.at(-1).reducedMotion, true);
  assert.equal(recordingA.contexts.length, 1);

  await instanceB.dispose();
  assert.equal(source.nativeListenerCount(), 1);
  source.source.changes.dispose();
  assert.equal(source.nativeListenerCount(), 0);
});

test('Host disposal removes its subscription synchronously before Runtime disposal settles', async () => {
  const source = sourceHarness(false);
  const recording = rendererFixture();
  const instance = await createLiveHostCiMInstance(liveOptions({
    source: source.source,
    recording
  }).options);
  await instance.initialize();

  const disposePromise = instance.dispose();
  source.setMatches(true);
  source.emit();
  await disposePromise;

  assert.equal(recording.contexts.length, 1);
  assert.equal(instance.read.snapshot().canonical.status, SESSION_STATUS.DISPOSED);
  source.source.changes.dispose();
});

test('Host disposal is single-shot and returns the identical promise on success', async () => {
  const source = sourceHarness(false);
  const instance = await createLiveHostCiMInstance(liveOptions({ source: source.source }).options);
  await instance.initialize();

  const first = instance.dispose();
  const second = instance.dispose();
  assert.equal(first, second);
  await first;

  const third = instance.dispose();
  assert.equal(third, first);
  source.source.changes.dispose();
});

test('Host disposal preserves the identical promise and Runtime rejection outcome', async () => {
  const source = sourceHarness(false);
  const disposeError = new Error('renderer dispose failed');
  const recording = rendererFixture({ disposeError });
  const instance = await createLiveHostCiMInstance(liveOptions({
    source: source.source,
    recording
  }).options);
  await instance.initialize();

  const first = instance.dispose();
  const second = instance.dispose();
  assert.equal(first, second);

  let firstError;
  try {
    await first;
  } catch (error) {
    firstError = error;
  }
  assert.equal(firstError, disposeError);

  let secondError;
  try {
    await second;
  } catch (error) {
    secondError = error;
  }
  assert.equal(secondError, firstError);
  assert.equal(instance.dispose(), first);
  source.source.changes.dispose();
});

test('Host change callback failures are isolated and surfaced through exact diagnostics', async () => {
  let subscriber = null;
  const preference = Object.freeze({ read: () => false });
  const changes = Object.freeze({
    subscribe(listener) {
      subscriber = listener;
      return Object.freeze(() => {
        subscriber = null;
        return true;
      });
    },
    dispose() {}
  });
  const diagnostics = diagnosticsHarness();
  const recording = rendererFixture();
  const instance = await createLiveHostCiMInstance({
    instanceId: 'diagnostic-instance',
    experience: experienceFixture('diagnostic-experience'),
    clock: clockFixture(),
    renderer: recording.renderer,
    rendererRoot: {},
    reducedMotionPreference: preference,
    reducedMotionChanges: changes,
    diagnostics: diagnostics.diagnostics
  });

  assert.doesNotThrow(() => subscriber(Object.freeze({ reducedMotion: 'yes' })));
  assert.equal(diagnostics.records.length, 1);
  assert.deepEqual(Object.keys(diagnostics.records[0]), HOST_DIAGNOSTIC_RECORD_KEYS);
  assert.equal(Object.isFrozen(diagnostics.records[0]), true);
  assert.equal(diagnostics.records[0].code, 'CIM-HST-003');
  assert.equal(diagnostics.records[0].component, 'host');
  assert.equal(diagnostics.records[0].instanceId, 'diagnostic-instance');
  assert.equal(diagnostics.records[0].operation, 'reduced_motion_adoption');

  await instance.initialize();
  assert.equal(recording.contexts[0].reducedMotion, false);
  await instance.dispose();
});

test('a failing Host diagnostic sink cannot escape the live adoption callback', async () => {
  let subscriber = null;
  const changes = Object.freeze({
    subscribe(listener) {
      subscriber = listener;
      return Object.freeze(() => true);
    },
    dispose() {}
  });
  const diagnostics = diagnosticsHarness({ throwOnReport: true });
  const instance = await createLiveHostCiMInstance({
    instanceId: 'diagnostic-isolation',
    experience: experienceFixture('diagnostic-isolation-experience'),
    clock: clockFixture(),
    renderer: rendererFixture().renderer,
    rendererRoot: {},
    reducedMotionPreference: Object.freeze({ read: () => false }),
    reducedMotionChanges: changes,
    diagnostics: diagnostics.diagnostics
  });

  assert.doesNotThrow(() => subscriber(Object.freeze({ reducedMotion: 1 })));
  assert.equal(diagnostics.records.length, 1);
  await instance.dispose();
});

test('subscription installation failure remains the construction failure after compensating Runtime disposal', async () => {
  const subscriptionError = new Error('subscribe failed');
  const changes = Object.freeze({
    subscribe() {
      throw subscriptionError;
    },
    dispose() {
      throw new Error('source dispose must not be called');
    }
  });

  await assert.rejects(
    createLiveHostCiMInstance({
      instanceId: 'subscription-failure',
      experience: experienceFixture('subscription-failure-experience'),
      clock: clockFixture(),
      renderer: rendererFixture().renderer,
      rendererRoot: {},
      reducedMotionPreference: Object.freeze({ read: () => false }),
      reducedMotionChanges: changes,
      diagnostics: diagnosticsHarness().diagnostics
    }),
    (error) => error === subscriptionError
  );
});

test('malformed unsubscribe result is cleaned up when possible and fails construction', async () => {
  let unsubscribeCalls = 0;
  const mutableUnsubscribe = () => {
    unsubscribeCalls += 1;
    return true;
  };
  const changes = Object.freeze({
    subscribe() {
      return mutableUnsubscribe;
    },
    dispose() {}
  });

  await assert.rejects(
    createLiveHostCiMInstance({
      instanceId: 'bad-unsubscribe',
      experience: experienceFixture('bad-unsubscribe-experience'),
      clock: clockFixture(),
      renderer: rendererFixture().renderer,
      rendererRoot: {},
      reducedMotionPreference: Object.freeze({ read: () => false }),
      reducedMotionChanges: changes,
      diagnostics: diagnosticsHarness().diagnostics
    }),
    /must return a frozen unsubscribe function/
  );
  assert.equal(unsubscribeCalls, 1);
});

test('unsubscribe failure is diagnosed but cannot prevent Runtime terminal disposal', async () => {
  const unsubscribeError = new Error('unsubscribe failed');
  const diagnostics = diagnosticsHarness();
  const changes = Object.freeze({
    subscribe() {
      return Object.freeze(() => {
        throw unsubscribeError;
      });
    },
    dispose() {}
  });
  const instance = await createLiveHostCiMInstance({
    instanceId: 'unsubscribe-failure',
    experience: experienceFixture('unsubscribe-failure-experience'),
    clock: clockFixture(),
    renderer: rendererFixture().renderer,
    rendererRoot: {},
    reducedMotionPreference: Object.freeze({ read: () => false }),
    reducedMotionChanges: changes,
    diagnostics: diagnostics.diagnostics
  });
  await instance.initialize();

  const disposePromise = instance.dispose();
  await assert.rejects(disposePromise, (error) => error === unsubscribeError);
  assert.equal(instance.read.snapshot().canonical.status, SESSION_STATUS.DISPOSED);
  assert.equal(diagnostics.records.length, 1);
  assert.equal(diagnostics.records[0].operation, 'reduced_motion_unsubscribe');
  assert.equal(instance.dispose(), disposePromise);
});

test('live capability inputs remain exact frozen least-authority surfaces', async () => {
  const source = sourceHarness(false);
  const base = liveOptions({ source: source.source }).options;

  assert.deepEqual(Object.keys(base.diagnostics), HOST_DIAGNOSTIC_KEYS);
  assert.equal(Object.isFrozen(base.diagnostics), true);

  await assert.rejects(
    createLiveHostCiMInstance({
      ...base,
      reducedMotionChanges: Object.freeze({
        subscribe: source.source.changes.subscribe,
        dispose: source.source.changes.dispose,
        extra: true
      })
    }),
    /must contain exactly: subscribe, dispose/
  );

  await assert.rejects(
    createLiveHostCiMInstance({
      ...base,
      diagnostics: Object.freeze({ report: () => {}, extra: true })
    }),
    /must contain exactly: report/
  );

  await assert.rejects(
    createLiveHostCiMInstance({ ...base, extra: true }),
    /must contain exactly:/
  );

  source.source.changes.dispose();
});
