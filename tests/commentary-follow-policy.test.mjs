import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMENTARY_FOLLOW_CONTROLLER_KEYS,
  COMMENTARY_FOLLOW_STATE_KEYS,
  createCommentaryFollowController
} from '../src/commentary/follow-controller.mjs';

function link(id = 'link-1') {
  return Object.freeze({ id, label: `Link ${id}`, href: `https://example.test/${id}` });
}

function entry(stepId, index, { selected = false, active = false } = {}) {
  return Object.freeze({
    stepId,
    index,
    text: `${stepId} text`,
    links: Object.freeze(index === 1 ? [link()] : []),
    selected,
    active
  });
}

function state(ids, { currentStepId, selectedStepId = null, entryCount = 4 } = {}) {
  const resolvedCurrent = currentStepId ?? (ids.length === 0 ? 'initial' : ids[ids.length - 1]);
  const entries = ids.map((stepId, offset) => entry(stepId, offset + 1, {
    selected: stepId === selectedStepId,
    active: stepId === resolvedCurrent
  }));
  return Object.freeze({
    revealFrontier: ids.length === 0 ? 'initial' : ids[ids.length - 1],
    currentStepId: resolvedCurrent,
    selectedStepId,
    entryCount,
    entries: Object.freeze(entries)
  });
}

function harness(initial = state([])) {
  let projected = initial;
  const presentation = Object.freeze({ read: () => projected });
  const controller = createCommentaryFollowController({ presentation });
  return {
    presentation,
    controller,
    set(next) {
      projected = next;
    }
  };
}

test('Commentary follow controller and projected state are exact and frozen', () => {
  const h = harness(state(['step-01']));
  const projected = h.controller.read();

  assert.deepEqual(Object.keys(h.controller), COMMENTARY_FOLLOW_CONTROLLER_KEYS);
  assert.deepEqual(Object.keys(projected), COMMENTARY_FOLLOW_STATE_KEYS);
  assert.equal(Object.isFrozen(h.controller), true);
  assert.equal(Object.isFrozen(projected), true);
});

test('Commentary follows by default and tracks the newest visible entry', () => {
  const h = harness(state([]));
  assert.deepEqual(h.controller.read(), {
    following: true,
    newerStepsAvailable: false,
    latestVisibleStepId: null
  });

  h.set(state(['step-01']));
  assert.deepEqual(h.controller.read(), {
    following: true,
    newerStepsAvailable: false,
    latestVisibleStepId: 'step-01'
  });

  h.set(state(['step-01', 'step-02']));
  assert.equal(h.controller.read().latestVisibleStepId, 'step-02');
});

test('suspension freezes reveal acknowledgement and later reveal raises newer-steps indication', () => {
  const h = harness(state(['step-01']));
  assert.deepEqual(h.controller.suspend(), {
    following: false,
    newerStepsAvailable: false,
    latestVisibleStepId: 'step-01'
  });

  h.set(state(['step-01', 'step-02']));
  assert.deepEqual(h.controller.read(), {
    following: false,
    newerStepsAvailable: true,
    latestVisibleStepId: 'step-02'
  });
});

test('repeated suspension does not acknowledge newer revealed entries', () => {
  const h = harness(state(['step-01']));
  h.controller.suspend();
  h.set(state(['step-01', 'step-02']));

  assert.equal(h.controller.read().newerStepsAvailable, true);
  assert.equal(h.controller.suspend().newerStepsAvailable, true);
  assert.equal(h.controller.read().newerStepsAvailable, true);
});

test('resume acknowledges the current frontier and clears newer-steps indication', () => {
  const h = harness(state(['step-01']));
  h.controller.suspend();
  h.set(state(['step-01', 'step-02', 'step-03']));
  assert.equal(h.controller.read().newerStepsAvailable, true);

  const resumed = h.controller.resume();
  assert.deepEqual(resumed, {
    following: true,
    newerStepsAvailable: false,
    latestVisibleStepId: 'step-03'
  });
  assert.equal(h.controller.read().newerStepsAvailable, false);
});

test('backward canonical movement does not create newer steps when reveal history is unchanged', () => {
  const h = harness(state(['step-01', 'step-02', 'step-03'], { currentStepId: 'step-03' }));
  h.controller.suspend();

  h.set(state(['step-01', 'step-02', 'step-03'], { currentStepId: 'step-01' }));
  const projected = h.controller.read();
  assert.equal(projected.following, false);
  assert.equal(projected.newerStepsAvailable, false);
  assert.equal(projected.latestVisibleStepId, 'step-03');
});

test('Restart-shaped reveal contraction rebases suspended acknowledgement without forcing follow mode', () => {
  const h = harness(state(['step-01', 'step-02', 'step-03']));
  h.controller.suspend();

  h.set(state([]));
  assert.deepEqual(h.controller.read(), {
    following: false,
    newerStepsAvailable: false,
    latestVisibleStepId: null
  });

  h.set(state(['step-01']));
  assert.deepEqual(h.controller.read(), {
    following: false,
    newerStepsAvailable: true,
    latestVisibleStepId: 'step-01'
  });
});

test('suspend before first read establishes the current frontier as the acknowledged baseline', () => {
  const h = harness(state(['step-01', 'step-02']));
  const suspended = h.controller.suspend();
  assert.equal(suspended.following, false);
  assert.equal(suspended.newerStepsAvailable, false);

  h.set(state(['step-01', 'step-02', 'step-03']));
  assert.equal(h.controller.read().newerStepsAvailable, true);
});

test('follow policy receives only the exact frozen checkpoint 3 presentation read capability', () => {
  const read = () => state([]);

  assert.throws(
    () => createCommentaryFollowController({ presentation: Object.freeze({ read, select() {} }) }),
    /must contain exactly: read/
  );
  assert.throws(
    () => createCommentaryFollowController({ presentation: { read } }),
    /must be frozen/
  );
});

test('malformed presentation fails closed without acknowledging newly revealed state', () => {
  const h = harness(state(['step-01']));
  h.controller.suspend();

  h.set(Object.freeze({
    revealFrontier: 'step-02',
    currentStepId: 'step-02',
    selectedStepId: null,
    entryCount: 4,
    entries: [entry('step-01', 1), entry('step-02', 2, { active: true })]
  }));
  assert.throws(() => h.controller.read(), /frozen array/);

  h.set(state(['step-01', 'step-02']));
  assert.equal(h.controller.read().newerStepsAvailable, true);
});

test('presentation identity and active/selected consistency are revalidated at the follow boundary', () => {
  const badFrontier = Object.freeze({
    revealFrontier: 'step-01',
    currentStepId: 'step-02',
    selectedStepId: null,
    entryCount: 4,
    entries: Object.freeze([
      entry('step-01', 1),
      entry('step-02', 2, { active: true })
    ])
  });
  assert.throws(() => harness(badFrontier).controller.read(), /revealFrontier must identify the final visible entry/);

  const badActive = Object.freeze({
    revealFrontier: 'step-01',
    currentStepId: 'step-01',
    selectedStepId: null,
    entryCount: 4,
    entries: Object.freeze([entry('step-01', 1)])
  });
  assert.throws(() => harness(badActive).controller.read(), /currentStepId must identify exactly one visible active entry/);
});

test('follow policy owns no DOM navigation Runtime Transport event or renderer authority', () => {
  const controller = harness(state(['step-01'])).controller;
  for (const key of [
    'scroll', 'scrollTo', 'element', 'seek', 'marker', 'play', 'pause', 'snapshot',
    'subscribe', 'events', 'runtime', 'transport', 'renderer', 'dispose'
  ]) {
    assert.equal(key in controller, false);
  }
});
