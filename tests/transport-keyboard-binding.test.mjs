import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRANSPORT_KEYBOARD_BINDING_KEYS,
  createTransportKeyboardBinding
} from '../src/transport/keyboard-binding.mjs';

class FakeDocument {
  constructor() {
    this.selection = { isCollapsed: true };
    this.listenerCalls = 0;
  }

  getSelection() {
    return this.selection;
  }

  addEventListener() {
    this.listenerCalls += 1;
  }
}

class FakeRoot {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.listeners = new Map();
    this.adds = [];
    this.removes = [];
  }

  addEventListener(type, listener) {
    this.adds.push([type, listener]);
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    this.removes.push([type, listener]);
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  dispatch(event) {
    this.listeners.get('keydown')?.(event);
  }
}

function fakeNode({ tagName = 'DIV', attrs = {}, isContentEditable = false } = {}) {
  return {
    tagName,
    isContentEditable,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    }
  };
}

function fakeEvent({
  root,
  key = 'ArrowRight',
  path = [root],
  defaultPrevented = false,
  isComposing = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false
}) {
  let prevented = 0;
  return {
    key,
    defaultPrevented,
    isComposing,
    altKey,
    ctrlKey,
    metaKey,
    shiftKey,
    composedPath() {
      return path;
    },
    preventDefault() {
      prevented += 1;
    },
    preventedCount() {
      return prevented;
    }
  };
}

function makeHarness() {
  const ownerDocument = new FakeDocument();
  const root = new FakeRoot(ownerDocument);
  const keys = [];
  const binding = createTransportKeyboardBinding({
    root,
    timelineKey(key) {
      keys.push(key);
      return Object.freeze({ key });
    }
  });
  return { ownerDocument, root, keys, binding };
}

test('keyboard binding surface is exact frozen and installs only one scoped keydown listener', () => {
  const { ownerDocument, root, binding } = makeHarness();

  assert.deepEqual(Object.keys(binding), TRANSPORT_KEYBOARD_BINDING_KEYS);
  assert.equal(Object.isFrozen(binding), true);
  assert.equal(root.adds.length, 1);
  assert.equal(root.adds[0][0], 'keydown');
  assert.equal(ownerDocument.listenerCalls, 0);
});

test('unmodified timeline keys dispatch exactly once and prevent native page movement', () => {
  const { root, keys } = makeHarness();

  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    const event = fakeEvent({ root, key });
    root.dispatch(event);
    assert.equal(event.preventedCount(), 1);
  }

  assert.deepEqual(keys, ['ArrowLeft', 'ArrowRight', 'Home', 'End']);
});

test('unmapped keys including Space remain outside checkpoint 4 DOM dispatch', () => {
  const { root, keys } = makeHarness();

  for (const key of [' ', 'Enter', 'PageUp', 'a']) {
    const event = fakeEvent({ root, key });
    root.dispatch(event);
    assert.equal(event.preventedCount(), 0);
  }

  assert.deepEqual(keys, []);
});

test('modifier chords default-prevented events and IME composition yield to native behavior', () => {
  const { root, keys } = makeHarness();

  const variants = [
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { defaultPrevented: true },
    { isComposing: true }
  ];

  for (const variant of variants) {
    const event = fakeEvent({ root, ...variant });
    root.dispatch(event);
    assert.equal(event.preventedCount(), 0);
  }

  assert.deepEqual(keys, []);
});

test('events whose composed path does not include the scoped root are ignored', () => {
  const { root, keys } = makeHarness();
  const event = fakeEvent({ root, path: [fakeNode()] });

  root.dispatch(event);

  assert.deepEqual(keys, []);
  assert.equal(event.preventedCount(), 0);
});

test('native and editing descendants keep keyboard ownership', async (t) => {
  const cases = [
    ['input', fakeNode({ tagName: 'INPUT' })],
    ['textarea', fakeNode({ tagName: 'TEXTAREA' })],
    ['button', fakeNode({ tagName: 'BUTTON' })],
    ['link', fakeNode({ tagName: 'A' })],
    ['contenteditable property', fakeNode({ isContentEditable: true })],
    ['contenteditable attribute', fakeNode({ attrs: { contenteditable: '' } })],
    ['tabindex descendant', fakeNode({ attrs: { tabindex: '0' } })],
    ['interactive role', fakeNode({ attrs: { role: 'slider' } })],
    ['fallback role token list', fakeNode({ attrs: { role: 'future-widget slider' } })],
    ['explicit native opt-out', fakeNode({ attrs: { 'data-cim-keyboard-native': '' } })]
  ];

  for (const [name, target] of cases) {
    await t.test(name, () => {
      const { root, keys } = makeHarness();
      const event = fakeEvent({ root, path: [target, root] });

      root.dispatch(event);

      assert.deepEqual(keys, []);
      assert.equal(event.preventedCount(), 0);
    });
  }
});

test('noninteractive descendants do not block scoped timeline navigation', () => {
  const { root, keys } = makeHarness();
  const label = fakeNode({ tagName: 'SPAN' });
  const event = fakeEvent({ root, path: [label, root] });

  root.dispatch(event);

  assert.deepEqual(keys, ['ArrowRight']);
  assert.equal(event.preventedCount(), 1);
});

test('active text selection yields timeline keys while a collapsed selection permits them', () => {
  const { ownerDocument, root, keys } = makeHarness();

  ownerDocument.selection = { isCollapsed: false };
  const selected = fakeEvent({ root });
  root.dispatch(selected);
  assert.equal(selected.preventedCount(), 0);
  assert.deepEqual(keys, []);

  ownerDocument.selection = { isCollapsed: true };
  const collapsed = fakeEvent({ root });
  root.dispatch(collapsed);
  assert.equal(collapsed.preventedCount(), 1);
  assert.deepEqual(keys, ['ArrowRight']);
});

test('selection inspection failure fails closed', () => {
  const { ownerDocument, root, keys } = makeHarness();
  ownerDocument.getSelection = () => {
    throw new Error('selection unavailable');
  };
  const event = fakeEvent({ root });

  root.dispatch(event);

  assert.deepEqual(keys, []);
  assert.equal(event.preventedCount(), 0);
});

test('dispose removes only the installed scoped listener and is idempotent', () => {
  const { root, keys, binding } = makeHarness();
  const installed = root.adds[0][1];

  assert.equal(binding.dispose(), null);
  assert.equal(binding.dispose(), null);
  assert.equal(root.removes.length, 1);
  assert.deepEqual(root.removes[0], ['keydown', installed]);

  root.dispatch(fakeEvent({ root }));
  assert.deepEqual(keys, []);
});

test('construction rejects widened or malformed option authority', () => {
  const ownerDocument = new FakeDocument();
  const root = new FakeRoot(ownerDocument);
  const timelineKey = () => null;

  assert.throws(() => createTransportKeyboardBinding({ root, timelineKey, extra: () => null }), /exactly/);
  assert.throws(() => createTransportKeyboardBinding({ root }), /exactly/);
  assert.throws(() => createTransportKeyboardBinding({ root, timelineKey: 1 }), /function/);
  assert.throws(() => createTransportKeyboardBinding({ root: {}, timelineKey }), /addEventListener/);

  const accessor = {};
  Object.defineProperty(accessor, 'root', { enumerable: true, get: () => root });
  Object.defineProperty(accessor, 'timelineKey', { enumerable: true, value: timelineKey });
  assert.throws(() => createTransportKeyboardBinding(accessor), /data property/);
});
