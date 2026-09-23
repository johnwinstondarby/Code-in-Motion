import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createWordPressTransportBinding } from '../wordpress/assets/transport-binding.mjs';

const bindingSource = readFileSync(
  new URL('../wordpress/assets/transport-binding.mjs', import.meta.url),
  'utf8'
);

function makeDocument() {
  let nextFrame = 0;
  const frames = new Map();

  const document = {
    defaultView: {
      requestAnimationFrame(callback) {
        const handle = ++nextFrame;
        frames.set(handle, callback);
        return handle;
      },
      cancelAnimationFrame(handle) {
        frames.delete(handle);
      }
    },
    getSelection() {
      return { isCollapsed: true };
    },
    createElement(tagName) {
      return makeElement(tagName, document);
    },
    pendingFrames() {
      return frames.size;
    },
    runFrame() {
      const entry = frames.entries().next();
      if (entry.done) return false;
      const [handle, callback] = entry.value;
      frames.delete(handle);
      callback(16.67);
      return true;
    }
  };

  return document;
}

function makeElement(tagName, ownerDocument) {
  const attributes = new Map();
  const listeners = new Map();
  const children = [];

  const element = {
    tagName: String(tagName).toUpperCase(),
    type: '',
    textContent: '',
    ownerDocument,
    parentNode: null,
    children,
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    appendChild(child) {
      if (child.parentNode !== null) throw new Error('child already mounted');
      children.push(child);
      child.parentNode = element;
      return child;
    },
    removeChild(child) {
      const index = children.indexOf(child);
      if (index < 0) throw new Error('child is not mounted');
      children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    click() {
      const listener = listeners.get('click');
      if (listener === undefined) return;
      listener({ defaultPrevented: false });
    },
    dispatchKey(key, { repeat = false, path = [element] } = {}) {
      const listener = listeners.get('keydown');
      if (listener === undefined) return { prevented: false };

      let prevented = false;
      const event = {
        key,
        repeat,
        defaultPrevented: false,
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        composedPath() {
          return path;
        },
        preventDefault() {
          prevented = true;
        }
      };
      listener(event);
      return { prevented };
    }
  };

  return element;
}

function makeRoot() {
  const document = makeDocument();
  const root = makeElement('div', document);
  return { root, document };
}

function playbackSnapshot(status, playbackIntent) {
  return Object.freeze({
    canonical: Object.freeze({ status }),
    operational: Object.freeze({ playbackIntent })
  });
}

function makeObservationPort() {
  let snapshot = playbackSnapshot('idle', false);
  return {
    port: Object.freeze({
      snapshot: () => snapshot
    }),
    set(status, playbackIntent) {
      snapshot = playbackSnapshot(status, playbackIntent);
    }
  };
}

function makeCommandPort(calls, observation) {
  function record(name, args) {
    calls.push({ name, args });
    if (name === 'play') observation.set('transitioning', true);
    if (name === 'pause') observation.set('paused', true);
    return Object.freeze({ result: 'success' });
  }

  return Object.freeze({
    play: (...args) => record('play', args),
    pause: (...args) => record('pause', args),
    next: (...args) => record('next', args),
    previous: (...args) => record('previous', args),
    seek: (...args) => record('seek', args),
    home: (...args) => record('home', args),
    end: (...args) => record('end', args),
    restart: (...args) => record('restart', args)
  });
}

function controlSurface(root) {
  return root.children.find((child) => child.getAttribute('data-cim-transport-controls') === '') ?? null;
}

function control(root, key) {
  const surface = controlSurface(root);
  if (surface === null) return null;
  return surface.children.find((child) => child.getAttribute('data-cim-control') === key) ?? null;
}

test('R38 WordPress Transport imports keyboard, playback, and native-button composition only', () => {
  const transportImports = [...bindingSource.matchAll(/from '([^']+)'/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.includes('/transport/'));

  assert.deepEqual(transportImports, [
    '../../src/transport/button-presentation.mjs',
    '../../src/transport/keyboard-binding.mjs',
    '../../src/transport/native-button-binding.mjs',
    '../../src/transport/playback-presentation.mjs',
    '../../src/transport/transport-controller.mjs'
  ]);
  assert.match(bindingSource, /createTransportPlaybackKeyboardBinding/);
  assert.match(bindingSource, /createTransportPlaybackPresentation/);
  assert.match(bindingSource, /createTransportButtonPresentation/);
  assert.match(bindingSource, /createTransportNativeButtonBinding/);
  assert.doesNotMatch(bindingSource, /createTransportKeyboardBinding/);
  assert.doesNotMatch(bindingSource, /createTransportTimeline/);
  assert.doesNotMatch(bindingSource, /createTransportScrubGesture/);
});

test('R38 WordPress Transport composes fixed native controls and keeps playback presentation fresh', () => {
  const calls = [];
  const { root, document } = makeRoot();
  const observation = makeObservationPort();
  const binding = createWordPressTransportBinding({
    root,
    commandPort: makeCommandPort(calls, observation),
    observationPort: observation.port
  });

  assert.equal(root.getAttribute('tabindex'), '0');
  assert.ok(controlSurface(root));
  assert.equal(controlSurface(root).getAttribute('role'), 'group');
  assert.equal(controlSurface(root).getAttribute('aria-label'), 'Code in Motion controls');

  for (const key of ['home', 'previous', 'playback', 'next', 'end', 'restart']) {
    const button = control(root, key);
    assert.ok(button, `missing ${key} control`);
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.type, 'button');
  }

  const playback = control(root, 'playback');
  assert.equal(playback.textContent, 'Play');
  assert.equal(playback.getAttribute('aria-label'), 'Play');
  assert.equal(playback.getAttribute('data-cim-action'), 'play');

  playback.click();
  assert.deepEqual(calls, [{ name: 'play', args: ['transport'] }]);
  assert.equal(playback.textContent, 'Pause');
  assert.equal(playback.getAttribute('data-cim-action'), 'pause');
  assert.equal(document.pendingFrames(), 1);

  observation.set('idle', false);
  assert.equal(document.runFrame(), true);
  assert.equal(playback.textContent, 'Play');
  assert.equal(playback.getAttribute('data-cim-action'), 'play');
  assert.equal(document.pendingFrames(), 0);

  calls.length = 0;
  control(root, 'previous').click();
  control(root, 'next').click();
  control(root, 'home').click();
  control(root, 'end').click();
  control(root, 'restart').click();
  assert.deepEqual(calls, [
    { name: 'previous', args: ['transport'] },
    { name: 'next', args: ['transport'] },
    { name: 'home', args: ['transport'] },
    { name: 'end', args: ['transport'] },
    { name: 'restart', args: ['transport'] }
  ]);

  assert.equal(binding.dispose(), null);
  assert.equal(root.getAttribute('tabindex'), null);
  assert.equal(controlSurface(root), null);
  assert.equal(document.pendingFrames(), 0);
});

test('R38 WordPress Transport preserves timeline keys and Space playback with control refresh', () => {
  const calls = [];
  const { root, document } = makeRoot();
  const observation = makeObservationPort();
  const binding = createWordPressTransportBinding({
    root,
    commandPort: makeCommandPort(calls, observation),
    observationPort: observation.port
  });

  const timelineResult = root.dispatchKey('ArrowRight');
  assert.equal(timelineResult.prevented, true);
  assert.deepEqual(calls, [
    { name: 'next', args: ['transport'] }
  ]);

  calls.length = 0;
  const playResult = root.dispatchKey(' ');
  assert.equal(playResult.prevented, true);
  assert.deepEqual(calls, [
    { name: 'play', args: ['transport'] }
  ]);
  assert.equal(control(root, 'playback').textContent, 'Pause');
  assert.equal(document.pendingFrames(), 1);

  calls.length = 0;
  const pauseResult = root.dispatchKey(' ');
  assert.equal(pauseResult.prevented, true);
  assert.deepEqual(calls, [
    { name: 'pause', args: ['transport'] }
  ]);
  assert.equal(control(root, 'playback').textContent, 'Play');
  assert.equal(document.pendingFrames(), 0);

  calls.length = 0;
  const repeatResult = root.dispatchKey(' ', { repeat: true });
  assert.equal(repeatResult.prevented, false);
  assert.deepEqual(calls, []);

  assert.equal(binding.dispose(), null);

  const disposedResult = root.dispatchKey('ArrowRight');
  assert.equal(disposedResult.prevented, false);
  assert.deepEqual(calls, []);
});
