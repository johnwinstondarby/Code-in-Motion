import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CoreStateTransitionError,
  createCoreEngine
} from '../src/core/core-engine.mjs';
import { INITIAL_BOUNDARY_ID, SESSION_STATUS } from '../src/contracts/session.mjs';

function makeCore() {
  return createCoreEngine({
    instanceId: 'instance-01',
    experienceId: 'synthetic-core',
    experienceVersion: '1.0.0',
    stepIds: ['step-01', 'step-02', 'step-03', 'step-04']
  });
}

test('beginTarget records a pending destination without advancing the committed boundary', () => {
  const core = makeCore();
  const result = core.semanticControl.beginTarget('step-01');

  assert.equal(result.currentStepId, INITIAL_BOUNDARY_ID);
  assert.equal(result.targetStepId, 'step-01');
  assert.equal(result.revealFrontier, INITIAL_BOUNDARY_ID);
  assert.equal(core.read.snapshot().currentStepId, INITIAL_BOUNDARY_ID);
  assert.equal(core.read.snapshot().targetStepId, 'step-01');
});

test('beginTarget validates destination and permits initial as a semantic target', () => {
  const core = makeCore();
  assert.throws(() => core.semanticControl.beginTarget('missing'), /known semantic boundary/);
  assert.equal(core.read.snapshot().targetStepId, null);

  const initialTarget = core.semanticControl.beginTarget(INITIAL_BOUNDARY_ID);
  assert.equal(initialTarget.targetStepId, INITIAL_BOUNDARY_ID);
  assert.equal(initialTarget.currentStepId, INITIAL_BOUNDARY_ID);
});

test('one Core instance holds at most one pending semantic target', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-01');

  assert.throws(
    () => core.semanticControl.beginTarget('step-02'),
    (error) => error instanceof CoreStateTransitionError && /pending target step-01/.test(error.message)
  );
  assert.equal(core.read.snapshot().targetStepId, 'step-01');
});

test('commitTarget atomically advances currentStepId, clears the pending target, and reveals the committed boundary', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-01');
  const committed = core.semanticControl.commitTarget('step-01');

  assert.equal(committed.currentStepId, 'step-01');
  assert.equal(committed.targetStepId, null);
  assert.equal(committed.revealFrontier, 'step-01');
  assert.equal(core.read.snapshot().currentStepId, 'step-01');
  assert.equal(core.read.snapshot().targetStepId, null);
});

test('commitTarget requires the active target and rejects stale settlement without mutation', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-02');
  const before = core.read.snapshot();

  assert.throws(
    () => core.semanticControl.commitTarget('step-01'),
    (error) => error instanceof CoreStateTransitionError && /active target is step-02/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);
});

test('commitTarget without a pending target fails and preserves the recovery anchor', () => {
  const core = makeCore();
  const before = core.read.snapshot();

  assert.throws(
    () => core.semanticControl.commitTarget('step-01'),
    (error) => error instanceof CoreStateTransitionError && /requires a pending semantic target/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);
});

test('abandonTarget clears only the expected target and preserves currentStepId', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-01');
  core.semanticControl.commitTarget('step-01');
  core.semanticControl.beginTarget('step-02');

  const abandoned = core.semanticControl.abandonTarget('step-02');
  assert.equal(abandoned.currentStepId, 'step-01');
  assert.equal(abandoned.targetStepId, null);
  assert.equal(abandoned.revealFrontier, 'step-01');
});

test('stale abandon cannot clear a different active target', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-02');
  const before = core.read.snapshot();

  assert.throws(
    () => core.semanticControl.abandonTarget('step-01'),
    (error) => error instanceof CoreStateTransitionError && /active target is step-02/.test(error.message)
  );
  assert.deepEqual(core.read.snapshot(), before);
});

test('paused transition preserves committed and pending semantic positions', () => {
  const core = makeCore();
  core.semanticControl.beginTarget('step-01');
  core.statusControl.setStatus(SESSION_STATUS.PAUSED);

  const paused = core.read.snapshot();
  assert.equal(paused.status, SESSION_STATUS.PAUSED);
  assert.equal(paused.currentStepId, INITIAL_BOUNDARY_ID);
  assert.equal(paused.targetStepId, 'step-01');
});

test('target lifecycle leaves status and error unchanged and reveals only on successful commit', () => {
  const core = makeCore();
  const before = core.read.snapshot();
  core.semanticControl.beginTarget('step-01');
  const pending = core.read.snapshot();
  core.semanticControl.commitTarget('step-01');
  const committed = core.read.snapshot();

  assert.equal(pending.status, before.status);
  assert.equal(pending.revealFrontier, before.revealFrontier);
  assert.equal(pending.error, before.error);
  assert.equal(committed.status, before.status);
  assert.equal(committed.revealFrontier, 'step-01');
  assert.equal(committed.error, before.error);
});
