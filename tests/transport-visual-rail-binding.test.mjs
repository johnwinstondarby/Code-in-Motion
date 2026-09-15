import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSPORT_VISUAL_RAIL_BINDING_KEYS,
  createTransportVisualRailBinding
} from '../src/transport/visual-rail-binding.mjs';

class FakeButton {
  constructor(name) {
    this.name = name;
    this.tagName = 'BUTTON';
    this.type = 'button';
    this.textContent = `old-${name}`;
    this.attributes = new Map([['data-host', 'preserve']]);
    this.listenerAdds = 0;
    this.failAttribute = null;
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  setAttribute(name, value) {
    if (this.failAttribute === name) throw new Error(`write failure: ${name}`);
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    if (this.failAttribute === name) throw new Error(`write failure: ${name}`);
    this.attributes.delete(name);
  }
  addEventListener() {
    this.listenerAdds += 1;
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

function state(overrides = {}) {
  return Object.freeze({
    initialAnchor: record('initial', 0),
    markers: Object.freeze([
      record('step-01', 1, { revealed: true }),
      record('step-02', 2, { current: true, revealed: true, preview: true }),
      record('step-03', 3, { target: true })
    ]),
    ...overrides
  });
}

function harness() {
  const initialControl = new FakeButton('initial');
  const markerControls = Object.freeze([
    new FakeButton('one'),
    new FakeButton('two'),
    new FakeButton('three')
  ]);
  let current = state();
  const presentation = Object.freeze({ read: () => current });
  return {
    initialControl,
    markerControls,
    presentation,
    setState(value) { current = value; },
    options() { return { initialControl, markerControls, presentation }; }
  };
}

test('visual rail binding is exact frozen and construction refreshes all native buttons', () => {
  const h = harness();
  const binding = createTransportVisualRailBinding(h.options());
  assert.deepEqual(Object.keys(binding), TRANSPORT_VISUAL_RAIL_BINDING_KEYS);
  assert.ok(Object.isFrozen(binding));
  assert.equal(h.initialControl.textContent, 'Start');
  assert.equal(h.markerControls[1].textContent, 'M2');
  assert.equal(h.markerControls[1].getAttribute('aria-current'), 'step');
  assert.equal(h.markerControls[1].getAttribute('data-cim-preview'), 'true');
  assert.equal(h.markerControls[2].getAttribute('data-cim-target'), 'true');
});

test('binding writes semantic labels and styling data while preserving unrelated host fields', () => {
  const h = harness();
  h.markerControls[0].attributes.set('role', 'presentation-host-value');
  h.markerControls[0].attributes.set('tabindex', '7');
  createTransportVisualRailBinding(h.options());
  const button = h.markerControls[0];
  assert.equal(button.getAttribute('aria-label'), 'Step 1');
  assert.equal(button.getAttribute('data-cim-step-id'), 'step-01');
  assert.equal(button.getAttribute('data-cim-index'), '1');
  assert.equal(button.getAttribute('data-cim-revealed'), 'true');
  assert.equal(button.getAttribute('role'), 'presentation-host-value');
  assert.equal(button.getAttribute('tabindex'), '7');
  assert.equal(button.getAttribute('data-host'), 'preserve');
});

test('refresh follows fresh visual presentation state and clears stale aria-current', () => {
  const h = harness();
  const binding = createTransportVisualRailBinding(h.options());
  h.setState(Object.freeze({
    initialAnchor: record('initial', 0, { current: true, preview: true }),
    markers: Object.freeze([
      record('step-01', 1, { revealed: true }),
      record('step-02', 2, { revealed: true }),
      record('step-03', 3, { revealed: true })
    ])
  }));
  binding.refresh();
  assert.equal(h.initialControl.getAttribute('aria-current'), 'step');
  assert.equal(h.initialControl.getAttribute('data-cim-preview'), 'true');
  assert.equal(h.markerControls[1].getAttribute('aria-current'), null);
  assert.equal(h.markerControls[2].getAttribute('data-cim-revealed'), 'true');
});

test('checkpoint 11 installs no interaction listeners', () => {
  const h = harness();
  createTransportVisualRailBinding(h.options());
  assert.equal(h.initialControl.listenerAdds, 0);
  assert.deepEqual(h.markerControls.map((control) => control.listenerAdds), [0, 0, 0]);
});

test('malformed presentation state fails before the first DOM write', () => {
  const h = harness();
  const before = h.markerControls.map((control) => control.textContent);
  h.setState(Object.freeze({
    initialAnchor: record('initial', 0),
    markers: Object.freeze([
      record('step-01', 1),
      record('step-02', 9),
      record('step-03', 3)
    ])
  }));
  assert.throws(() => createTransportVisualRailBinding(h.options()), /index must match control order/);
  assert.deepEqual(h.markerControls.map((control) => control.textContent), before);
});

test('a DOM write failure rolls back every checkpoint-owned field across all controls', () => {
  const h = harness();
  const snapshots = [h.initialControl, ...h.markerControls].map((control) => ({
    textContent: control.textContent,
    attributes: new Map(control.attributes)
  }));
  h.markerControls[1].failAttribute = 'data-cim-target';
  assert.throws(() => createTransportVisualRailBinding(h.options()), /write failure/);
  [h.initialControl, ...h.markerControls].forEach((control, index) => {
    assert.equal(control.textContent, snapshots[index].textContent);
    assert.deepEqual([...control.attributes], [...snapshots[index].attributes]);
  });
});

test('native control identity requires distinct button type button controls', () => {
  const h = harness();
  h.initialControl.type = 'submit';
  assert.throws(() => createTransportVisualRailBinding(h.options()), /type button/);

  const h2 = harness();
  const duplicate = Object.freeze([h2.initialControl, ...h2.markerControls.slice(1)]);
  assert.throws(() => createTransportVisualRailBinding({
    initialControl: h2.initialControl,
    markerControls: duplicate,
    presentation: h2.presentation
  }), /distinct/);
});

test('construction rejects mutable marker arrays and widened presentation authority', () => {
  const h = harness();
  assert.throws(() => createTransportVisualRailBinding({
    initialControl: h.initialControl,
    markerControls: [...h.markerControls],
    presentation: h.presentation
  }), /frozen array/);

  assert.throws(() => createTransportVisualRailBinding({
    initialControl: h.initialControl,
    markerControls: h.markerControls,
    presentation: Object.freeze({ read: h.presentation.read, seek: () => null })
  }), /exactly/);
});
