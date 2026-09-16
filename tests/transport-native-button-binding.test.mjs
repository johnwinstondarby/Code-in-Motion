import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSPORT_NATIVE_BUTTON_BINDING_KEYS,
  createTransportNativeButtonBinding
} from '../src/transport/native-button-binding.mjs';

const CONTROL_KEYS = ['playback', 'previous', 'next', 'home', 'end', 'restart'];
const COMMAND_KEYS = ['play', 'pause', 'previous', 'next', 'home', 'end', 'restart'];

class FakeButton {
  constructor(name) {
    this.name = name;
    this.tagName = 'BUTTON';
    this.type = 'button';
    this.textContent = `old-${name}`;
    this.attributes = new Map([
      ['data-host', 'preserve'],
      ['role', 'host-role'],
      ['tabindex', '9']
    ]);
    this.listeners = new Map();
    this.addCalls = [];
    this.removeCalls = [];
    this.failAttributeOnce = null;
    this.failAdd = false;
    this.failRemoveOnce = false;
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  setAttribute(name, value) {
    if (this.failAttributeOnce === name) {
      this.failAttributeOnce = null;
      throw new Error(`write failure: ${this.name}:${name}`);
    }
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    if (this.failAttributeOnce === name) {
      this.failAttributeOnce = null;
      throw new Error(`write failure: ${this.name}:${name}`);
    }
    this.attributes.delete(name);
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

function record(action, label = action[0].toUpperCase() + action.slice(1)) {
  return Object.freeze({ action, label });
}

function state(playbackAction = 'play', overrides = {}) {
  return Object.freeze({
    playback: record(playbackAction, playbackAction === 'play' ? 'Play' : 'Pause'),
    previous: record('previous', 'Previous'),
    next: record('next', 'Next'),
    home: record('home', 'Home'),
    end: record('end', 'End'),
    restart: record('restart', 'Restart'),
    ...overrides
  });
}

function harness() {
  const controls = Object.freeze(Object.fromEntries(CONTROL_KEYS.map((key) => [key, new FakeButton(key)])));
  let currentState = state('play');
  let reads = 0;
  const presentation = Object.freeze({
    read() {
      reads += 1;
      return currentState;
    }
  });
  const calls = [];
  const outcomes = Object.fromEntries(COMMAND_KEYS.map((key) => [key, Object.freeze({ key })]));
  const commands = Object.freeze(Object.fromEntries(COMMAND_KEYS.map((key) => [
    key,
    () => {
      calls.push(key);
      return outcomes[key];
    }
  ])));
  return {
    controls,
    presentation,
    commands,
    calls,
    outcomes,
    get reads() { return reads; },
    setState(value) { currentState = value; },
    options() { return { controls, presentation, commands }; }
  };
}

function snapshotControls(controls) {
  return Object.fromEntries(CONTROL_KEYS.map((key) => [key, {
    textContent: controls[key].textContent,
    attributes: new Map(controls[key].attributes)
  }]));
}

test('native button binding surface is exact frozen and construction projects all six controls', () => {
  const h = harness();
  const binding = createTransportNativeButtonBinding(h.options());
  assert.deepEqual(Object.keys(binding), TRANSPORT_NATIVE_BUTTON_BINDING_KEYS);
  assert.ok(Object.isFrozen(binding));
  assert.equal(h.controls.playback.textContent, 'Play');
  assert.equal(h.controls.playback.getAttribute('aria-label'), 'Play');
  assert.equal(h.controls.playback.getAttribute('data-cim-action'), 'play');
  assert.equal(h.controls.restart.getAttribute('data-cim-action'), 'restart');
  assert.equal(h.reads, 1);
});

test('refresh follows fresh presentation and flips playback label and action', () => {
  const h = harness();
  const binding = createTransportNativeButtonBinding(h.options());
  h.setState(state('pause'));
  binding.refresh();
  assert.equal(h.controls.playback.textContent, 'Pause');
  assert.equal(h.controls.playback.getAttribute('aria-label'), 'Pause');
  assert.equal(h.controls.playback.getAttribute('data-cim-action'), 'pause');
  assert.equal(h.reads, 2);
});

test('binding preserves native button role focus fields and unrelated host attributes', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  for (const control of Object.values(h.controls)) {
    assert.equal(control.getAttribute('role'), 'host-role');
    assert.equal(control.getAttribute('tabindex'), '9');
    assert.equal(control.getAttribute('data-host'), 'preserve');
    assert.equal(control.getAttribute('disabled'), null);
  }
});

test('binding installs click only and does not synthesize keyboard activation', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  for (const control of Object.values(h.controls)) assert.deepEqual(control.addCalls, ['click']);
});

test('static control activation dispatches the fixed command by control identity', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  h.controls.previous.setAttribute('data-cim-action', 'restart');
  h.controls.previous.click();
  h.controls.next.click();
  h.controls.home.click();
  h.controls.end.click();
  h.controls.restart.click();
  assert.deepEqual(h.calls, ['previous', 'next', 'home', 'end', 'restart']);
});

test('playback activation reads fresh presentation even when DOM projection is stale', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  assert.equal(h.controls.playback.getAttribute('data-cim-action'), 'play');
  h.setState(state('pause'));
  h.controls.playback.click();
  assert.deepEqual(h.calls, ['pause']);
  assert.equal(h.controls.playback.getAttribute('data-cim-action'), 'play');
  assert.equal(h.reads, 2);
});

test('playback DOM mutation cannot redirect the fresh presentation-selected command', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  h.controls.playback.setAttribute('data-cim-action', 'restart');
  h.controls.playback.click();
  assert.deepEqual(h.calls, ['play']);
});

test('already default-prevented clicks yield without command submission or playback read', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  const reads = h.reads;
  h.controls.playback.click({ defaultPrevented: true });
  h.controls.next.click({ defaultPrevented: true });
  assert.deepEqual(h.calls, []);
  assert.equal(h.reads, reads);
});

test('native click path does not prevent default or stop propagation', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  h.controls.next.click({
    defaultPrevented: false,
    preventDefault() { throw new Error('must not prevent'); },
    stopPropagation() { throw new Error('must not stop'); }
  });
  assert.deepEqual(h.calls, ['next']);
});

test('rapid clicks forward every command without debounce coalescing serialization or gating', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  h.controls.next.click();
  h.controls.next.click();
  h.controls.previous.click();
  h.controls.next.click();
  assert.deepEqual(h.calls, ['next', 'next', 'previous', 'next']);
});

test('click does not automatically refresh presentation after command submission', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  const reads = h.reads;
  h.controls.next.click();
  assert.equal(h.reads, reads);
  assert.equal(h.controls.next.textContent, 'Next');
});

test('malformed presentation fails before refresh writes any control', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  const before = snapshotControls(h.controls);
  h.setState(state('play', { next: record('restart', 'Wrong') }));
  const binding = createTransportNativeButtonBinding;
  assert.throws(() => binding({ controls: h.controls, presentation: h.presentation, commands: h.commands }), /state.next.action/);
  for (const key of CONTROL_KEYS) {
    assert.equal(h.controls[key].textContent, before[key].textContent);
    assert.deepEqual([...h.controls[key].attributes], [...before[key].attributes]);
  }
});

test('refresh DOM write failure rolls back every checkpoint-owned field', () => {
  const h = harness();
  const binding = createTransportNativeButtonBinding(h.options());
  const before = snapshotControls(h.controls);
  h.setState(state('pause'));
  h.controls.home.failAttributeOnce = 'data-cim-action';
  assert.throws(() => binding.refresh(), /write failure/);
  for (const key of CONTROL_KEYS) {
    assert.equal(h.controls[key].textContent, before[key].textContent);
    assert.deepEqual([...h.controls[key].attributes], [...before[key].attributes]);
  }
});

test('partial listener installation failure removes installed listeners and restores constructor DOM', () => {
  const h = harness();
  const before = snapshotControls(h.controls);
  h.controls.home.failAdd = true;
  assert.throws(() => createTransportNativeButtonBinding(h.options()), /add failure/);
  for (const key of CONTROL_KEYS) {
    assert.equal(h.controls[key].listeners.size, 0);
    assert.equal(h.controls[key].textContent, before[key].textContent);
    assert.deepEqual([...h.controls[key].attributes], [...before[key].attributes]);
  }
});

test('dispose removes only binding click listeners and is idempotent after success', () => {
  const h = harness();
  const binding = createTransportNativeButtonBinding(h.options());
  binding.dispose();
  binding.dispose();
  h.controls.next.click();
  assert.deepEqual(h.calls, []);
  for (const control of Object.values(h.controls)) assert.deepEqual(control.removeCalls, ['click']);
});

test('dispose remains retryable after one listener removal fails', () => {
  const h = harness();
  const binding = createTransportNativeButtonBinding(h.options());
  h.controls.end.failRemoveOnce = true;
  assert.throws(() => binding.dispose(), /remove failure/);
  assert.equal(h.controls.end.listeners.has('click'), true);
  binding.dispose();
  assert.equal(h.controls.end.listeners.has('click'), false);
});

test('controls must be an exact frozen plain record of distinct native buttons', () => {
  const h = harness();
  assert.throws(() => createTransportNativeButtonBinding({
    controls: { ...h.controls }, presentation: h.presentation, commands: h.commands
  }), /controls must be frozen/);

  const duplicate = Object.freeze({ ...h.controls, restart: h.controls.end });
  assert.throws(() => createTransportNativeButtonBinding({
    controls: duplicate, presentation: h.presentation, commands: h.commands
  }), /distinct/);

  const wrong = harness();
  wrong.controls.next.type = 'submit';
  assert.throws(() => createTransportNativeButtonBinding(wrong.options()), /type button/);
});

test('command authority must be exact frozen and cannot widen to the full controller', () => {
  const h = harness();
  assert.throws(() => createTransportNativeButtonBinding({
    controls: h.controls,
    presentation: h.presentation,
    commands: Object.freeze({ ...h.commands, marker: () => null })
  }), /exactly/);
  assert.throws(() => createTransportNativeButtonBinding({
    controls: h.controls,
    presentation: h.presentation,
    commands: { ...h.commands }
  }), /must be frozen/);
});

test('presentation authority must remain the exact frozen read surface', () => {
  const h = harness();
  assert.throws(() => createTransportNativeButtonBinding({
    controls: h.controls,
    presentation: Object.freeze({ read: h.presentation.read, events: {} }),
    commands: h.commands
  }), /exactly/);
});

test('malformed playback action fails closed before playback command submission', () => {
  const h = harness();
  createTransportNativeButtonBinding(h.options());
  h.setState(state('play', { playback: record('restart', 'Restart') }));
  assert.throws(() => h.controls.playback.click(), /state.playback.action/);
  assert.deepEqual(h.calls, []);
});

test('synchronous command failure is propagated without local acceptance policy', () => {
  const h = harness();
  const commands = Object.freeze({
    ...h.commands,
    next() { throw new Error('runtime rejection transport'); }
  });
  createTransportNativeButtonBinding({ controls: h.controls, presentation: h.presentation, commands });
  assert.throws(() => h.controls.next.click(), /runtime rejection transport/);
});
