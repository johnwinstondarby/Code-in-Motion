import assert from 'node:assert/strict';
import test from 'node:test';

import { createTransportNativeRangeBinding } from '../src/transport/native-range-binding.mjs';
import {
  TRANSPORT_NATIVE_RANGE_INTERACTION_KEYS,
  createTransportNativeRangeInteraction
} from '../src/transport/native-range-interaction.mjs';
import { createTransportNativeRangePresentation } from '../src/transport/native-range-presentation.mjs';
import { createTransportScrubGesture } from '../src/transport/scrub-gesture.mjs';

const BOUNDARY_IDS = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);
const STEPS = Object.freeze([
  Object.freeze({ stepId: 'step-01', label: 'Observe A', marker: 'A' }),
  Object.freeze({ stepId: 'step-02', label: 'Observe B', marker: 'B' }),
  Object.freeze({ stepId: 'step-03', label: 'Observe C', marker: 'C' })
]);

function makeControl({ tagName = 'INPUT', type = 'range' } = {}) {
  const attrs = new Map();
  const listeners = new Map();
  const listenerCalls = [];
  let failAddType = null;
  let failRemoveType = null;

  const control = {
    tagName,
    type,
    min: '0',
    max: '3',
    step: '1',
    value: '0',
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    addEventListener(typeName, handler) {
      listenerCalls.push(['add', typeName, handler]);
      if (typeName === failAddType) throw new Error(`blocked add ${typeName}`);
      if (!listeners.has(typeName)) listeners.set(typeName, new Set());
      listeners.get(typeName).add(handler);
    },
    removeEventListener(typeName, handler) {
      listenerCalls.push(['remove', typeName, handler]);
      if (typeName === failRemoveType) {
        failRemoveType = null;
        throw new Error(`blocked remove ${typeName}`);
      }
      listeners.get(typeName)?.delete(handler);
    }
  };

  return {
    control,
    listenerCalls,
    attribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    dispatch(typeName) {
      for (const handler of [...(listeners.get(typeName) ?? [])]) handler({ type: typeName });
    },
    listenerCount(typeName) {
      return listeners.get(typeName)?.size ?? 0;
    },
    setFailAdd(typeName) {
      failAddType = typeName;
    },
    setFailRemove(typeName) {
      failRemoveType = typeName;
    }
  };
}

function makeIntegrated({ commitImpl } = {}) {
  const harness = makeControl();
  let currentStepId = 'initial';
  const commitCalls = [];

  const timeline = Object.freeze({
    boundaryIds() {
      return BOUNDARY_IDS;
    },
    project() {
      return Object.freeze({ currentStepId });
    }
  });

  const gesture = createTransportScrubGesture(timeline, (stepId) => {
    commitCalls.push(stepId);
    return commitImpl ? commitImpl(stepId) : Object.freeze({ result: 'accepted', stepId });
  });
  const scrubObservation = Object.freeze({ read: gesture.read });
  const presentation = createTransportNativeRangePresentation({
    boundaryIds: BOUNDARY_IDS,
    scrubObservation,
    steps: STEPS,
    ariaLabel: 'Experience position'
  });
  const binding = createTransportNativeRangeBinding({ control: harness.control, presentation });
  const interaction = createTransportNativeRangeInteraction({
    control: harness.control,
    gesture,
    binding
  });

  return {
    ...harness,
    gesture,
    binding,
    interaction,
    commitCalls,
    setCanonical(stepId) {
      currentStepId = stepId;
    }
  };
}

test('native range interaction surface is exact frozen and installs the four native event listeners', () => {
  const h = makeIntegrated();

  assert.deepEqual(Object.keys(h.interaction), TRANSPORT_NATIVE_RANGE_INTERACTION_KEYS);
  assert.equal(Object.isFrozen(h.interaction), true);
  assert.deepEqual(
    h.listenerCalls.filter(([action]) => action === 'add').map(([, type]) => type),
    ['input', 'change', 'pointercancel', 'touchcancel']
  );
});

test('input starts and updates local scrub preview without semantic commit', () => {
  const h = makeIntegrated();

  h.control.value = '2';
  h.dispatch('input');
  assert.equal(h.gesture.read().active, true);
  assert.equal(h.gesture.read().displayStepId, 'step-02');
  assert.equal(h.control.value, '2');
  assert.equal(h.attribute('aria-valuetext'), 'Observe B, position 3 of 4');
  assert.deepEqual(h.commitCalls, []);

  h.control.value = '3';
  h.dispatch('input');
  assert.equal(h.gesture.read().displayStepId, 'step-03');
  assert.equal(h.attribute('aria-valuetext'), 'Observe C, position 4 of 4');
  assert.deepEqual(h.commitCalls, []);
});

test('change commits the final preview exactly once and does not inspect or normalize the command outcome', () => {
  const outcome = Object.freeze({ arbitrary: 'opaque result' });
  const h = makeIntegrated({ commitImpl: () => outcome });

  h.control.value = '2';
  h.dispatch('input');
  h.dispatch('change');

  assert.deepEqual(h.commitCalls, ['step-02']);
  assert.equal(h.gesture.read().active, false);
  assert.equal(h.control.value, '2');
  assert.equal(h.attribute('aria-valuetext'), 'Observe B, position 3 of 4');
});

test('change without a preceding input still resolves one native activation to one scrub commit', () => {
  const h = makeIntegrated();

  h.control.value = '1';
  h.dispatch('change');

  assert.deepEqual(h.commitCalls, ['step-01']);
  assert.equal(h.gesture.read().active, false);
  assert.equal(h.control.value, '1');
});

test('pointer cancellation cancels preview, restores canonical presentation, and suppresses a trailing change', () => {
  const h = makeIntegrated();

  h.control.value = '3';
  h.dispatch('input');
  h.dispatch('pointercancel');

  assert.equal(h.gesture.read().active, false);
  assert.equal(h.control.value, '0');
  assert.equal(h.attribute('aria-valuetext'), 'Start, position 1 of 4');
  assert.deepEqual(h.commitCalls, []);

  h.dispatch('change');
  assert.deepEqual(h.commitCalls, []);

  h.control.value = '2';
  h.dispatch('input');
  h.dispatch('change');
  assert.deepEqual(h.commitCalls, ['step-02']);
});

test('touch cancellation follows the same no-command cancellation contract', () => {
  const h = makeIntegrated();

  h.control.value = '1';
  h.dispatch('input');
  h.dispatch('touchcancel');

  assert.equal(h.control.value, '0');
  assert.deepEqual(h.commitCalls, []);
});

test('invalid native ordinal state fails before preview mutation or semantic commit', () => {
  const h = makeIntegrated();
  h.control.value = '2.5';

  assert.throws(() => h.dispatch('input'), /valid semantic boundary ordinal/);
  assert.equal(h.gesture.read().active, false);
  assert.deepEqual(h.commitCalls, []);
});

test('a synchronous scrub commit failure closes preview, refreshes canonical presentation, and propagates', () => {
  const h = makeIntegrated({
    commitImpl() {
      throw new Error('commit blocked');
    }
  });

  h.control.value = '2';
  h.dispatch('input');

  assert.throws(() => h.dispatch('change'), /commit blocked/);
  assert.equal(h.gesture.read().active, false);
  assert.equal(h.control.value, '0');
  assert.deepEqual(h.commitCalls, ['step-02']);
});

test('external canonical settlement remains composition-owned through the checkpoint 8 refresh seam', () => {
  const h = makeIntegrated();

  h.control.value = '2';
  h.dispatch('input');
  h.dispatch('change');
  assert.equal(h.control.value, '2');

  h.setCanonical('step-02');
  h.binding.refresh();
  assert.equal(h.control.value, '2');
  assert.equal(h.attribute('aria-valuetext'), 'Observe B, position 3 of 4');
});

test('dispose removes only checkpoint 9 listeners, cancels active preview, and is idempotent', () => {
  const h = makeIntegrated();
  h.control.value = '3';
  h.dispatch('input');

  assert.equal(h.interaction.dispose(), null);
  assert.equal(h.gesture.read().active, false);
  assert.equal(h.control.value, '0');
  for (const type of ['input', 'change', 'pointercancel', 'touchcancel']) {
    assert.equal(h.listenerCount(type), 0);
  }
  assert.equal(h.interaction.dispose(), null);
});

test('dispose remains retryable when one native listener removal fails', () => {
  const h = makeIntegrated();
  h.setFailRemove('change');

  assert.throws(() => h.interaction.dispose(), /blocked remove change/);
  assert.equal(h.interaction.dispose(), null);
  for (const type of ['input', 'change', 'pointercancel', 'touchcancel']) {
    assert.equal(h.listenerCount(type), 0);
  }
});

test('construction rejects widened or malformed interaction authority', () => {
  const h = makeIntegrated();

  assert.throws(
    () => createTransportNativeRangeInteraction({
      control: h.control,
      gesture: h.gesture,
      binding: h.binding,
      command: () => null
    }),
    /must contain exactly: control, gesture, binding/
  );

  assert.throws(
    () => createTransportNativeRangeInteraction({
      control: h.control,
      gesture: Object.freeze({ ...h.gesture, extra: () => null }),
      binding: h.binding
    }),
    /Transport scrub gesture must contain exactly/
  );

  assert.throws(
    () => createTransportNativeRangeInteraction({
      control: h.control,
      gesture: h.gesture,
      binding: { refresh: h.binding.refresh }
    }),
    /Transport native range binding must be frozen/
  );
});

test('partial listener installation is rolled back when construction fails', () => {
  const harness = makeControl();
  harness.setFailAdd('pointercancel');
  const gesture = Object.freeze({
    begin: () => null,
    update: () => null,
    commit: () => null,
    cancel: () => null,
    read: () => null
  });
  const binding = Object.freeze({ refresh: () => null });

  assert.throws(
    () => createTransportNativeRangeInteraction({ control: harness.control, gesture, binding }),
    /blocked add pointercancel/
  );
  assert.equal(harness.listenerCount('input'), 0);
  assert.equal(harness.listenerCount('change'), 0);
});
