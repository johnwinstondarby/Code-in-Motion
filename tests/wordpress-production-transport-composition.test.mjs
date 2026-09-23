import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createWordPressTransportBinding } from '../wordpress/assets/transport-binding.mjs';

const bindingSource = readFileSync(
  new URL('../wordpress/assets/transport-binding.mjs', import.meta.url),
  'utf8'
);

function makeRoot() {
  const attributes = new Map();
  const listeners = new Map();

  const root = {
    ownerDocument: {
      getSelection() {
        return { isCollapsed: true };
      }
    },
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
    dispatchKey(key, { repeat = false } = {}) {
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
          return [root];
        },
        preventDefault() {
          prevented = true;
        }
      };
      listener(event);
      return { prevented };
    }
  };

  return root;
}

function makeCommandPort(calls) {
  function record(name, args) {
    calls.push({ name, args });
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

test('R36 WordPress Transport imports the exact production composition subset', () => {
  const transportImports = [...bindingSource.matchAll(/from '([^']+)'/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.includes('/transport/'));

  assert.deepEqual(transportImports, [
    '../../src/transport/keyboard-binding.mjs',
    '../../src/transport/playback-presentation.mjs',
    '../../src/transport/transport-controller.mjs'
  ]);
  assert.match(bindingSource, /createTransportPlaybackKeyboardBinding/);
  assert.match(bindingSource, /createTransportPlaybackPresentation/);
  assert.doesNotMatch(bindingSource, /createTransportKeyboardBinding/);
});

test('R36 WordPress Transport exposes timeline navigation and Space playback from Runtime observation', () => {
  const calls = [];
  const root = makeRoot();
  const observation = makeObservationPort();
  const binding = createWordPressTransportBinding({
    root,
    commandPort: makeCommandPort(calls),
    observationPort: observation.port
  });

  assert.equal(root.getAttribute('tabindex'), '0');

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

  calls.length = 0;
  observation.set('transitioning', true);
  const pauseResult = root.dispatchKey(' ');
  assert.equal(pauseResult.prevented, true);
  assert.deepEqual(calls, [
    { name: 'pause', args: ['transport'] }
  ]);

  calls.length = 0;
  const repeatResult = root.dispatchKey(' ', { repeat: true });
  assert.equal(repeatResult.prevented, false);
  assert.deepEqual(calls, []);

  assert.equal(binding.dispose(), null);
  assert.equal(root.getAttribute('tabindex'), null);

  const disposedResult = root.dispatchKey('ArrowRight');
  assert.equal(disposedResult.prevented, false);
  assert.deepEqual(calls, []);
});
