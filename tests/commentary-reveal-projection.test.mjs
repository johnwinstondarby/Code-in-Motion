import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMENTARY_ENTRY_KEYS,
  COMMENTARY_OBSERVATION_KEYS,
  COMMENTARY_REVEAL_PROJECTION_KEYS,
  COMMENTARY_REVEAL_STATE_KEYS,
  createCommentaryRevealProjection
} from '../src/commentary/reveal-projection.mjs';

const BOUNDARY_IDS = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);
const ENTRIES = Object.freeze([
  Object.freeze({
    stepId: 'step-01',
    text: 'First explanation.',
    links: Object.freeze([
      Object.freeze({ id: 'one', label: 'First link', href: '/one' })
    ])
  }),
  Object.freeze({
    stepId: 'step-02',
    text: 'Second explanation.',
    links: Object.freeze([])
  }),
  Object.freeze({
    stepId: 'step-03',
    text: 'Third explanation.',
    links: Object.freeze([
      Object.freeze({ id: 'three', label: 'Third link', href: 'https://example.com/three' })
    ])
  })
]);

function makeHarness(initialFrontier = 'initial') {
  let revealFrontier = initialFrontier;
  let currentStepId = initialFrontier;
  const observation = Object.freeze({
    snapshot() {
      return Object.freeze({
        canonical: Object.freeze({
          currentStepId,
          revealFrontier
        }),
        operational: Object.freeze({ ignored: true })
      });
    }
  });
  const projection = createCommentaryRevealProjection({
    boundaryIds: BOUNDARY_IDS,
    observation,
    entries: ENTRIES
  });
  return {
    observation,
    projection,
    setFrontier(stepId) {
      revealFrontier = stepId;
    },
    setCurrent(stepId) {
      currentStepId = stepId;
    }
  };
}

test('Commentary reveal projection surface and state are exact and frozen', () => {
  const h = makeHarness('step-02');
  const state = h.projection.read();

  assert.deepEqual(Object.keys(h.observation), COMMENTARY_OBSERVATION_KEYS);
  assert.deepEqual(Object.keys(h.projection), COMMENTARY_REVEAL_PROJECTION_KEYS);
  assert.deepEqual(Object.keys(state), COMMENTARY_REVEAL_STATE_KEYS);
  assert.equal(Object.isFrozen(h.projection), true);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.entries), true);
  for (const entry of state.entries) {
    assert.deepEqual(Object.keys(entry), COMMENTARY_ENTRY_KEYS);
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.links), true);
  }
});

test('initial frontier exposes no authored commentary', () => {
  const state = makeHarness().projection.read();
  assert.equal(state.revealFrontier, 'initial');
  assert.deepEqual(state.entries, []);
});

test('frontier exposes the authored commentary prefix in semantic order', () => {
  const h = makeHarness('step-02');
  const state = h.projection.read();

  assert.equal(state.revealFrontier, 'step-02');
  assert.deepEqual(state.entries.map(({ stepId, index }) => [stepId, index]), [
    ['step-01', 1],
    ['step-02', 2]
  ]);
  assert.equal(state.entries[0].text, 'First explanation.');
  assert.deepEqual(state.entries[0].links[0], {
    id: 'one',
    label: 'First link',
    href: '/one'
  });
});

test('backward canonical movement does not re-hide entries below the reveal frontier', () => {
  const h = makeHarness('step-03');
  h.setCurrent('step-01');

  const state = h.projection.read();
  assert.equal(state.revealFrontier, 'step-03');
  assert.deepEqual(state.entries.map((entry) => entry.stepId), ['step-01', 'step-02', 'step-03']);
});

test('projection reads a fresh frontier on every read and restart-shaped state hides authored history', () => {
  const h = makeHarness('step-01');
  assert.deepEqual(h.projection.read().entries.map((entry) => entry.stepId), ['step-01']);

  h.setFrontier('step-03');
  assert.deepEqual(h.projection.read().entries.map((entry) => entry.stepId), ['step-01', 'step-02', 'step-03']);

  h.setFrontier('initial');
  assert.deepEqual(h.projection.read().entries, []);
});

test('targeted-entry shaped frontier immediately exposes the prefix through the target', () => {
  const state = makeHarness('step-02').projection.read();
  assert.deepEqual(state.entries.map((entry) => entry.stepId), ['step-01', 'step-02']);
});

test('Commentary projection owns no selection command event DOM or Runtime surface', () => {
  const projection = makeHarness('step-01').projection;
  for (const key of ['select', 'seek', 'subscribe', 'events', 'dispose', 'snapshot', 'runtime', 'transport']) {
    assert.equal(key in projection, false);
  }
});

test('observation authority must remain exact frozen snapshot-only capability', () => {
  const snapshot = () => Object.freeze({ canonical: Object.freeze({ revealFrontier: 'initial' }) });

  assert.throws(
    () => createCommentaryRevealProjection({
      boundaryIds: BOUNDARY_IDS,
      observation: Object.freeze({ snapshot, boundaryIds: () => BOUNDARY_IDS }),
      entries: ENTRIES
    }),
    /must contain exactly: snapshot/
  );

  assert.throws(
    () => createCommentaryRevealProjection({
      boundaryIds: BOUNDARY_IDS,
      observation: { snapshot },
      entries: ENTRIES
    }),
    /must be frozen/
  );
});

test('authored commentary metadata must align exactly with semantic boundary order', () => {
  const observation = Object.freeze({
    snapshot: () => Object.freeze({ canonical: Object.freeze({ revealFrontier: 'initial' }) })
  });

  assert.throws(
    () => createCommentaryRevealProjection({
      boundaryIds: BOUNDARY_IDS,
      observation,
      entries: Object.freeze(ENTRIES.slice(0, 2))
    }),
    /align one-for-one/
  );

  const wrongOrder = Object.freeze([ENTRIES[1], ENTRIES[0], ENTRIES[2]]);
  assert.throws(
    () => createCommentaryRevealProjection({ boundaryIds: BOUNDARY_IDS, observation, entries: wrongOrder }),
    /align with canonical boundary order/
  );
});

test('entry and link accessors, mutation, or widened data fail closed without invocation', () => {
  const observation = Object.freeze({
    snapshot: () => Object.freeze({ canonical: Object.freeze({ revealFrontier: 'initial' }) })
  });
  let invoked = false;
  const accessorEntry = {};
  Object.defineProperties(accessorEntry, {
    stepId: { enumerable: true, get() { invoked = true; return 'step-01'; } },
    text: { enumerable: true, value: 'text' },
    links: { enumerable: true, value: Object.freeze([]) }
  });
  Object.freeze(accessorEntry);

  assert.throws(
    () => createCommentaryRevealProjection({
      boundaryIds: Object.freeze(['initial', 'step-01']),
      observation,
      entries: Object.freeze([accessorEntry])
    }),
    /enumerable data property/
  );
  assert.equal(invoked, false);

  assert.throws(
    () => createCommentaryRevealProjection({
      boundaryIds: Object.freeze(['initial', 'step-01']),
      observation,
      entries: Object.freeze([Object.freeze({ stepId: 'step-01', text: 'x', links: [], extra: true })])
    }),
    /must contain exactly/
  );
});

test('unknown or malformed reveal frontier fails closed', () => {
  let revealFrontier = 'unknown';
  const observation = Object.freeze({
    snapshot() {
      return Object.freeze({ canonical: Object.freeze({ revealFrontier }) });
    }
  });
  const projection = createCommentaryRevealProjection({ boundaryIds: BOUNDARY_IDS, observation, entries: ENTRIES });

  assert.throws(() => projection.read(), /not a known semantic boundary/);
  revealFrontier = '';
  assert.throws(() => projection.read(), /must be a non-empty string/);
});
