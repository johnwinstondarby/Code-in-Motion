import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE } from '../src/contracts/events.mjs';
import { createTransportController } from '../src/transport/transport-controller.mjs';
import {
  TRANSPORT_SCRUB_GESTURE_KEYS,
  TRANSPORT_SCRUB_STATE_KEYS,
  createTransportScrubGesture,
  resolveTransportScrubSnap
} from '../src/transport/scrub-gesture.mjs';

function makeTimeline({
  boundaryIds = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']),
  currentStepId = 'initial'
} = {}) {
  let current = currentStepId;
  const timeline = Object.freeze({
    boundaryIds() {
      return boundaryIds;
    },
    project() {
      return Object.freeze({
        currentStepId: current,
        targetStepId: null,
        revealFrontier: current,
        markers: Object.freeze([])
      });
    }
  });
  return {
    timeline,
    setCurrent(stepId) {
      current = stepId;
    }
  };
}

function makeCommandController(seekImpl = () => Object.freeze({ result: 'success' })) {
  const calls = [];
  const port = Object.freeze({
    play: () => null,
    pause: () => null,
    next: () => null,
    previous: () => null,
    seek(stepId, source) {
      calls.push({ stepId, source });
      return seekImpl(stepId, source);
    },
    home: () => null,
    end: () => null,
    restart: () => null
  });
  return { controller: createTransportController(port), calls };
}

function assertState(state, expected) {
  assert.deepEqual(Object.keys(state), TRANSPORT_SCRUB_STATE_KEYS);
  assert.equal(Object.isFrozen(state), true);
  assert.deepEqual(state, expected);
}

test('semantic scrub snap points are equally spaced by boundary ordinal and clamp to the rail', () => {
  const ids = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);
  assert.deepEqual(resolveTransportScrubSnap(ids, -1), { stepId: 'initial', index: 0, ratio: 0 });
  assert.deepEqual(resolveTransportScrubSnap(ids, 0), { stepId: 'initial', index: 0, ratio: 0 });
  assert.deepEqual(resolveTransportScrubSnap(ids, 1 / 3), { stepId: 'step-01', index: 1, ratio: 1 / 3 });
  assert.deepEqual(resolveTransportScrubSnap(ids, 2 / 3), { stepId: 'step-02', index: 2, ratio: 2 / 3 });
  assert.deepEqual(resolveTransportScrubSnap(ids, 1), { stepId: 'step-03', index: 3, ratio: 1 });
  assert.deepEqual(resolveTransportScrubSnap(ids, 2), { stepId: 'step-03', index: 3, ratio: 1 });
});

test('exact midpoint ties resolve toward the lower semantic ordinal', () => {
  const ids = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);
  assert.equal(resolveTransportScrubSnap(ids, 1 / 6).stepId, 'initial');
  assert.equal(resolveTransportScrubSnap(ids, 1 / 2).stepId, 'step-01');
  assert.equal(resolveTransportScrubSnap(ids, 5 / 6).stepId, 'step-02');
});

test('scrub gesture surface is exact frozen and carries no broader command or observation authority', () => {
  const { timeline } = makeTimeline();
  const gesture = createTransportScrubGesture(timeline, () => null);

  assert.deepEqual(Object.keys(gesture), TRANSPORT_SCRUB_GESTURE_KEYS);
  assert.equal(Object.isFrozen(gesture), true);
  for (const forbidden of ['play', 'pause', 'seek', 'restart', 'events', 'dispose', 'snapshot', 'boundaryIds']) {
    assert.equal(forbidden in gesture, false);
  }

  assert.throws(() => createTransportScrubGesture(Object.freeze({ ...timeline, events() {} }), () => null), /exactly/);
  assert.throws(() => createTransportScrubGesture(timeline, Object.freeze({ scrubCommit() {} })), /must be a function/);
});

test('inactive display follows canonical position and initial remains a valid rail anchor', () => {
  const observation = makeTimeline({ currentStepId: 'initial' });
  const gesture = createTransportScrubGesture(observation.timeline, () => null);
  assertState(gesture.read(), {
    active: false,
    displayStepId: 'initial',
    displayIndex: 0,
    displayRatio: 0
  });

  observation.setCurrent('step-02');
  assertState(gesture.read(), {
    active: false,
    displayStepId: 'step-02',
    displayIndex: 2,
    displayRatio: 2 / 3
  });
});

test('drag preview remains local and emits no semantic command before commit', () => {
  const observation = makeTimeline({ currentStepId: 'step-01' });
  const command = makeCommandController();
  const gesture = createTransportScrubGesture(observation.timeline, command.controller.scrubCommit);

  assertState(gesture.begin(0.8), {
    active: true,
    displayStepId: 'step-02',
    displayIndex: 2,
    displayRatio: 2 / 3
  });
  assertState(gesture.update(0.99), {
    active: true,
    displayStepId: 'step-03',
    displayIndex: 3,
    displayRatio: 1
  });
  assert.equal(command.calls.length, 0);
  assert.equal(observation.timeline.project().currentStepId, 'step-01');
});

test('commit emits exactly one scrub seek and returns the exact Runtime outcome reference', () => {
  const outcome = Object.freeze({ result: 'success', marker: Symbol('identity') });
  const observation = makeTimeline({ currentStepId: 'step-01' });
  const command = makeCommandController(() => outcome);
  const gesture = createTransportScrubGesture(observation.timeline, command.controller.scrubCommit);

  gesture.begin(0.7);
  const returned = gesture.commit();
  assert.equal(returned, outcome);
  assert.deepEqual(command.calls, [{ stepId: 'step-02', source: COMMAND_SOURCE.SCRUB }]);
  assert.equal(gesture.commit(), null);
  assert.equal(command.calls.length, 1);

  assertState(gesture.read(), {
    active: false,
    displayStepId: 'step-01',
    displayIndex: 1,
    displayRatio: 1 / 3
  });
});

test('initial rail anchor may be committed as a valid scrub destination', () => {
  const observation = makeTimeline({ currentStepId: 'step-02' });
  const command = makeCommandController();
  const gesture = createTransportScrubGesture(observation.timeline, command.controller.scrubCommit);

  gesture.begin(0);
  gesture.commit();
  assert.deepEqual(command.calls, [{ stepId: 'initial', source: COMMAND_SOURCE.SCRUB }]);
});

test('cancel emits no command and restores display from the latest canonical projection', () => {
  const observation = makeTimeline({ currentStepId: 'step-01' });
  const command = makeCommandController();
  const gesture = createTransportScrubGesture(observation.timeline, command.controller.scrubCommit);

  gesture.begin(1);
  observation.setCurrent('step-02');
  assertState(gesture.cancel(), {
    active: false,
    displayStepId: 'step-02',
    displayIndex: 2,
    displayRatio: 2 / 3
  });
  assert.equal(command.calls.length, 0);
  assert.equal(gesture.cancel(), null);
});

test('a pending Runtime outcome does not gate a later scrub gesture or coalesce its command', () => {
  let resolveFirst;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const second = Promise.resolve(Object.freeze({ result: 'success' }));
  let count = 0;
  const observation = makeTimeline({ currentStepId: 'step-01' });
  const command = makeCommandController(() => (++count === 1 ? first : second));
  const gesture = createTransportScrubGesture(observation.timeline, command.controller.scrubCommit);

  gesture.begin(0.7);
  assert.equal(gesture.commit(), first);
  gesture.begin(1);
  assert.equal(gesture.commit(), second);
  assert.deepEqual(command.calls, [
    { stepId: 'step-02', source: COMMAND_SOURCE.SCRUB },
    { stepId: 'step-03', source: COMMAND_SOURCE.SCRUB }
  ]);
  resolveFirst(Object.freeze({ result: 'superseded' }));
});

test('gesture lifecycle rejects overlapping begins and invalid ratios without issuing commands', () => {
  const observation = makeTimeline();
  const command = makeCommandController();
  const gesture = createTransportScrubGesture(observation.timeline, command.controller.scrubCommit);

  assert.throws(() => gesture.begin(Number.NaN), /finite number/);
  assert.throws(() => gesture.begin(Number.POSITIVE_INFINITY), /finite number/);
  gesture.begin(0.4);
  assert.throws(() => gesture.begin(0.6), /already active/);
  assert.equal(command.calls.length, 0);
  gesture.cancel();
  assert.equal(gesture.update(0.5), null);
  assert.equal(gesture.commit(), null);
});

test('scrub construction fails closed on malformed semantic rail order and unknown canonical position', () => {
  const badOrder = makeTimeline({ boundaryIds: Object.freeze(['step-01']) });
  assert.throws(() => createTransportScrubGesture(badOrder.timeline, () => null), /initial plus at least one authored/);

  const unknown = makeTimeline({ currentStepId: 'missing' });
  const gesture = createTransportScrubGesture(unknown.timeline, () => null);
  assert.throws(() => gesture.read(), /known semantic boundary/);
});
