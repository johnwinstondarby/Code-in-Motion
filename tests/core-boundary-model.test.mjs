import test from 'node:test';
import assert from 'node:assert/strict';

import { createBoundaryModel } from '../src/core/boundary-model.mjs';
import { createCoreEngine } from '../src/core/core-engine.mjs';
import {
  COMMAND_RESULT,
  INITIAL_BOUNDARY_ID,
  NAVIGATION_REASON
} from '../src/contracts/session.mjs';

const STEP_IDS = Object.freeze(['step-01', 'step-02', 'step-03', 'step-04']);

function model() {
  return createBoundaryModel(STEP_IDS);
}

function makeCore() {
  return createCoreEngine({
    instanceId: 'instance-01',
    experienceId: 'synthetic-core',
    experienceVersion: '1.0.0',
    stepIds: STEP_IDS
  });
}

test('boundary model fixes canonical semantic order with initial first', () => {
  const boundaries = model().boundaryIds();
  assert.deepEqual(boundaries, [INITIAL_BOUNDARY_ID, ...STEP_IDS]);
  assert.equal(Object.isFrozen(boundaries), true);
});

test('next and previous resolve one semantic boundary without wrapping', () => {
  const boundaries = model();

  assert.deepEqual(
    boundaries.resolve('step-01', { command: 'next' }),
    { command: 'next', result: COMMAND_RESULT.SUCCESS, fromStepId: 'step-01', toStepId: 'step-02', reason: null }
  );
  assert.deepEqual(
    boundaries.resolve('step-01', { command: 'previous' }),
    { command: 'previous', result: COMMAND_RESULT.SUCCESS, fromStepId: 'step-01', toStepId: INITIAL_BOUNDARY_ID, reason: null }
  );
});

test('boundary exhaustion is accepted no_change rather than rejection', () => {
  const boundaries = model();

  assert.deepEqual(
    boundaries.resolve(INITIAL_BOUNDARY_ID, { command: 'previous' }),
    { command: 'previous', result: COMMAND_RESULT.NO_CHANGE, fromStepId: INITIAL_BOUNDARY_ID, toStepId: INITIAL_BOUNDARY_ID, reason: NAVIGATION_REASON.AT_START }
  );
  assert.deepEqual(
    boundaries.resolve('step-04', { command: 'next' }),
    { command: 'next', result: COMMAND_RESULT.NO_CHANGE, fromStepId: 'step-04', toStepId: 'step-04', reason: NAVIGATION_REASON.AT_END }
  );
});

test('seek resolves initial and authored boundaries and rejects unknown steps', () => {
  const boundaries = model();

  assert.equal(boundaries.resolve('step-03', { command: 'seek', stepId: INITIAL_BOUNDARY_ID }).toStepId, INITIAL_BOUNDARY_ID);
  assert.equal(boundaries.resolve(INITIAL_BOUNDARY_ID, { command: 'seek', stepId: 'step-03' }).toStepId, 'step-03');
  assert.deepEqual(
    boundaries.resolve('step-02', { command: 'seek', stepId: 'missing' }),
    { command: 'seek', result: COMMAND_RESULT.REJECTED, fromStepId: 'step-02', toStepId: null, reason: NAVIGATION_REASON.UNKNOWN_STEP }
  );
});

test('home, end, and restart resolve their documented destinations', () => {
  const boundaries = model();

  assert.equal(boundaries.resolve('step-03', { command: 'home' }).toStepId, INITIAL_BOUNDARY_ID);
  assert.equal(boundaries.resolve('step-01', { command: 'end' }).toStepId, 'step-04');
  assert.equal(boundaries.resolve('step-03', { command: 'restart' }).toStepId, INITIAL_BOUNDARY_ID);
});

test('semantic order cannot be suppressed by equivalent subject-state identity', () => {
  const boundaries = createBoundaryModel(['step-01', 'step-02']);
  const sameSubjectState = Object.freeze({ node: 'B' });
  const subjectByStep = Object.freeze({
    'step-01': sameSubjectState,
    'step-02': sameSubjectState
  });

  assert.equal(subjectByStep['step-01'], subjectByStep['step-02']);
  const next = boundaries.resolve('step-01', { command: 'next' });
  assert.equal(next.result, COMMAND_RESULT.SUCCESS);
  assert.equal(next.toStepId, 'step-02');
});

test('navigation request validation is exact and does not invoke accessors', () => {
  const boundaries = model();
  let invoked = 0;
  const accessor = { command: 'seek' };
  Object.defineProperty(accessor, 'stepId', {
    enumerable: true,
    get() {
      invoked += 1;
      return 'step-02';
    }
  });

  assert.throws(() => boundaries.resolve(INITIAL_BOUNDARY_ID, accessor), /data property/);
  assert.equal(invoked, 0);
  assert.throws(() => boundaries.resolve(INITIAL_BOUNDARY_ID, { command: 'next', stepId: 'step-02' }), /exactly/);
  assert.throws(() => boundaries.resolve(INITIAL_BOUNDARY_ID, { command: 'seek' }), /exactly/);
});

test('invalid boundary definitions fail closed', () => {
  assert.throws(() => createBoundaryModel([]), /non-empty array/);
  assert.throws(() => createBoundaryModel(['step-01', 'step-01']), /duplicate/);
  assert.throws(() => createBoundaryModel([INITIAL_BOUNDARY_ID]), /reserved boundary/);
  assert.throws(() => createBoundaryModel(['']), /non-empty string/);
});

test('Core navigation resolution is pure and leaves canonical state untouched', () => {
  const core = makeCore();
  const before = core.read.snapshot();
  const resolution = core.navigation.resolve({ command: 'next' });
  const after = core.read.snapshot();

  assert.equal(resolution.toStepId, 'step-01');
  assert.deepEqual(after, before);
  assert.equal(after.currentStepId, INITIAL_BOUNDARY_ID);
  assert.equal(after.targetStepId, null);
});
