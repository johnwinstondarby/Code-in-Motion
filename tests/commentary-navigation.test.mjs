import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE } from '../src/contracts/events.mjs';
import {
  COMMENTARY_NAVIGATION_KEYS,
  createCommentaryNavigation
} from '../src/commentary/navigation.mjs';

test('Commentary navigation is exact frozen and pins commentary command provenance', () => {
  const calls = [];
  const outcome = Object.freeze({ result: 'opaque' });
  const navigation = createCommentaryNavigation(Object.freeze({
    seek(stepId, source) {
      calls.push([stepId, source]);
      return outcome;
    }
  }));

  assert.deepEqual(Object.keys(navigation), COMMENTARY_NAVIGATION_KEYS);
  assert.equal(Object.isFrozen(navigation), true);
  assert.strictEqual(navigation.seek('step-02'), outcome);
  assert.deepEqual(calls, [['step-02', COMMAND_SOURCE.COMMENTARY]]);
});

test('Commentary navigation rejects widened mutable accessor-backed or non-function command ports', () => {
  const seek = () => null;
  assert.throws(() => createCommentaryNavigation({ seek }), /must be frozen/);
  assert.throws(() => createCommentaryNavigation(Object.freeze({ seek, play() {} })), /must contain exactly: seek/);
  assert.throws(() => createCommentaryNavigation(Object.freeze({ seek: 1 })), /must be a function/);

  let invoked = false;
  const accessor = {};
  Object.defineProperty(accessor, 'seek', {
    enumerable: true,
    get() {
      invoked = true;
      return seek;
    }
  });
  Object.freeze(accessor);
  assert.throws(() => createCommentaryNavigation(accessor), /enumerable data property/);
  assert.equal(invoked, false);
});

test('Commentary navigation validates semantic identity before forwarding', () => {
  let calls = 0;
  const navigation = createCommentaryNavigation(Object.freeze({ seek() { calls += 1; } }));
  assert.throws(() => navigation.seek(''), /non-empty string/);
  assert.throws(() => navigation.seek(null), /non-empty string/);
  assert.equal(calls, 0);
});
