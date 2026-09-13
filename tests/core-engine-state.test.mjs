import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CoreStateTransitionError,
  createCoreEngine
} from '../src/core/core-engine.mjs';
import {
  INITIAL_BOUNDARY_ID,
  SESSION_STATUS,
  SESSION_STATUS_VALUES
} from '../src/contracts/session.mjs';

function makeCore(overrides = {}) {
  return createCoreEngine({
    instanceId: 'instance-01',
    experienceId: 'synthetic-core',
    experienceVersion: '1.0.0',
    stepIds: ['step-01', 'step-02', 'step-03', 'step-04'],
    ...overrides
  });
}

test('Core initializes the exact canonical v1 session-state surface', () => {
  const core = makeCore();
  const state = core.read.snapshot();

  assert.deepEqual(Object.keys(state), [
    'instanceId',
    'experienceId',
    'experienceVersion',
    'status',
    'currentStepId',
    'targetStepId',
    'revealFrontier',
    'error'
  ]);
  assert.deepEqual(state, {
    instanceId: 'instance-01',
    experienceId: 'synthetic-core',
    experienceVersion: '1.0.0',
    status: SESSION_STATUS.IDLE,
    currentStepId: INITIAL_BOUNDARY_ID,
    targetStepId: null,
    revealFrontier: INITIAL_BOUNDARY_ID,
    error: null
  });
  assert.equal(Object.isFrozen(state), true);
});

test('read, navigation, and privileged status capabilities are structurally separate', () => {
  const core = makeCore();

  assert.deepEqual(Object.keys(core), ['read', 'navigation', 'statusControl']);
  assert.deepEqual(Reflect.ownKeys(core.read), ['snapshot', 'boundaryIds']);
  assert.deepEqual(Reflect.ownKeys(core.navigation), ['resolve']);
  assert.deepEqual(Reflect.ownKeys(core.statusControl), ['setStatus']);
  assert.equal('setStatus' in core.read, false);
  assert.equal('setStatus' in core.navigation, false);
  assert.equal('resolve' in core.statusControl, false);
  assert.equal(Object.isFrozen(core), true);
  assert.equal(Object.isFrozen(core.read), true);
  assert.equal(Object.isFrozen(core.navigation), true);
  assert.equal(Object.isFrozen(core.statusControl), true);
});

test('snapshots cannot mutate Core-owned state', () => {
  const core = makeCore();
  const first = core.read.snapshot();

  assert.throws(() => { first.status = SESSION_STATUS.PAUSED; }, TypeError);
  assert.equal(core.read.snapshot().status, SESSION_STATUS.IDLE);
  assert.notEqual(core.read.snapshot(), first);
});

test('privileged status control accepts every canonical status', () => {
  for (const nextStatus of SESSION_STATUS_VALUES) {
    const core = makeCore();
    const result = core.statusControl.setStatus(nextStatus);
    assert.equal(result.status, nextStatus);
    assert.equal(core.read.snapshot().status, nextStatus);
  }
});

test('invalid status writes fail without changing canonical state', () => {
  const core = makeCore();
  assert.throws(() => core.statusControl.setStatus('rendering'), /must be one of/);
  assert.equal(core.read.snapshot().status, SESSION_STATUS.IDLE);
});

test('disposed Core state is terminal', () => {
  const core = makeCore();
  core.statusControl.setStatus(SESSION_STATUS.DISPOSED);

  assert.equal(core.statusControl.setStatus(SESSION_STATUS.DISPOSED).status, SESSION_STATUS.DISPOSED);
  assert.throws(
    () => core.statusControl.setStatus(SESSION_STATUS.IDLE),
    (error) => error instanceof CoreStateTransitionError && /terminal/.test(error.message)
  );
  assert.equal(core.read.snapshot().status, SESSION_STATUS.DISPOSED);
});

test('Core instances own isolated canonical state', () => {
  const left = makeCore({ instanceId: 'left' });
  const right = makeCore({ instanceId: 'right' });

  left.statusControl.setStatus(SESSION_STATUS.PAUSED);
  assert.equal(left.read.snapshot().status, SESSION_STATUS.PAUSED);
  assert.equal(right.read.snapshot().status, SESSION_STATUS.IDLE);
});

test('Core identity fields and boundary model input reject missing values', () => {
  assert.throws(() => createCoreEngine(), /instanceId/);
  assert.throws(() => makeCore({ instanceId: '' }), /instanceId/);
  assert.throws(() => makeCore({ experienceId: '' }), /experienceId/);
  assert.throws(() => makeCore({ experienceVersion: '' }), /experienceVersion/);
  assert.throws(() => makeCore({ stepIds: [] }), /stepIds/);
});
