import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REDUCED_MOTION_MEDIA_QUERY,
  REDUCED_MOTION_PREFERENCE_KEYS,
  createReducedMotionPreference
} from '../src/accessibility/reduced-motion-preference.mjs';

function harness(initialMatches = false) {
  let matches = initialMatches;
  const calls = [];
  const mediaQueryList = {};
  Object.defineProperty(mediaQueryList, 'matches', {
    enumerable: true,
    configurable: false,
    get() {
      return matches;
    }
  });

  const preference = createReducedMotionPreference({
    matchMedia(query) {
      calls.push(query);
      return mediaQueryList;
    }
  });

  return {
    preference,
    calls,
    mediaQueryList,
    setMatches(value) {
      matches = value;
    }
  };
}

test('reduced-motion preference capability is exact frozen and queries the canonical media feature once', () => {
  const h = harness(false);

  assert.deepEqual(Object.keys(h.preference), REDUCED_MOTION_PREFERENCE_KEYS);
  assert.equal(Object.isFrozen(h.preference), true);
  assert.deepEqual(h.calls, [REDUCED_MOTION_MEDIA_QUERY]);
  assert.equal(h.preference.read(), false);
  assert.deepEqual(h.calls, [REDUCED_MOTION_MEDIA_QUERY]);
});

test('read returns true when prefers-reduced-motion reduce matches', () => {
  assert.equal(harness(true).preference.read(), true);
});

test('read reflects the fresh live MediaQueryList matches value without reconstructing the capability', () => {
  const h = harness(false);
  assert.equal(h.preference.read(), false);

  h.setMatches(true);
  assert.equal(h.preference.read(), true);

  h.setMatches(false);
  assert.equal(h.preference.read(), false);
  assert.deepEqual(h.calls, [REDUCED_MOTION_MEDIA_QUERY]);
});

test('construction fails closed when matchMedia does not return a media-query object', () => {
  for (const value of [null, undefined, false, 0, 'query']) {
    assert.throws(
      () => createReducedMotionPreference({ matchMedia: () => value }),
      /must return a media-query object/
    );
  }
});

test('construction validates the initial matches value', () => {
  for (const matches of [undefined, null, 0, 1, 'true']) {
    assert.throws(
      () => createReducedMotionPreference({ matchMedia: () => ({ matches }) }),
      /matches must be boolean/
    );
  }
});

test('fresh malformed matches state fails closed on read without cached fallback state', () => {
  let matches = false;
  const mediaQueryList = {};
  Object.defineProperty(mediaQueryList, 'matches', {
    enumerable: true,
    get() {
      return matches;
    }
  });
  const preference = createReducedMotionPreference({ matchMedia: () => mediaQueryList });

  assert.equal(preference.read(), false);
  matches = 'false';
  assert.throws(() => preference.read(), /matches must be boolean/);
  matches = true;
  assert.equal(preference.read(), true);
});

test('native matches getter failures propagate rather than silently choosing a motion policy', () => {
  let failRead = false;
  const mediaQueryList = {};
  Object.defineProperty(mediaQueryList, 'matches', {
    enumerable: true,
    get() {
      if (failRead) throw new Error('matches read failed');
      return false;
    }
  });
  const preference = createReducedMotionPreference({ matchMedia: () => mediaQueryList });
  failRead = true;
  assert.throws(() => preference.read(), /matches read failed/);
});

test('options reject widened symbol accessor mutable-shape substitutions and non-function matchMedia', () => {
  const matchMedia = () => ({ matches: false });

  assert.throws(
    () => createReducedMotionPreference({ matchMedia, extra: true }),
    /must contain exactly: matchMedia/
  );

  const withSymbol = { matchMedia };
  withSymbol[Symbol('extra')] = true;
  assert.throws(
    () => createReducedMotionPreference(withSymbol),
    /must not contain symbol keys/
  );

  const accessor = {};
  Object.defineProperty(accessor, 'matchMedia', {
    enumerable: true,
    get() {
      return matchMedia;
    }
  });
  assert.throws(
    () => createReducedMotionPreference(accessor),
    /must be an enumerable data property/
  );

  assert.throws(
    () => createReducedMotionPreference({ matchMedia: true }),
    /matchMedia must be a function/
  );
});

test('constructor does not subscribe to MediaQueryList events or gain browser-global ownership', () => {
  const calls = [];
  const mediaQueryList = {
    matches: false,
    addEventListener(...args) {
      calls.push(['addEventListener', ...args]);
    },
    addListener(...args) {
      calls.push(['addListener', ...args]);
    }
  };

  const preference = createReducedMotionPreference({ matchMedia: () => mediaQueryList });
  assert.equal(preference.read(), false);
  assert.deepEqual(calls, []);
});

test('capability owns no Runtime Core renderer Transport Commentary DOM listener or disposal authority', () => {
  const preference = harness().preference;
  for (const key of [
    'runtime', 'core', 'renderer', 'transport', 'commentary', 'seek', 'play', 'pause',
    'subscribe', 'addEventListener', 'removeEventListener', 'dispose', 'window', 'document'
  ]) {
    assert.equal(key in preference, false);
  }
});
