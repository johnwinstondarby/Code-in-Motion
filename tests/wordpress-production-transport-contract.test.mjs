import assert from 'node:assert/strict';
import test from 'node:test';

import { assertWordPressProductionTransportComposition } from '../tools/check-wordpress-production-transport-composition.mjs';

const CONTROL_KEYS = ['home', 'previous', 'playback', 'next', 'end', 'restart'];
const VISIBLE_CONTROL_ORDER = ['home', 'previous', 'playback', 'next', 'end'];
const BUTTON_LABELS = {
  play: 'Play',
  pause: 'Pause',
  previous: 'Previous',
  next: 'Next',
  home: 'Start',
  end: 'End',
  restart: 'Restart'
};

function declaration({
  controlKeys = CONTROL_KEYS,
  visibleControlOrder = VISIBLE_CONTROL_ORDER,
  buttonLabels = BUTTON_LABELS
} = {}) {
  return {
    controlKeys: Object.freeze([...controlKeys]),
    visibleControlOrder: Object.freeze([...visibleControlOrder]),
    buttonLabels: Object.freeze({ ...buttonLabels })
  };
}

test('R40 production Transport composition accepts the pinned declaration', () => {
  assert.equal(assertWordPressProductionTransportComposition(declaration()), true);
});

test('R40 production Transport composition rejects missing playback', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      controlKeys: ['home', 'previous', 'next', 'end', 'restart']
    })),
    /control keys must be exactly/
  );
});

test('R40 production Transport composition rejects an extra wired control', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      controlKeys: [...CONTROL_KEYS, 'scrub']
    })),
    /control keys must be exactly/
  );
});

test('R40 production Transport composition rejects duplicate wired controls', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      controlKeys: ['home', 'previous', 'playback', 'next', 'end', 'restart', 'restart']
    })),
    /must not contain duplicate controls/
  );
});

test('R40 production Transport composition rejects wired-control order drift', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      controlKeys: ['previous', 'home', 'playback', 'next', 'end', 'restart']
    })),
    /control keys must be exactly/
  );
});

test('R40 production Transport composition rejects restart in the visible row', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      visibleControlOrder: [...VISIBLE_CONTROL_ORDER, 'restart']
    })),
    /visible control order must be exactly/
  );
});

test('R40 production Transport composition rejects visible-control membership drift', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      visibleControlOrder: ['home', 'previous', 'playback', 'restart', 'end']
    })),
    /visible control order must be exactly/
  );
});

test('R40 production Transport composition rejects visible-control order drift', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      visibleControlOrder: ['home', 'playback', 'previous', 'next', 'end']
    })),
    /visible control order must be exactly/
  );
});

test('R40 production Transport composition rejects learner-facing label drift', () => {
  assert.throws(
    () => assertWordPressProductionTransportComposition(declaration({
      buttonLabels: { ...BUTTON_LABELS, home: 'Home' }
    })),
    /button label home must be "Start"/
  );
});

test('R40 production Transport composition rejects mutable declarations', () => {
  const actual = declaration();
  actual.controlKeys = [...CONTROL_KEYS];
  assert.throws(
    () => assertWordPressProductionTransportComposition(actual),
    /control keys must be frozen/
  );
});
