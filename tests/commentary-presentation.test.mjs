import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMENTARY_PRESENTATION_ENTRY_KEYS,
  COMMENTARY_PRESENTATION_KEYS,
  COMMENTARY_PRESENTATION_STATE_KEYS,
  createCommentaryPresentation
} from '../src/commentary/presentation.mjs';

function link(id = 'link-1') {
  return Object.freeze({ id, label: `Label ${id}`, href: `/${id}` });
}

function entry(stepId, index, selected = false) {
  return Object.freeze({
    stepId,
    index,
    text: `${stepId} text`,
    links: Object.freeze(index === 1 ? [link()] : []),
    selected
  });
}

function selectionState({ frontier = 'initial', selectedStepId = null, ids = [] } = {}) {
  return Object.freeze({
    revealFrontier: frontier,
    selectedStepId,
    entries: Object.freeze(ids.map((stepId, offset) => entry(stepId, offset + 1, stepId === selectedStepId)))
  });
}

function harness({ state = selectionState(), currentStepId = 'initial', entryCount = 3 } = {}) {
  let selectionValue = state;
  let current = currentStepId;
  const selection = Object.freeze({
    read: () => selectionValue,
    select() {},
    clear() {}
  });
  const observation = Object.freeze({
    snapshot: () => Object.freeze({ canonical: Object.freeze({ currentStepId: current }) })
  });
  const presentation = createCommentaryPresentation({ selection, observation, entryCount });
  return {
    selection,
    observation,
    presentation,
    setState(value) { selectionValue = value; },
    setCurrent(value) { current = value; }
  };
}

test('Commentary presentation surface and projected records are exact and frozen', () => {
  const h = harness({
    state: selectionState({ frontier: 'step-02', selectedStepId: 'step-02', ids: ['step-01', 'step-02'] }),
    currentStepId: 'step-01'
  });
  const state = h.presentation.read();

  assert.deepEqual(Object.keys(h.presentation), COMMENTARY_PRESENTATION_KEYS);
  assert.deepEqual(Object.keys(state), COMMENTARY_PRESENTATION_STATE_KEYS);
  assert.equal(Object.isFrozen(h.presentation), true);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.entries), true);
  for (const projected of state.entries) {
    assert.deepEqual(Object.keys(projected), COMMENTARY_PRESENTATION_ENTRY_KEYS);
    assert.equal(Object.isFrozen(projected), true);
  }
});

test('canonical active position and Commentary-local selection remain independent facts', () => {
  const h = harness({
    state: selectionState({ frontier: 'step-03', selectedStepId: 'step-02', ids: ['step-01', 'step-02', 'step-03'] }),
    currentStepId: 'step-03'
  });
  const state = h.presentation.read();

  assert.equal(state.currentStepId, 'step-03');
  assert.equal(state.selectedStepId, 'step-02');
  assert.deepEqual(state.entries.map(({ selected, active }) => [selected, active]), [
    [false, false],
    [true, false],
    [false, true]
  ]);
});

test('initial has no active Commentary entry while revealed history may remain visible after Home', () => {
  const h = harness({
    state: selectionState({ frontier: 'step-03', ids: ['step-01', 'step-02', 'step-03'] }),
    currentStepId: 'initial'
  });
  const state = h.presentation.read();
  assert.equal(state.currentStepId, 'initial');
  assert.deepEqual(state.entries.map((entry) => entry.active), [false, false, false]);
});

test('presentation follows fresh selection and canonical position on every read', () => {
  const h = harness({
    state: selectionState({ frontier: 'step-01', ids: ['step-01'] }),
    currentStepId: 'step-01'
  });
  assert.equal(h.presentation.read().entries[0].active, true);

  h.setState(selectionState({ frontier: 'step-02', selectedStepId: 'step-01', ids: ['step-01', 'step-02'] }));
  h.setCurrent('step-02');
  const state = h.presentation.read();
  assert.equal(state.selectedStepId, 'step-01');
  assert.deepEqual(state.entries.map(({ selected, active }) => [selected, active]), [[true, false], [false, true]]);
});

test('presentation validates current semantic identity against revealed visibility', () => {
  const h = harness({
    state: selectionState({ frontier: 'step-01', ids: ['step-01'] }),
    currentStepId: 'step-02'
  });
  assert.throws(() => h.presentation.read(), /currently revealed entry/);
});

test('presentation receives exact selection and snapshot-only observation capabilities', () => {
  const validState = selectionState();
  const read = () => validState;
  const select = () => {};
  const clear = () => {};
  const observation = Object.freeze({ snapshot: () => Object.freeze({ canonical: Object.freeze({ currentStepId: 'initial' }) }) });

  assert.throws(
    () => createCommentaryPresentation({
      selection: Object.freeze({ read, select, clear, seek() {} }),
      observation,
      entryCount: 1
    }),
    /must contain exactly/
  );
  assert.throws(
    () => createCommentaryPresentation({
      selection: Object.freeze({ read, select, clear }),
      observation: Object.freeze({ snapshot: observation.snapshot, subscribe() {} }),
      entryCount: 1
    }),
    /must contain exactly: snapshot/
  );
});

test('malformed selection link data fails closed before presentation is returned', () => {
  const badLink = Object.freeze({ id: 'x', label: 'X', href: '/x', extra: true });
  const badEntry = Object.freeze({
    stepId: 'step-01',
    index: 1,
    text: 'text',
    links: Object.freeze([badLink]),
    selected: false
  });
  const badState = Object.freeze({
    revealFrontier: 'step-01',
    selectedStepId: null,
    entries: Object.freeze([badEntry])
  });
  const h = harness({ state: badState, currentStepId: 'step-01', entryCount: 1 });
  assert.throws(() => h.presentation.read(), /must contain exactly: id, label, href/);
});
