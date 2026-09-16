import test from 'node:test';
import assert from 'node:assert/strict';

import { createTransportNativeRangeInteraction } from '../src/transport/native-range-interaction.mjs';

function makeEventTarget({ tagName = 'DIV', type = undefined } = {}) {
  const listeners = new Map();
  const calls = [];
  const target = {
    tagName,
    ...(type === undefined ? {} : { type }),
    min: '0',
    max: '3',
    step: '1',
    value: '0',
    addEventListener(eventType, handler) {
      calls.push(['add', eventType]);
      if (!listeners.has(eventType)) listeners.set(eventType, new Set());
      listeners.get(eventType).add(handler);
    },
    removeEventListener(eventType, handler) {
      calls.push(['remove', eventType]);
      listeners.get(eventType)?.delete(handler);
    }
  };
  return Object.freeze({
    target,
    calls,
    dispatch(eventType, event = {}) {
      for (const handler of [...(listeners.get(eventType) ?? [])]) handler({ type: eventType, ...event });
    },
    listenerCount(eventType) {
      return listeners.get(eventType)?.size ?? 0;
    }
  });
}

function makeGesture() {
  const calls = [];
  let active = false;
  let index = 0;
  const ids = ['initial', 'step-01', 'step-02', 'step-03'];

  function state() {
    return Object.freeze({
      active,
      displayStepId: ids[index],
      displayIndex: index,
      displayRatio: index / 3
    });
  }

  const gesture = Object.freeze({
    begin(ratio) {
      calls.push(['begin', ratio]);
      active = true;
      index = Math.round(ratio * 3);
      return state();
    },
    update(ratio) {
      calls.push(['update', ratio]);
      index = Math.round(ratio * 3);
      return state();
    },
    commit() {
      calls.push(['commit']);
      active = false;
      return Object.freeze({ result: 'opaque' });
    },
    cancel() {
      calls.push(['cancel']);
      active = false;
      index = 0;
      return state();
    },
    read: state
  });

  return Object.freeze({ gesture, calls });
}

function makeBinding() {
  const calls = [];
  return Object.freeze({
    binding: Object.freeze({
      refresh() {
        calls.push('refresh');
        return null;
      }
    }),
    calls
  });
}

test('scrub interaction installs pointer-sensitive ownership only on the native range control', () => {
  const range = makeEventTarget({ tagName: 'INPUT', type: 'range' });
  const learnerText = makeEventTarget();
  const rail = makeEventTarget();
  const documentTarget = makeEventTarget();
  const windowTarget = makeEventTarget();
  const { gesture, calls: gestureCalls } = makeGesture();
  const { binding, calls: bindingCalls } = makeBinding();

  const interaction = createTransportNativeRangeInteraction({
    control: range.target,
    gesture,
    binding
  });

  assert.deepEqual(
    range.calls.filter(([action]) => action === 'add'),
    [
      ['add', 'input'],
      ['add', 'change'],
      ['add', 'pointercancel'],
      ['add', 'touchcancel']
    ]
  );
  assert.deepEqual(learnerText.calls, []);
  assert.deepEqual(rail.calls, []);
  assert.deepEqual(documentTarget.calls, []);
  assert.deepEqual(windowTarget.calls, []);

  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'selectstart', 'selectionchange']) {
    assert.equal(range.listenerCount(type), 0, `${type} must not be owned by Transport scrub interaction`);
  }

  assert.deepEqual(gestureCalls, []);
  assert.deepEqual(bindingCalls, []);
  interaction.dispose();
});

test('drag-select activity in selectable learner text cannot enter scrub preview or commit', () => {
  const range = makeEventTarget({ tagName: 'INPUT', type: 'range' });
  const learnerText = makeEventTarget();
  const documentTarget = makeEventTarget();
  const { gesture, calls: gestureCalls } = makeGesture();
  const { binding, calls: bindingCalls } = makeBinding();

  const interaction = createTransportNativeRangeInteraction({
    control: range.target,
    gesture,
    binding
  });

  learnerText.dispatch('pointerdown', { button: 0 });
  learnerText.dispatch('pointermove', { buttons: 1 });
  documentTarget.dispatch('selectionchange');
  learnerText.dispatch('pointerup', { button: 0 });

  assert.deepEqual(gestureCalls, []);
  assert.deepEqual(bindingCalls, []);
  assert.equal(gesture.read().active, false);

  range.target.value = '2';
  range.dispatch('input');
  assert.deepEqual(gestureCalls, [['begin', 2 / 3]]);
  assert.deepEqual(bindingCalls, ['refresh']);

  range.dispatch('change');
  assert.deepEqual(gestureCalls, [['begin', 2 / 3], ['update', 2 / 3], ['commit']]);
  assert.deepEqual(bindingCalls, ['refresh', 'refresh']);

  interaction.dispose();
});

test('selectable-text ownership requires no preventDefault path because Transport never receives those pointer events', () => {
  const range = makeEventTarget({ tagName: 'INPUT', type: 'range' });
  const learnerText = makeEventTarget();
  const { gesture, calls: gestureCalls } = makeGesture();
  const { binding } = makeBinding();
  let prevented = 0;

  const interaction = createTransportNativeRangeInteraction({
    control: range.target,
    gesture,
    binding
  });

  const selectionEvent = {
    preventDefault() {
      prevented += 1;
    }
  };
  learnerText.dispatch('pointerdown', selectionEvent);
  learnerText.dispatch('pointermove', selectionEvent);
  learnerText.dispatch('pointerup', selectionEvent);

  assert.equal(prevented, 0);
  assert.deepEqual(gestureCalls, []);
  interaction.dispose();
});
