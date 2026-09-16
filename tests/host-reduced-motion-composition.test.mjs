import test from 'node:test';
import assert from 'node:assert/strict';

import { createReducedMotionPreference } from '../src/accessibility/reduced-motion-preference.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import {
  HOST_CIM_INSTANCE_OPTIONS_KEYS,
  createHostCiMInstance
} from '../src/host/cim-instance.mjs';

function experienceFixture(id = 'host-reduced-motion') {
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

function rendererFixture() {
  const contexts = [];
  const renderer = Object.freeze({
    mount() {},
    render(_state, context) {
      contexts.push(context);
      return Promise.resolve();
    },
    dispose() {}
  });
  return { renderer, contexts };
}

function preferenceHarness(initialMatches = false) {
  let matches = initialMatches;
  let reads = 0;
  const mediaQueryList = {};
  Object.defineProperty(mediaQueryList, 'matches', {
    enumerable: true,
    get() {
      return matches;
    }
  });
  const preference = createReducedMotionPreference({
    matchMedia() {
      return mediaQueryList;
    }
  });
  const counted = Object.freeze({
    read() {
      reads += 1;
      return preference.read();
    }
  });
  return {
    preference: counted,
    reads: () => reads,
    setMatches(value) {
      matches = value;
    }
  };
}

function instanceOptions({
  instanceId = 'host-instance',
  experience = experienceFixture(),
  clock = clockFixture(),
  recording = rendererFixture(),
  preference = preferenceHarness(false).preference
} = {}) {
  return {
    options: {
      instanceId,
      experience,
      clock,
      renderer: recording.renderer,
      rendererRoot: {},
      reducedMotionPreference: preference
    },
    recording
  };
}

test('Host CiM composition option contract is exact and creates a Runtime instance', () => {
  const { options } = instanceOptions();
  assert.deepEqual(Object.keys(options), HOST_CIM_INSTANCE_OPTIONS_KEYS);

  const instance = createHostCiMInstance(options);
  assert.equal(typeof instance.initialize, 'function');
  assert.equal(typeof instance.read.snapshot, 'function');
  assert.equal('reducedMotionPreference' in instance, false);
});

test('Host samples reduced motion exactly once at Runtime construction and forwards false to renderer context', async () => {
  const preference = preferenceHarness(false);
  const { options, recording } = instanceOptions({ preference: preference.preference });

  const instance = createHostCiMInstance(options);
  assert.equal(preference.reads(), 1);

  await instance.initialize();
  assert.equal(preference.reads(), 1);
  assert.equal(recording.contexts.length, 1);
  assert.equal(recording.contexts[0].reducedMotion, false);
});

test('Host forwards true reduced-motion preference to Runtime renderer context', async () => {
  const preference = preferenceHarness(true);
  const { options, recording } = instanceOptions({ preference: preference.preference });
  const instance = createHostCiMInstance(options);

  await instance.initialize();
  assert.equal(recording.contexts[0].reducedMotion, true);
});

test('existing Runtime keeps its construction-time reduced-motion sample when the live preference changes', async () => {
  const preference = preferenceHarness(false);
  const firstRecording = rendererFixture();
  const first = createHostCiMInstance(instanceOptions({
    instanceId: 'host-static-first',
    recording: firstRecording,
    preference: preference.preference
  }).options);

  preference.setMatches(true);
  await first.initialize();
  assert.equal(firstRecording.contexts[0].reducedMotion, false);
  assert.equal(preference.reads(), 1);

  const secondRecording = rendererFixture();
  const second = createHostCiMInstance(instanceOptions({
    instanceId: 'host-static-second',
    experience: experienceFixture('host-static-second-experience'),
    recording: secondRecording,
    preference: preference.preference
  }).options);
  assert.equal(preference.reads(), 2);

  await second.initialize();
  assert.equal(secondRecording.contexts[0].reducedMotion, true);
  assert.equal(preference.reads(), 2);
});

test('Host does not resample preference on later Runtime commands', async () => {
  const preference = preferenceHarness(true);
  const { options, recording } = instanceOptions({ preference: preference.preference });
  const instance = createHostCiMInstance(options);

  await instance.initialize();
  await instance.next('transport');

  assert.equal(preference.reads(), 1);
  assert.equal(recording.contexts.length, 2);
  assert.equal(recording.contexts[0].reducedMotion, true);
  assert.equal(recording.contexts[1].reducedMotion, true);
});

test('Host reduced-motion capability must be exact frozen read-only shape', () => {
  const base = instanceOptions().options;

  assert.throws(
    () => createHostCiMInstance({ ...base, reducedMotionPreference: { read: () => false } }),
    /must be frozen/
  );

  assert.throws(
    () => createHostCiMInstance({
      ...base,
      reducedMotionPreference: Object.freeze({ read: () => false, extra: true })
    }),
    /must contain exactly: read/
  );

  const withSymbol = { read: () => false };
  withSymbol[Symbol('extra')] = true;
  Object.freeze(withSymbol);
  assert.throws(
    () => createHostCiMInstance({ ...base, reducedMotionPreference: withSymbol }),
    /must not contain symbol keys/
  );

  const accessor = {};
  Object.defineProperty(accessor, 'read', {
    enumerable: true,
    get() {
      return () => false;
    }
  });
  Object.freeze(accessor);
  assert.throws(
    () => createHostCiMInstance({ ...base, reducedMotionPreference: accessor }),
    /must be an enumerable data property/
  );

  assert.throws(
    () => createHostCiMInstance({
      ...base,
      reducedMotionPreference: Object.freeze({ read: false })
    }),
    /read must be a function/
  );
});

test('Host fails closed when reduced-motion read is non-boolean or throws', () => {
  const base = instanceOptions().options;

  for (const value of [undefined, null, 0, 1, 'false']) {
    assert.throws(
      () => createHostCiMInstance({
        ...base,
        reducedMotionPreference: Object.freeze({ read: () => value })
      }),
      /read must return boolean/
    );
  }

  assert.throws(
    () => createHostCiMInstance({
      ...base,
      reducedMotionPreference: Object.freeze({
        read() {
          throw new Error('preference read failed');
        }
      })
    }),
    /preference read failed/
  );
});

test('Host options reject widened symbol and accessor substitutions before composition', () => {
  const { options } = instanceOptions();

  assert.throws(
    () => createHostCiMInstance({ ...options, extra: true }),
    /must contain exactly:/
  );

  const withSymbol = { ...options };
  withSymbol[Symbol('extra')] = true;
  assert.throws(
    () => createHostCiMInstance(withSymbol),
    /must not contain symbol keys/
  );

  const accessor = { ...options };
  Object.defineProperty(accessor, 'reducedMotionPreference', {
    enumerable: true,
    get() {
      return options.reducedMotionPreference;
    }
  });
  assert.throws(
    () => createHostCiMInstance(accessor),
    /must be an enumerable data property/
  );
});

test('preference failure occurs before Runtime option validation', () => {
  const { options } = instanceOptions({ instanceId: '' });
  const reducedMotionPreference = Object.freeze({
    read() {
      throw new Error('sample failed first');
    }
  });

  assert.throws(
    () => createHostCiMInstance({ ...options, reducedMotionPreference }),
    /sample failed first/
  );
});
