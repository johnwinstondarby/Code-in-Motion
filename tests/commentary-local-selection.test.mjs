import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMENTARY_SELECTION_CONTROLLER_KEYS,
  COMMENTARY_SELECTION_ENTRY_KEYS,
  COMMENTARY_SELECTION_STATE_KEYS,
  createCommentarySelectionController
} from '../src/commentary/selection-controller.mjs';

function entry(stepId, index) {
  return Object.freeze({
    stepId,
    index,
    text: `${stepId} text`,
    links: Object.freeze([])
  });
}

function revealState(frontier, ids) {
  return Object.freeze({
    revealFrontier: frontier,
    entries: Object.freeze(ids.map((stepId, offset) => entry(stepId, offset + 1)))
  });
}

function harness(initial = revealState('initial', [])) {
  let state = initial;
  const reveal = Object.freeze({ read: () => state });
  const controller = createCommentarySelectionController({ reveal });
  return {
    reveal,
    controller,
    set(stateInput) {
      state = stateInput;
    }
  };
}

test('Commentary selection controller and projected state are exact and frozen', () => {
  const h = harness(revealState('step-02', ['step-01', 'step-02']));
  const state = h.controller.read();

  assert.deepEqual(Object.keys(h.controller), COMMENTARY_SELECTION_CONTROLLER_KEYS);
  assert.deepEqual(Object.keys(state), COMMENTARY_SELECTION_STATE_KEYS);
  assert.equal(Object.isFrozen(h.controller), true);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.entries), true);
  for (const projected of state.entries) {
    assert.deepEqual(Object.keys(projected), COMMENTARY_SELECTION_ENTRY_KEYS);
    assert.equal(Object.isFrozen(projected), true);
  }
});

test('visibility and Commentary-local selection are independent axes', () => {
  const h = harness(revealState('step-03', ['step-01', 'step-02', 'step-03']));
  const before = h.controller.read();
  assert.equal(before.selectedStepId, null);
  assert.deepEqual(before.entries.map((entry) => entry.selected), [false, false, false]);

  const selected = h.controller.select('step-02');
  assert.equal(selected.revealFrontier, 'step-03');
  assert.equal(selected.selectedStepId, 'step-02');
  assert.deepEqual(selected.entries.map((entry) => entry.selected), [false, true, false]);
});

test('selection may name only a currently visible Commentary entry', () => {
  const h = harness(revealState('step-01', ['step-01']));
  assert.throws(() => h.controller.select('step-02'), /currently visible entry/);
  assert.equal(h.controller.read().selectedStepId, null);
});

test('repeated selection is idempotent local state and emits no semantic outcome envelope', () => {
  const h = harness(revealState('step-02', ['step-01', 'step-02']));
  const first = h.controller.select('step-02');
  const second = h.controller.select('step-02');

  assert.equal(first.selectedStepId, 'step-02');
  assert.equal(second.selectedStepId, 'step-02');
  assert.equal('result' in second, false);
  assert.equal('commandId' in second, false);
  assert.equal('transitionId' in second, false);
});

test('backward navigation and Home preserve local selection while the entry stays revealed', () => {
  const h = harness(revealState('step-03', ['step-01', 'step-02', 'step-03']));
  h.controller.select('step-02');

  h.set(revealState('step-03', ['step-01', 'step-02', 'step-03']));
  const afterBackwardMovement = h.controller.read();
  assert.equal(afterBackwardMovement.selectedStepId, 'step-02');
});

test('Restart-shaped visibility automatically clears a now-hidden local selection', () => {
  const h = harness(revealState('step-02', ['step-01', 'step-02']));
  h.controller.select('step-02');

  h.set(revealState('initial', []));
  const state = h.controller.read();
  assert.equal(state.selectedStepId, null);
  assert.deepEqual(state.entries, []);
});

test('selection reconciliation occurs only after a valid fresh reveal read', () => {
  let state = revealState('step-01', ['step-01']);
  const reveal = Object.freeze({ read: () => state });
  const controller = createCommentarySelectionController({ reveal });
  controller.select('step-01');

  state = Object.freeze({ revealFrontier: 'initial', entries: [] });
  assert.throws(() => controller.read(), /frozen array/);

  state = revealState('step-01', ['step-01']);
  assert.equal(controller.read().selectedStepId, 'step-01');
});

test('clear removes only Commentary-local selection and returns fresh visible state', () => {
  const h = harness(revealState('step-02', ['step-01', 'step-02']));
  h.controller.select('step-01');
  h.set(revealState('step-03', ['step-01', 'step-02', 'step-03']));

  const state = h.controller.clear();
  assert.equal(state.revealFrontier, 'step-03');
  assert.equal(state.selectedStepId, null);
  assert.deepEqual(state.entries.map((entry) => entry.selected), [false, false, false]);
});

test('selection controller receives only the exact frozen checkpoint #1 read capability', () => {
  const read = () => revealState('initial', []);

  assert.throws(
    () => createCommentarySelectionController({ reveal: Object.freeze({ read, select() {} }) }),
    /must contain exactly: read/
  );
  assert.throws(
    () => createCommentarySelectionController({ reveal: { read } }),
    /must be frozen/
  );
});

test('malformed reveal state fails closed without changing existing selection', () => {
  let state = revealState('step-01', ['step-01']);
  const reveal = Object.freeze({ read: () => state });
  const controller = createCommentarySelectionController({ reveal });
  controller.select('step-01');

  state = Object.freeze({ revealFrontier: 'initial', entries: Object.freeze([entry('step-01', 1)]) });
  const malformedEntry = Object.freeze({ stepId: 'step-01', index: 0, text: 'bad', links: Object.freeze([]) });
  state = Object.freeze({ revealFrontier: 'step-01', entries: Object.freeze([malformedEntry]) });
  assert.throws(() => controller.read(), /strictly increasing positive integer/);

  state = revealState('step-01', ['step-01']);
  assert.equal(controller.read().selectedStepId, 'step-01');
});

test('selection surface owns no Runtime Transport command event or DOM authority', () => {
  const controller = harness(revealState('step-01', ['step-01'])).controller;
  for (const key of ['seek', 'marker', 'subscribe', 'events', 'snapshot', 'runtime', 'transport', 'element', 'dispose']) {
    assert.equal(key in controller, false);
  }
});
