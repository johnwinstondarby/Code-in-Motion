import test from 'node:test';
import assert from 'node:assert/strict';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createLiveHostCiMInstance } from '../src/host/cim-instance.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'host-cleanup-precedence',
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

test('construction cleanup failure preserves the original construction failure as AggregateError cause and first error', async () => {
  const cleanupError = new Error('unsubscribe cleanup failed');
  const malformedUnsubscribe = () => {
    throw cleanupError;
  };
  const changes = Object.freeze({
    subscribe() {
      return malformedUnsubscribe;
    },
    dispose() {
      throw new Error('source-level dispose must not be called');
    }
  });

  let observed;
  try {
    await createLiveHostCiMInstance({
      instanceId: 'cleanup-precedence-instance',
      experience: experienceFixture(),
      clock: clockFixture(),
      renderer: Object.freeze({
        mount() {},
        render() {
          return Promise.resolve();
        },
        dispose() {}
      }),
      rendererRoot: {},
      reducedMotionPreference: Object.freeze({ read: () => false }),
      reducedMotionChanges: changes,
      diagnostics: Object.freeze({ report() {} })
    });
  } catch (error) {
    observed = error;
  }

  assert.equal(observed instanceof AggregateError, true);
  assert.match(observed.cause.message, /must return a frozen unsubscribe function/);
  assert.equal(observed.errors[0], observed.cause);
  assert.equal(observed.errors[1], cleanupError);
});
