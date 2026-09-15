import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSPORT_BUTTON_PRESENTATION_KEYS,
  TRANSPORT_BUTTON_RECORD_KEYS,
  TRANSPORT_BUTTON_STATE_KEYS,
  createTransportButtonPresentation
} from '../src/transport/button-presentation.mjs';

function makeLabels(overrides = {}) {
  return Object.freeze({
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous',
    next: 'Next',
    home: 'Home',
    end: 'End',
    restart: 'Restart',
    ...overrides
  });
}

function harness(initialAction = 'play') {
  let action = initialAction;
  let reads = 0;
  const playbackPresentation = Object.freeze({
    read() {
      reads += 1;
      return Object.freeze({ action });
    }
  });
  return {
    playbackPresentation,
    labels: makeLabels(),
    setAction(value) { action = value; },
    get reads() { return reads; },
    options() { return { playbackPresentation, labels: this.labels }; }
  };
}

test('button presentation surface state and records are exact and frozen', () => {
  const h = harness();
  const presentation = createTransportButtonPresentation(h.options());
  assert.deepEqual(Object.keys(presentation), TRANSPORT_BUTTON_PRESENTATION_KEYS);
  assert.ok(Object.isFrozen(presentation));

  const state = presentation.read();
  assert.deepEqual(Object.keys(state), TRANSPORT_BUTTON_STATE_KEYS);
  assert.ok(Object.isFrozen(state));
  for (const key of TRANSPORT_BUTTON_STATE_KEYS) {
    assert.deepEqual(Object.keys(state[key]), TRANSPORT_BUTTON_RECORD_KEYS);
    assert.ok(Object.isFrozen(state[key]));
  }
});

test('playback record selects the configured play label', () => {
  const h = harness('play');
  const state = createTransportButtonPresentation(h.options()).read();
  assert.deepEqual(state.playback, { action: 'play', label: 'Play' });
});

test('playback record selects the configured pause label', () => {
  const h = harness('pause');
  const state = createTransportButtonPresentation(h.options()).read();
  assert.deepEqual(state.playback, { action: 'pause', label: 'Pause' });
});

test('each presentation read obtains a fresh playback action', () => {
  const h = harness('play');
  const presentation = createTransportButtonPresentation(h.options());
  assert.equal(presentation.read().playback.action, 'play');
  h.setAction('pause');
  assert.equal(presentation.read().playback.action, 'pause');
  assert.equal(h.reads, 2);
});

test('static transport records preserve exact action and learner-facing labels', () => {
  const h = harness();
  const state = createTransportButtonPresentation(h.options()).read();
  assert.deepEqual(state.previous, { action: 'previous', label: 'Previous' });
  assert.deepEqual(state.next, { action: 'next', label: 'Next' });
  assert.deepEqual(state.home, { action: 'home', label: 'Home' });
  assert.deepEqual(state.end, { action: 'end', label: 'End' });
  assert.deepEqual(state.restart, { action: 'restart', label: 'Restart' });
});

test('presentation exposes no availability policy or command authority', () => {
  const h = harness();
  const presentation = createTransportButtonPresentation(h.options());
  const state = presentation.read();
  for (const record of Object.values(state)) {
    assert.equal('enabled' in record, false);
    assert.equal('disabled' in record, false);
    assert.equal('available' in record, false);
    assert.equal('blocked' in record, false);
  }
  assert.equal('play' in presentation, false);
  assert.equal('pause' in presentation, false);
  assert.equal('events' in presentation, false);
  assert.equal('dispose' in presentation, false);
  assert.equal('runtime' in presentation, false);
});

test('labels must be exact frozen non-empty data and accessors are never invoked', () => {
  const h = harness();
  assert.throws(() => createTransportButtonPresentation({
    playbackPresentation: h.playbackPresentation,
    labels: { ...h.labels }
  }), /must be frozen/);

  assert.throws(() => createTransportButtonPresentation({
    playbackPresentation: h.playbackPresentation,
    labels: Object.freeze({ ...h.labels, extra: 'x' })
  }), /exactly/);

  assert.throws(() => createTransportButtonPresentation({
    playbackPresentation: h.playbackPresentation,
    labels: makeLabels({ next: '   ' })
  }), /non-empty string/);

  let invoked = false;
  const labels = {};
  for (const key of Object.keys(h.labels)) {
    Object.defineProperty(labels, key, key === 'play'
      ? {
          enumerable: true,
          get() {
            invoked = true;
            return 'Play';
          }
        }
      : { enumerable: true, value: h.labels[key] });
  }
  Object.freeze(labels);
  assert.throws(() => createTransportButtonPresentation({
    playbackPresentation: h.playbackPresentation,
    labels
  }), /enumerable data property/);
  assert.equal(invoked, false);
});

test('playback presentation must remain exact frozen authority', () => {
  const h = harness();
  assert.throws(() => createTransportButtonPresentation({
    playbackPresentation: Object.freeze({
      read: h.playbackPresentation.read,
      snapshot: () => null
    }),
    labels: h.labels
  }), /exactly/);

  assert.throws(() => createTransportButtonPresentation({
    playbackPresentation: { read: h.playbackPresentation.read },
    labels: h.labels
  }), /must be frozen/);
});

test('malformed playback output fails closed before returning presentation state', () => {
  const labels = makeLabels();
  const unknown = createTransportButtonPresentation({
    playbackPresentation: Object.freeze({ read: () => Object.freeze({ action: 'toggle' }) }),
    labels
  });
  assert.throws(() => unknown.read(), /play or pause/);

  const widened = createTransportButtonPresentation({
    playbackPresentation: Object.freeze({
      read: () => Object.freeze({ action: 'play', enabled: true })
    }),
    labels
  });
  assert.throws(() => widened.read(), /exactly/);
});
