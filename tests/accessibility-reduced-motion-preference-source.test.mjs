import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REDUCED_MOTION_MEDIA_QUERY,
  REDUCED_MOTION_PREFERENCE_KEYS
} from '../src/accessibility/reduced-motion-preference.mjs';
import {
  REDUCED_MOTION_CHANGE_KEYS,
  REDUCED_MOTION_CHANGE_RECORD_KEYS,
  REDUCED_MOTION_PREFERENCE_SOURCE_KEYS,
  createReducedMotionPreferenceSource
} from '../src/accessibility/reduced-motion-preference-source.mjs';

function harness(initialMatches = false, hooks = {}) {
  let matches = initialMatches;
  let changeListener = null;
  const calls = [];

  const mediaQueryList = {};
  Object.defineProperty(mediaQueryList, 'matches', {
    enumerable: true,
    configurable: false,
    get() {
      if (hooks.readMatches) return hooks.readMatches(matches);
      return matches;
    }
  });

  mediaQueryList.addEventListener = function addEventListener(type, listener) {
    calls.push(['addEventListener', type, listener]);
    if (hooks.addEventListener) hooks.addEventListener(type, listener);
    changeListener = listener;
  };

  mediaQueryList.removeEventListener = function removeEventListener(type, listener) {
    calls.push(['removeEventListener', type, listener]);
    if (hooks.removeEventListener) hooks.removeEventListener(type, listener);
    if (changeListener === listener) changeListener = null;
  };

  mediaQueryList.addListener = function addListener(...args) {
    calls.push(['addListener', ...args]);
  };

  mediaQueryList.removeListener = function removeListener(...args) {
    calls.push(['removeListener', ...args]);
  };

  const matchMediaCalls = [];
  const source = createReducedMotionPreferenceSource({
    matchMedia(query) {
      matchMediaCalls.push(query);
      return mediaQueryList;
    }
  });

  return {
    source,
    calls,
    matchMediaCalls,
    mediaQueryList,
    setMatches(value) {
      matches = value;
    },
    dispatch(event = Object.freeze({ matches })) {
      return changeListener?.(event);
    },
    listener() {
      return changeListener;
    }
  };
}

test('reduced-motion preference source exposes split exact frozen preference and change capabilities', () => {
  const h = harness(false);

  assert.deepEqual(Object.keys(h.source), REDUCED_MOTION_PREFERENCE_SOURCE_KEYS);
  assert.deepEqual(Object.keys(h.source.preference), REDUCED_MOTION_PREFERENCE_KEYS);
  assert.deepEqual(Object.keys(h.source.changes), REDUCED_MOTION_CHANGE_KEYS);
  assert.equal(Object.isFrozen(h.source), true);
  assert.equal(Object.isFrozen(h.source.preference), true);
  assert.equal(Object.isFrozen(h.source.changes), true);

  assert.deepEqual(h.matchMediaCalls, [REDUCED_MOTION_MEDIA_QUERY]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'addEventListener');
  assert.equal(h.calls[0][1], 'change');
  assert.equal(typeof h.calls[0][2], 'function');
});

test('preference projection remains checkpoint 1 compatible and reads live state without another media query', () => {
  const h = harness(false);

  assert.equal(h.source.preference.read(), false);
  h.setMatches(true);
  assert.equal(h.source.preference.read(), true);
  h.setMatches(false);
  assert.equal(h.source.preference.read(), false);
  assert.deepEqual(h.matchMediaCalls, [REDUCED_MOTION_MEDIA_QUERY]);
});

test('change subscribers receive exact frozen current-state records rather than raw browser events', () => {
  const h = harness(false);
  const records = [];
  h.source.changes.subscribe((record) => records.push(record));

  h.setMatches(true);
  const rawEvent = Object.freeze({ matches: false, extra: 'browser-owned' });
  h.dispatch(rawEvent);

  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]), REDUCED_MOTION_CHANGE_RECORD_KEYS);
  assert.deepEqual(records[0], { reducedMotion: true });
  assert.equal(Object.isFrozen(records[0]), true);
  assert.notEqual(records[0], rawEvent);
});

test('subscriber unsubscribe is scoped frozen and idempotent', () => {
  const h = harness(false);
  const first = [];
  const second = [];
  const unsubscribeFirst = h.source.changes.subscribe((record) => first.push(record.reducedMotion));
  h.source.changes.subscribe((record) => second.push(record.reducedMotion));

  assert.equal(Object.isFrozen(unsubscribeFirst), true);
  assert.equal(unsubscribeFirst(), true);
  assert.equal(unsubscribeFirst(), false);

  h.setMatches(true);
  h.dispatch();

  assert.deepEqual(first, []);
  assert.deepEqual(second, [true]);
});

test('subscriber failures are isolated from other accessibility observers', () => {
  const h = harness(false);
  const observed = [];

  h.source.changes.subscribe(() => {
    throw new Error('subscriber failed');
  });
  h.source.changes.subscribe((record) => observed.push(record.reducedMotion));

  h.setMatches(true);
  assert.doesNotThrow(() => h.dispatch());
  assert.deepEqual(observed, [true]);
});

test('dispose removes only the owned change listener, closes notifications, and leaves synchronous preference reads usable', () => {
  const h = harness(false);
  const observed = [];
  h.source.changes.subscribe((record) => observed.push(record.reducedMotion));
  const ownedListener = h.listener();

  assert.equal(h.source.changes.dispose(), true);
  assert.equal(h.source.changes.dispose(), false);
  assert.equal(h.listener(), null);

  const removeCalls = h.calls.filter(([name]) => name === 'removeEventListener');
  assert.equal(removeCalls.length, 1);
  assert.equal(removeCalls[0][1], 'change');
  assert.equal(removeCalls[0][2], ownedListener);

  h.setMatches(true);
  h.dispatch();
  assert.deepEqual(observed, []);
  assert.equal(h.source.preference.read(), true);

  const afterClose = h.source.changes.subscribe(() => observed.push('late'));
  assert.equal(Object.isFrozen(afterClose), true);
  assert.equal(afterClose(), false);
});

test('dispose remains retryable when native listener removal fails', () => {
  let removeAttempts = 0;
  const h = harness(false, {
    removeEventListener() {
      removeAttempts += 1;
      if (removeAttempts === 1) throw new Error('remove failed');
    }
  });
  const observed = [];
  h.source.changes.subscribe((record) => observed.push(record.reducedMotion));

  assert.throws(() => h.source.changes.dispose(), /remove failed/);
  assert.equal(h.listener() === null, false);

  h.setMatches(true);
  h.dispatch();
  assert.deepEqual(observed, [true]);

  assert.equal(h.source.changes.dispose(), true);
  assert.equal(h.listener(), null);
  assert.equal(removeAttempts, 2);
});

test('construction requires modern change-event methods and never falls back to legacy MediaQueryList listeners', () => {
  const base = { matches: false };

  assert.throws(
    () => createReducedMotionPreferenceSource({
      matchMedia: () => ({ ...base, removeEventListener() {} })
    }),
    /addEventListener must be a function/
  );

  assert.throws(
    () => createReducedMotionPreferenceSource({
      matchMedia: () => ({ ...base, addEventListener() {} })
    }),
    /removeEventListener must be a function/
  );

  const legacyCalls = [];
  const mediaQueryList = {
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener(...args) {
      legacyCalls.push(['addListener', ...args]);
    },
    removeListener(...args) {
      legacyCalls.push(['removeListener', ...args]);
    }
  };
  const source = createReducedMotionPreferenceSource({ matchMedia: () => mediaQueryList });
  source.changes.dispose();
  assert.deepEqual(legacyCalls, []);
});

test('listener-installation failure attempts scoped rollback and preserves the original failure', () => {
  const listenerRefs = [];
  const mediaQueryList = {
    matches: false,
    addEventListener(type, listener) {
      listenerRefs.push(['add', type, listener]);
      throw new Error('install failed');
    },
    removeEventListener(type, listener) {
      listenerRefs.push(['remove', type, listener]);
    }
  };

  assert.throws(
    () => createReducedMotionPreferenceSource({ matchMedia: () => mediaQueryList }),
    /install failed/
  );
  assert.equal(listenerRefs.length, 2);
  assert.equal(listenerRefs[0][0], 'add');
  assert.equal(listenerRefs[1][0], 'remove');
  assert.equal(listenerRefs[0][1], 'change');
  assert.equal(listenerRefs[1][1], 'change');
  assert.equal(listenerRefs[0][2], listenerRefs[1][2]);
});

test('malformed live matches state fails closed before notifying subscribers', () => {
  const h = harness(false);
  const observed = [];
  h.source.changes.subscribe((record) => observed.push(record));

  h.setMatches('true');
  assert.throws(() => h.dispatch(), /matches must be boolean/);
  assert.deepEqual(observed, []);

  h.setMatches(true);
  h.dispatch();
  assert.deepEqual(observed, [{ reducedMotion: true }]);
});

test('source options reject widened symbol accessor and non-function matchMedia authority', () => {
  const makeMediaQuery = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });
  const matchMedia = makeMediaQuery;

  assert.throws(
    () => createReducedMotionPreferenceSource({ matchMedia, extra: true }),
    /must contain exactly: matchMedia/
  );

  const withSymbol = { matchMedia };
  withSymbol[Symbol('extra')] = true;
  assert.throws(
    () => createReducedMotionPreferenceSource(withSymbol),
    /must not contain symbol keys/
  );

  const accessor = {};
  Object.defineProperty(accessor, 'matchMedia', {
    enumerable: true,
    get() {
      throw new Error('must not invoke');
    }
  });
  assert.throws(
    () => createReducedMotionPreferenceSource(accessor),
    /must be an enumerable data property/
  );

  assert.throws(
    () => createReducedMotionPreferenceSource({ matchMedia: true }),
    /matchMedia must be a function/
  );
});

test('change subscription validates listeners and exposes no Runtime Core renderer Transport Commentary or raw browser authority', () => {
  const h = harness(false);
  assert.throws(() => h.source.changes.subscribe(true), /subscriber must be a function/);

  for (const surface of [h.source, h.source.preference, h.source.changes]) {
    for (const key of [
      'runtime', 'core', 'renderer', 'transport', 'commentary', 'seek', 'play', 'pause',
      'initialize', 'events', 'emit', 'window', 'document', 'matchMedia', 'mediaQueryList',
      'addEventListener', 'removeEventListener'
    ]) {
      assert.equal(key in surface, false);
    }
  }
});
