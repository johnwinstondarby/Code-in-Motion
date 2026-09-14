import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CoreStateTransitionError,
  createCoreEngine
} from '../src/core/core-engine.mjs';
import {
  FAULT_RECOVERY_CLASS
} from '../src/contracts/faults.mjs';
import {
  INITIAL_BOUNDARY_ID,
  SESSION_STATUS
} from '../src/contracts/session.mjs';

function makeCore() {
  return createCoreEngine({
    instanceId: 'instance-01',
    experienceId: 'synthetic-core',
    experienceVersion: '1.0.0',
    stepIds: ['step-01', 'step-02', 'step-03', 'step-04']
  });
}

function settle(core, stepId) {
  core.semanticControl.beginTarget(stepId);
  return core.semanticControl.commitTarget(stepId);
}

const RECOVERABLE_RENDERER_FAULT = Object.freeze({
  code: 'CIM-RND-004',
  component: 'renderer',
  recoveryClass: FAULT_RECOVERY_CLASS.RECOVER
});

const FALLBACK_RENDERER_FAULT = Object.freeze({
  code: 'CIM-RND-006',
  component: 'renderer',
  recoveryClass: FAULT_RECOVERY_CLASS.FALLBACK
});

test('recoverable fault is stored as a frozen canonical record without changing semantic anchor or activity status', () => {
  const core = makeCore();
  settle(core, 'step-02');
  core.statusControl.setStatus(SESSION_STATUS.PAUSED);
  const before = core.read.snapshot();

  const state = core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);

  assert.deepEqual(state.error, RECOVERABLE_RENDERER_FAULT);
  assert.equal(Object.isFrozen(state.error), true);
  assert.equal(state.currentStepId, before.currentStepId);
  assert.equal(state.targetStepId, null);
  assert.equal(state.revealFrontier, before.revealFrontier);
  assert.equal(state.status, SESSION_STATUS.PAUSED);
});

test('fault input is rebuilt from exact enumerable data properties and accessors are never invoked', () => {
  const core = makeCore();
  let invoked = 0;
  const accessor = {
    component: 'renderer',
    recoveryClass: FAULT_RECOVERY_CLASS.RECOVER
  };
  Object.defineProperty(accessor, 'code', {
    enumerable: true,
    get() {
      invoked += 1;
      return 'CIM-RND-004';
    }
  });

  assert.throws(() => core.faultControl.recordFault(accessor), /data property/);
  assert.equal(invoked, 0);

  const mutable = {
    code: 'CIM-RND-004',
    component: 'renderer',
    recoveryClass: FAULT_RECOVERY_CLASS.RECOVER
  };
  const state = core.faultControl.recordFault(mutable);
  mutable.code = 'CIM-RND-005';
  assert.equal(state.error.code, 'CIM-RND-004');
  assert.notEqual(state.error, mutable);
});

test('fault record validation rejects extra keys, symbol keys, invalid recovery classes, and namespace mismatch', () => {
  const core = makeCore();
  assert.throws(
    () => core.faultControl.recordFault({ ...RECOVERABLE_RENDERER_FAULT, message: 'boom' }),
    /exactly/
  );
  const symbolFault = { ...RECOVERABLE_RENDERER_FAULT };
  symbolFault[Symbol('live')] = 1;
  assert.throws(() => core.faultControl.recordFault(symbolFault), /symbol keys/);
  assert.throws(
    () => core.faultControl.recordFault({ code: 'CIM-RND-004', component: 'renderer', recoveryClass: 'reject' }),
    /recoveryClass/
  );
  assert.throws(
    () => core.faultControl.recordFault({ code: 'CIM-RT-002', component: 'renderer', recoveryClass: 'recover' }),
    /does not match code namespace/
  );
  assert.equal(core.read.snapshot().error, null);
});

test('canonical fault storage requires Runtime to abandon a pending target first', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-01');
  const before = core.read.snapshot();

  assert.throws(
    () => core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT),
    (error) => error instanceof CoreStateTransitionError && /abandoned/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);

  core.semanticControl.abandonTarget('step-01');
  const stored = core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);
  assert.equal(stored.currentStepId, INITIAL_BOUNDARY_ID);
  assert.equal(stored.targetStepId, null);
});

test('clearRecoverableFault requires exact active code and clears no other canonical state', () => {
  const core = makeCore();
  settle(core, 'step-02');
  core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);
  const before = core.read.snapshot();

  assert.throws(
    () => core.faultControl.clearRecoverableFault('CIM-RND-005'),
    (error) => error instanceof CoreStateTransitionError && /active fault is CIM-RND-004/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);

  const cleared = core.faultControl.clearRecoverableFault('CIM-RND-004');
  assert.equal(cleared.error, null);
  assert.equal(cleared.currentStepId, before.currentStepId);
  assert.equal(cleared.revealFrontier, before.revealFrontier);
  assert.equal(cleared.status, before.status);
});

test('fallback fault atomically stores canonical error and enters faulted status', () => {
  const core = makeCore();
  settle(core, 'step-03');
  const before = core.read.snapshot();

  const faulted = core.faultControl.recordFault(FALLBACK_RENDERER_FAULT);

  assert.equal(faulted.status, SESSION_STATUS.FAULTED);
  assert.deepEqual(faulted.error, FALLBACK_RENDERER_FAULT);
  assert.equal(faulted.currentStepId, before.currentStepId);
  assert.equal(faulted.targetStepId, null);
  assert.equal(faulted.revealFrontier, before.revealFrontier);
});

test('recoverable fault may escalate to fallback while preserving the committed recovery anchor', () => {
  const core = makeCore();
  settle(core, 'step-02');
  core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);
  const anchor = core.read.snapshot().currentStepId;

  const faulted = core.faultControl.recordFault(FALLBACK_RENDERER_FAULT);

  assert.equal(faulted.error.code, 'CIM-RND-006');
  assert.equal(faulted.error.recoveryClass, FAULT_RECOVERY_CLASS.FALLBACK);
  assert.equal(faulted.status, SESSION_STATUS.FAULTED);
  assert.equal(faulted.currentStepId, anchor);
});

test('a second recoverable fault cannot overwrite active canonical recovery state', () => {
  const core = makeCore();
  core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);
  const before = core.read.snapshot();

  assert.throws(
    () => core.faultControl.recordFault({ code: 'CIM-RND-005', component: 'renderer', recoveryClass: 'recover' }),
    (error) => error instanceof CoreStateTransitionError && /must be cleared/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);
});

test('fallback fault cannot be cleared as recovered and blocks semantic mutation', () => {
  const core = makeCore();
  core.faultControl.recordFault(FALLBACK_RENDERER_FAULT);
  const before = core.read.snapshot();

  assert.throws(
    () => core.faultControl.clearRecoverableFault('CIM-RND-006'),
    (error) => error instanceof CoreStateTransitionError && /cannot be cleared as recovered/.test(error.message)
  );
  assert.throws(
    () => core.semanticControl.beginTarget('step-01'),
    (error) => error instanceof CoreStateTransitionError && /faulted/.test(error.message)
  );
  assert.throws(
    () => core.semanticControl.commitRestart(),
    (error) => error instanceof CoreStateTransitionError && /faulted/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);
});

test('faulted status cannot return to an activity status and may only advance to disposed', () => {
  const core = makeCore();
  core.faultControl.recordFault(FALLBACK_RENDERER_FAULT);

  assert.throws(
    () => core.statusControl.setStatus(SESSION_STATUS.IDLE),
    (error) => error instanceof CoreStateTransitionError && /only transition to disposed/.test(error.message)
  );
  const disposed = core.statusControl.setStatus(SESSION_STATUS.DISPOSED);
  assert.equal(disposed.status, SESSION_STATUS.DISPOSED);
  assert.equal(disposed.error.code, 'CIM-RND-006');
});

test('restart clears recoverable transient fault only after initial is stable', () => {
  const core = makeCore();
  settle(core, 'step-03');
  core.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);

  const restart = core.navigation.resolve({ command: 'restart' });
  core.semanticControl.beginTarget(restart.toStepId);
  const pending = core.read.snapshot();
  assert.equal(pending.error.code, 'CIM-RND-004');
  assert.equal(pending.currentStepId, 'step-03');

  const restarted = core.semanticControl.commitRestart();
  assert.equal(restarted.currentStepId, INITIAL_BOUNDARY_ID);
  assert.equal(restarted.targetStepId, null);
  assert.equal(restarted.revealFrontier, INITIAL_BOUNDARY_ID);
  assert.equal(restarted.error, null);
});

test('restart at already-stable initial clears a recoverable fault but never a fallback fault', () => {
  const recoverable = makeCore();
  recoverable.faultControl.recordFault(RECOVERABLE_RENDERER_FAULT);
  const restarted = recoverable.semanticControl.commitRestart();
  assert.equal(restarted.error, null);
  assert.equal(restarted.currentStepId, INITIAL_BOUNDARY_ID);

  const fallback = makeCore();
  fallback.faultControl.recordFault(FALLBACK_RENDERER_FAULT);
  const before = fallback.read.snapshot();
  assert.throws(() => fallback.semanticControl.commitRestart(), CoreStateTransitionError);
  assert.deepEqual(fallback.read.snapshot(), before);
});
