import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRANSPORT_PLAYBACK_OBSERVATION_PORT_KEYS,
  TRANSPORT_PLAYBACK_PRESENTATION_KEYS,
  TRANSPORT_PLAYBACK_STATE_KEYS,
  assertTransportPlaybackObservationPort,
  createTransportPlaybackPresentation
} from '../src/transport/playback-presentation.mjs';

function frozenSnapshot(status, playbackIntent) {
  return Object.freeze({
    canonical: Object.freeze({ status }),
    operational: Object.freeze({ playbackIntent })
  });
}

function observationPort(snapshotFactory) {
  return Object.freeze({
    snapshot: snapshotFactory
  });
}

test('playback observation port and presentation surfaces are exact and frozen', () => {
  const port = observationPort(() => frozenSnapshot('idle', false));
  const presentation = createTransportPlaybackPresentation(port);

  assert.equal(assertTransportPlaybackObservationPort(port), port);
  assert.deepEqual(Object.keys(port), TRANSPORT_PLAYBACK_OBSERVATION_PORT_KEYS);
  assert.equal(Object.isFrozen(port), true);
  assert.deepEqual(Object.keys(presentation), TRANSPORT_PLAYBACK_PRESENTATION_KEYS);
  assert.equal(Object.isFrozen(presentation), true);

  const state = presentation.read();
  assert.deepEqual(Object.keys(state), TRANSPORT_PLAYBACK_STATE_KEYS);
  assert.equal(Object.isFrozen(state), true);
});

test('playback action follows playback intent except paused always resumes with play', async (t) => {
  const cases = [
    ['idle', false, 'play'],
    ['idle with inconsistent intent', true, 'pause'],
    ['playing', true, 'pause'],
    ['playing without intent', false, 'play'],
    ['playback transition', true, 'pause'],
    ['discrete transition', false, 'play'],
    ['paused playback', true, 'play'],
    ['paused discrete transition', false, 'play'],
    ['faulted', false, 'play'],
    ['disposed', false, 'play']
  ];

  for (const [name, playbackIntent, expectedAction] of cases) {
    await t.test(name, () => {
      const status = name.startsWith('idle')
        ? 'idle'
        : name.startsWith('playing')
          ? 'playing'
          : name.includes('transition')
            ? 'transitioning'
            : name.startsWith('paused')
              ? 'paused'
              : name;
      const presentation = createTransportPlaybackPresentation(
        observationPort(() => frozenSnapshot(status, playbackIntent))
      );
      assert.deepEqual(presentation.read(), { action: expectedAction });
    });
  }
});

test('presentation reads a fresh Runtime snapshot and does not cache playback action', () => {
  let snapshot = frozenSnapshot('idle', false);
  const presentation = createTransportPlaybackPresentation(observationPort(() => snapshot));

  assert.deepEqual(presentation.read(), { action: 'play' });

  snapshot = frozenSnapshot('transitioning', true);
  assert.deepEqual(presentation.read(), { action: 'pause' });

  snapshot = frozenSnapshot('paused', true);
  assert.deepEqual(presentation.read(), { action: 'play' });
});

test('status alone cannot make a transitioning command look like continuous playback', () => {
  const discrete = createTransportPlaybackPresentation(
    observationPort(() => frozenSnapshot('transitioning', false))
  );
  const playback = createTransportPlaybackPresentation(
    observationPort(() => frozenSnapshot('transitioning', true))
  );

  assert.equal(discrete.read().action, 'play');
  assert.equal(playback.read().action, 'pause');
});

test('paused status wins over playback intent because play resumes preserved work', () => {
  const presentation = createTransportPlaybackPresentation(
    observationPort(() => frozenSnapshot('paused', true))
  );

  assert.equal(presentation.read().action, 'play');
});

test('the complete Runtime read surface is rejected instead of widening playback observation authority', () => {
  const fullReadSurface = Object.freeze({
    snapshot: () => frozenSnapshot('idle', false),
    boundaryIds: () => Object.freeze(['initial', 'step-01'])
  });

  assert.throws(
    () => createTransportPlaybackPresentation(fullReadSurface),
    /exactly: snapshot/
  );
});

test('observation port rejects symbols accessors mutable objects and non-functions', () => {
  const validSnapshot = () => frozenSnapshot('idle', false);

  const withSymbol = { snapshot: validSnapshot };
  withSymbol[Symbol('extra')] = 1;
  Object.freeze(withSymbol);
  assert.throws(() => createTransportPlaybackPresentation(withSymbol), /symbol keys/);

  const accessor = {};
  Object.defineProperty(accessor, 'snapshot', { enumerable: true, get: () => validSnapshot });
  Object.freeze(accessor);
  assert.throws(() => createTransportPlaybackPresentation(accessor), /function data property/);

  assert.throws(
    () => createTransportPlaybackPresentation({ snapshot: validSnapshot }),
    /must be frozen/
  );
  assert.throws(
    () => createTransportPlaybackPresentation(Object.freeze({ snapshot: 1 })),
    /function data property/
  );
});

test('snapshot structure is descriptor-safe and accessors are never invoked', () => {
  let getterCalls = 0;
  const snapshot = {};
  Object.defineProperty(snapshot, 'canonical', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return Object.freeze({ status: 'idle' });
    }
  });
  Object.defineProperty(snapshot, 'operational', {
    enumerable: true,
    value: Object.freeze({ playbackIntent: false })
  });
  Object.freeze(snapshot);

  const presentation = createTransportPlaybackPresentation(observationPort(() => snapshot));
  assert.throws(() => presentation.read(), /canonical must be an enumerable data property/);
  assert.equal(getterCalls, 0);
});

test('malformed nested playback facts fail closed', async (t) => {
  const cases = [
    ['unknown status', frozenSnapshot('future-state', false), /known session status/],
    ['nonboolean playback intent', frozenSnapshot('idle', 'false'), /must be boolean/],
    [
      'mutable canonical',
      Object.freeze({
        canonical: { status: 'idle' },
        operational: Object.freeze({ playbackIntent: false })
      }),
      /canonical snapshot must be frozen/
    ],
    [
      'mutable operational',
      Object.freeze({
        canonical: Object.freeze({ status: 'idle' }),
        operational: { playbackIntent: false }
      }),
      /operational snapshot must be frozen/
    ]
  ];

  for (const [name, snapshot, expected] of cases) {
    await t.test(name, () => {
      const presentation = createTransportPlaybackPresentation(observationPort(() => snapshot));
      assert.throws(() => presentation.read(), expected);
    });
  }
});

test('playback presentation exposes no command event boundary or Runtime authority', () => {
  const presentation = createTransportPlaybackPresentation(
    observationPort(() => frozenSnapshot('playing', true))
  );

  assert.deepEqual(Object.keys(presentation), ['read']);
  assert.equal('play' in presentation, false);
  assert.equal('pause' in presentation, false);
  assert.equal('snapshot' in presentation, false);
  assert.equal('boundaryIds' in presentation, false);
  assert.equal('events' in presentation, false);
  assert.equal('dispose' in presentation, false);
});
