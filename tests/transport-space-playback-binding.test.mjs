import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRANSPORT_KEYBOARD_BINDING_KEYS,
  TRANSPORT_PLAYBACK_KEYBOARD_OPTIONS_KEYS,
  createTransportPlaybackKeyboardBinding
} from '../src/transport/keyboard-binding.mjs';

class FakeDocument {
  constructor() {
    this.selection = { isCollapsed: true };
  }

  getSelection() {
    return this.selection;
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
  key = ' ',
  repeat = false,
  path = [root],
  defaultPrevented = false,
  isComposing = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false
} = {}) {
  let prevented = 0;
  return {
    key,
    repeat,
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

function makeHarness(actions = ['play']) {
  const ownerDocument = new FakeDocument();
  const root = new FakeRoot(ownerDocument);
  const timelineKeys = [];
  const playbackCalls = [];
  let reads = 0;

  const playbackPresentation = Object.freeze({
    read() {
      const action = actions[Math.min(reads, actions.length - 1)];
      reads += 1;
      return Object.freeze({ action });
    }
  });

  const options = {
    root,
    timelineKey(key) {
      timelineKeys.push(key);
      return Object.freeze({ key });
    },
    playbackKey(key, action) {
      playbackCalls.push([key, action]);
      return Object.freeze({ key, action });
    },
    playbackPresentation
  };

  const binding = createTransportPlaybackKeyboardBinding(options);
  return {
    ownerDocument,
    root,
    timelineKeys,
    playbackCalls,
    playbackPresentation,
    binding,
    readCount: () => reads
  };
}

test('playback keyboard binding keeps one exact frozen listener surface', () => {
  const { root, binding } = makeHarness();

  assert.deepEqual(Object.keys(binding), TRANSPORT_KEYBOARD_BINDING_KEYS);
  assert.equal(Object.isFrozen(binding), true);
  assert.equal(root.adds.length, 1);
  assert.equal(root.adds[0][0], 'keydown');
});

test('Space reads a fresh projected action and submits play or pause exactly once', () => {
  const { root, playbackCalls, readCount } = makeHarness(['play', 'pause']);

  const first = fakeEvent({ root });
  root.dispatch(first);
  assert.equal(first.preventedCount(), 1);
  assert.deepEqual(playbackCalls, [[' ', 'play']]);
  assert.equal(readCount(), 1);

  const second = fakeEvent({ root });
  root.dispatch(second);
  assert.equal(second.preventedCount(), 1);
  assert.deepEqual(playbackCalls, [[' ', 'play'], [' ', 'pause']]);
  assert.equal(readCount(), 2);
});

test('Space auto-repeat is ignored without reading presentation or preventing default', () => {
  const { root, playbackCalls, readCount } = makeHarness(['play']);
  const event = fakeEvent({ root, repeat: true });

  root.dispatch(event);

  assert.equal(event.preventedCount(), 0);
  assert.deepEqual(playbackCalls, []);
  assert.equal(readCount(), 0);
});

test('timeline key repeat remains eligible and never reads playback presentation', () => {
  const { root, timelineKeys, readCount } = makeHarness(['pause']);
  const event = fakeEvent({ root, key: 'ArrowRight', repeat: true });

  root.dispatch(event);

  assert.equal(event.preventedCount(), 1);
  assert.deepEqual(timelineKeys, ['ArrowRight']);
  assert.equal(readCount(), 0);
});

test('legacy Spacebar key is outside the exact v1 playback keyboard contract', () => {
  const { root, playbackCalls, readCount } = makeHarness(['play']);
  const event = fakeEvent({ root, key: 'Spacebar' });

  root.dispatch(event);

  assert.equal(event.preventedCount(), 0);
  assert.deepEqual(playbackCalls, []);
  assert.equal(readCount(), 0);
});

test('Space on a native descendant yields so native button activation cannot double-submit', () => {
  const { root, playbackCalls, readCount } = makeHarness(['play']);
  const button = fakeNode({ tagName: 'BUTTON' });
  const event = fakeEvent({ root, path: [button, root] });

  root.dispatch(event);

  assert.equal(event.preventedCount(), 0);
  assert.deepEqual(playbackCalls, []);
  assert.equal(readCount(), 0);
});

test('Space inherits checkpoint 4 native-yield rules before presentation is read', async (t) => {
  const variants = [
    ['input', ({ root }) => fakeEvent({ root, path: [fakeNode({ tagName: 'INPUT' }), root] })],
    ['contenteditable', ({ root }) => fakeEvent({ root, path: [fakeNode({ isContentEditable: true }), root] })],
    ['modifier', ({ root }) => fakeEvent({ root, ctrlKey: true })],
    ['composition', ({ root }) => fakeEvent({ root, isComposing: true })],
    ['default prevented', ({ root }) => fakeEvent({ root, defaultPrevented: true })],
    ['outside root', ({ root }) => fakeEvent({ root, path: [fakeNode()] })]
  ];

  for (const [name, buildEvent] of variants) {
    await t.test(name, () => {
      const harness = makeHarness(['play']);
      const event = buildEvent(harness);
      harness.root.dispatch(event);
      assert.equal(event.preventedCount(), 0);
      assert.deepEqual(harness.playbackCalls, []);
      assert.equal(harness.readCount(), 0);
    });
  }
});

test('active text selection yields Space before presentation is read', () => {
  const { ownerDocument, root, playbackCalls, readCount } = makeHarness(['play']);
  ownerDocument.selection = { isCollapsed: false };
  const event = fakeEvent({ root });

  root.dispatch(event);

  assert.equal(event.preventedCount(), 0);
  assert.deepEqual(playbackCalls, []);
  assert.equal(readCount(), 0);
});

test('presentation read failure and malformed projected state fail closed', async (t) => {
  const cases = [
    ['read throws', Object.freeze({ read() { throw new Error('projection failed'); } })],
    ['mutable state', Object.freeze({ read() { return { action: 'play' }; } })],
    ['extra state field', Object.freeze({ read() { return Object.freeze({ action: 'play', extra: true }); } })],
    ['accessor action', Object.freeze({ read() {
      const state = {};
      Object.defineProperty(state, 'action', { enumerable: true, get: () => 'play' });
      return Object.freeze(state);
    } })],
    ['unknown action', Object.freeze({ read() { return Object.freeze({ action: 'toggle' }); } })]
  ];

  for (const [name, playbackPresentation] of cases) {
    await t.test(name, () => {
      const ownerDocument = new FakeDocument();
      const root = new FakeRoot(ownerDocument);
      const playbackCalls = [];
      const binding = createTransportPlaybackKeyboardBinding({
        root,
        timelineKey() {},
        playbackKey(key, action) {
          playbackCalls.push([key, action]);
        },
        playbackPresentation
      });
      assert.equal(Object.isFrozen(binding), true);

      const event = fakeEvent({ root });
      root.dispatch(event);
      assert.equal(event.preventedCount(), 0);
      assert.deepEqual(playbackCalls, []);
    });
  }
});

test('playback integration construction rejects widened or malformed authority', () => {
  const ownerDocument = new FakeDocument();
  const root = new FakeRoot(ownerDocument);
  const timelineKey = () => null;
  const playbackKey = () => null;
  const playbackPresentation = Object.freeze({ read: () => Object.freeze({ action: 'play' }) });
  const valid = { root, timelineKey, playbackKey, playbackPresentation };

  assert.deepEqual(Object.keys(valid), TRANSPORT_PLAYBACK_KEYBOARD_OPTIONS_KEYS);
  assert.throws(
    () => createTransportPlaybackKeyboardBinding({ ...valid, extra: () => null }),
    /must contain exactly/
  );
  assert.throws(
    () => createTransportPlaybackKeyboardBinding({ root, timelineKey, playbackKey }),
    /must contain exactly/
  );
  assert.throws(
    () => createTransportPlaybackKeyboardBinding({ ...valid, playbackKey: 1 }),
    /playbackKey capability must be a function/
  );
  assert.throws(
    () => createTransportPlaybackKeyboardBinding({ ...valid, playbackPresentation: { read() {} } }),
    /presentation must be frozen/
  );
  assert.throws(
    () => createTransportPlaybackKeyboardBinding({
      ...valid,
      playbackPresentation: Object.freeze({ read() {}, extra: true })
    }),
    /presentation must contain exactly: read/
  );
});

test('playback binding disposal remains scoped and idempotent', () => {
  const { root, playbackCalls, binding } = makeHarness(['play']);
  const installed = root.adds[0][1];

  assert.equal(binding.dispose(), null);
  assert.equal(binding.dispose(), null);
  assert.deepEqual(root.removes, [['keydown', installed]]);

  root.dispatch(fakeEvent({ root }));
  assert.deepEqual(playbackCalls, []);
});
