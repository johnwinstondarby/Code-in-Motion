import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSPORT_MARKER_INTERACTION_KEYS,
  createTransportMarkerInteraction
} from '../src/transport/marker-interaction.mjs';

class FakeButton {
  constructor(name) {
    this.name = name;
    this.tagName = 'BUTTON';
    this.type = 'button';
    this.listeners = new Map();
    this.addCalls = [];
    this.removeCalls = [];
    this.failAdd = false;
    this.failRemoveOnce = false;
  }
  addEventListener(type, listener) {
    if (this.failAdd) throw new Error(`add failure: ${this.name}`);
    this.addCalls.push(type);
    this.listeners.set(type, listener);
  }
  removeEventListener(type, listener) {
    if (this.failRemoveOnce) {
      this.failRemoveOnce = false;
      throw new Error(`remove failure: ${this.name}`);
    }
    this.removeCalls.push(type);
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  click(event = { defaultPrevented: false }) {
    return this.listeners.get('click')?.(event);
  }
}

function record(stepId, index, overrides = {}) {
  return Object.freeze({
    stepId,
    index,
    visualLabel: stepId === 'initial' ? 'Start' : `M${index}`,
    accessibleLabel: stepId === 'initial' ? 'Start' : `Step ${index}`,
    current: false,
    target: false,
    ...(stepId === 'initial' ? {} : { revealed: false }),
    preview: false,
    ...overrides
  });
}

function visualState() {
  return Object.freeze({
    initialAnchor: record('initial', 0),
    markers: Object.freeze([
      record('step-01', 1),
      record('step-02', 2),
      record('step-03', 3)
    ])
  });
}

function harness() {
  const initialControl = new FakeButton('initial');
  const markerControls = Object.freeze([
    new FakeButton('one'),
    new FakeButton('two'),
    new FakeButton('three')
  ]);
  let readCount = 0;
  let state = visualState();
  const presentation = Object.freeze({
    read() {
      readCount += 1;
      return state;
    }
  });
  const calls = [];
  const outcome = Object.freeze({ accepted: true });
  const marker = (stepId) => {
    calls.push(stepId);
    return outcome;
  };
  return {
    initialControl,
    markerControls,
    presentation,
    marker,
    calls,
    outcome,
    get readCount() { return readCount; },
    setState(value) { state = value; },
    options() { return { initialControl, markerControls, presentation, marker }; }
  };
}

test('marker interaction surface is exact frozen and installs one click listener per native button', () => {
  const h = harness();
  const interaction = createTransportMarkerInteraction(h.options());
  assert.deepEqual(Object.keys(interaction), TRANSPORT_MARKER_INTERACTION_KEYS);
  assert.ok(Object.isFrozen(interaction));
  assert.deepEqual(h.initialControl.addCalls, ['click']);
  assert.deepEqual(h.markerControls.map((control) => control.addCalls), [['click'], ['click'], ['click']]);
  assert.equal(h.readCount, 1);
});

test('initial and authored clicks submit their captured semantic IDs exactly once', () => {
  const h = harness();
  createTransportMarkerInteraction(h.options());
  h.initialControl.click();
  h.markerControls[0].click();
  h.markerControls[2].click();
  assert.deepEqual(h.calls, ['initial', 'step-01', 'step-03']);
});

test('marker interaction captures IDs from validated presentation and never trusts mutable DOM data attributes', () => {
  const h = harness();
  createTransportMarkerInteraction(h.options());
  h.markerControls[1].dataset = { cimStepId: 'attacker-step' };
  h.markerControls[1].click();
  assert.deepEqual(h.calls, ['step-02']);
  assert.equal(h.readCount, 1);
});

test('native click path does not prevent default stop propagation or synthesize keyboard events', () => {
  const h = harness();
  createTransportMarkerInteraction(h.options());
  const event = {
    defaultPrevented: false,
    preventDefault() { throw new Error('must not prevent'); },
    stopPropagation() { throw new Error('must not stop'); }
  };
  h.markerControls[0].click(event);
  assert.deepEqual(h.calls, ['step-01']);
  assert.deepEqual(h.markerControls[0].addCalls, ['click']);
});

test('an already default-prevented click yields without command submission', () => {
  const h = harness();
  createTransportMarkerInteraction(h.options());
  h.markerControls[0].click({ defaultPrevented: true });
  assert.deepEqual(h.calls, []);
});

test('rapid marker clicks are forwarded without debounce coalescing or in-flight gating', () => {
  const h = harness();
  createTransportMarkerInteraction(h.options());
  h.markerControls[0].click();
  h.markerControls[1].click();
  h.markerControls[0].click();
  assert.deepEqual(h.calls, ['step-01', 'step-02', 'step-01']);
});

test('construction fails closed on malformed presentation before installing listeners', () => {
  const h = harness();
  h.setState(Object.freeze({
    initialAnchor: record('initial', 0),
    markers: Object.freeze([
      record('step-01', 1),
      record('step-02', 9),
      record('step-03', 3)
    ])
  }));
  assert.throws(() => createTransportMarkerInteraction(h.options()), /index must match control order/);
  assert.equal(h.initialControl.addCalls.length, 0);
  assert.equal(h.markerControls.flatMap((control) => control.addCalls).length, 0);
});

test('partial listener installation is rolled back if a later add fails', () => {
  const h = harness();
  h.markerControls[1].failAdd = true;
  assert.throws(() => createTransportMarkerInteraction(h.options()), /add failure/);
  assert.equal(h.initialControl.listeners.size, 0);
  assert.equal(h.markerControls[0].listeners.size, 0);
  assert.equal(h.markerControls[1].listeners.size, 0);
  assert.equal(h.markerControls[2].listeners.size, 0);
});

test('dispose removes only installed click listeners and is idempotent after success', () => {
  const h = harness();
  const interaction = createTransportMarkerInteraction(h.options());
  interaction.dispose();
  interaction.dispose();
  h.markerControls[0].click();
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.initialControl.removeCalls, ['click']);
  assert.deepEqual(h.markerControls.map((control) => control.removeCalls), [['click'], ['click'], ['click']]);
});

test('dispose remains retryable when one listener removal fails', () => {
  const h = harness();
  const interaction = createTransportMarkerInteraction(h.options());
  h.markerControls[1].failRemoveOnce = true;
  assert.throws(() => interaction.dispose(), /remove failure/);
  assert.equal(h.markerControls[1].listeners.has('click'), true);
  interaction.dispose();
  assert.equal(h.markerControls[1].listeners.has('click'), false);
  assert.deepEqual(h.calls, []);
});

test('construction rejects widened authority and invalid native controls', () => {
  const h = harness();
  assert.throws(() => createTransportMarkerInteraction({
    ...h.options(),
    runtime: {}
  }), /exactly/);

  const h2 = harness();
  h2.initialControl.type = 'submit';
  assert.throws(() => createTransportMarkerInteraction(h2.options()), /type button/);

  const h3 = harness();
  assert.throws(() => createTransportMarkerInteraction({
    initialControl: h3.initialControl,
    markerControls: [...h3.markerControls],
    presentation: h3.presentation,
    marker: h3.marker
  }), /frozen array/);
});
