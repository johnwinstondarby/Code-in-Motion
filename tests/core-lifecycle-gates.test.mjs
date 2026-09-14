import test from 'node:test';
import assert from 'node:assert/strict';

import { createRuntimeCoreSession } from '../src/runtime/core-session.mjs';
import {
  COMMAND_RESULT,
  NAVIGATION_REASON,
  SESSION_STATUS
} from '../src/contracts/session.mjs';

const OPTIONS = Object.freeze({
  instanceId: 'instance-01',
  experienceId: 'synthetic-core',
  experienceVersion: '1.0.0',
  stepIds: Object.freeze(['step-01', 'step-02', 'step-03'])
});

const FALLBACK_FAULT = Object.freeze({
  code: 'CIM-RND-006',
  component: 'renderer',
  recoveryClass: 'fallback'
});

function makeSession() {
  return createRuntimeCoreSession(OPTIONS);
}

test('Runtime Core construction separates the shareable session from privileged controls', () => {
  const composition = createRuntimeCoreSession(OPTIONS);
  const { session, controls } = composition;

  assert.deepEqual(Object.keys(composition), ['session', 'controls']);
  assert.deepEqual(Object.keys(session), ['read', 'navigation']);
  assert.deepEqual(Object.keys(controls), ['semanticControl', 'faultControl', 'statusControl']);
  assert.equal('semanticControl' in session, false);
  assert.equal('faultControl' in session, false);
  assert.equal('statusControl' in session, false);
  assert.equal(Object.isFrozen(composition), true);
  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(controls), true);
});

test('Runtime Core controls are exact and frozen without an acquisition window', () => {
  const { controls } = createRuntimeCoreSession(OPTIONS);

  assert.deepEqual(Object.keys(controls), ['semanticControl', 'faultControl', 'statusControl']);
  assert.equal(Object.isFrozen(controls.semanticControl), true);
  assert.equal(Object.isFrozen(controls.faultControl), true);
  assert.equal(Object.isFrozen(controls.statusControl), true);
});

test('faulted Core rejects every valid navigation command with reason faulted', () => {
  const { session, controls } = makeSession();
  controls.faultControl.recordFault(FALLBACK_FAULT);

  const requests = [
    { command: 'next' },
    { command: 'previous' },
    { command: 'seek', stepId: 'step-02' },
    { command: 'home' },
    { command: 'end' },
    { command: 'restart' }
  ];

  for (const request of requests) {
    const result = session.navigation.resolve(request);
    assert.equal(result.result, COMMAND_RESULT.REJECTED);
    assert.equal(result.reason, NAVIGATION_REASON.FAULTED);
    assert.equal(result.fromStepId, 'initial');
    assert.equal(result.toStepId, null);
  }
});

test('disposed Core rejects every valid navigation command with reason disposed', () => {
  const { session, controls } = makeSession();
  controls.statusControl.setStatus(SESSION_STATUS.DISPOSED);

  const requests = [
    { command: 'next' },
    { command: 'previous' },
    { command: 'seek', stepId: 'step-02' },
    { command: 'home' },
    { command: 'end' },
    { command: 'restart' }
  ];

  for (const request of requests) {
    const result = session.navigation.resolve(request);
    assert.equal(result.result, COMMAND_RESULT.REJECTED);
    assert.equal(result.reason, NAVIGATION_REASON.DISPOSED);
    assert.equal(result.fromStepId, 'initial');
    assert.equal(result.toStepId, null);
  }
});

test('lifecycle rejection takes precedence over seek-target existence for a valid seek shape', () => {
  const { session, controls } = makeSession();
  controls.faultControl.recordFault(FALLBACK_FAULT);

  const result = session.navigation.resolve({ command: 'seek', stepId: 'missing' });
  assert.equal(result.result, COMMAND_RESULT.REJECTED);
  assert.equal(result.reason, NAVIGATION_REASON.FAULTED);
  assert.equal(result.toStepId, null);
});

test('lifecycle gate still validates navigation request shape without invoking accessors', () => {
  const { session, controls } = makeSession();
  controls.statusControl.setStatus(SESSION_STATUS.DISPOSED);

  let invoked = 0;
  const request = { command: 'seek' };
  Object.defineProperty(request, 'stepId', {
    enumerable: true,
    get() {
      invoked += 1;
      return 'step-01';
    }
  });

  assert.throws(() => session.navigation.resolve(request), /data property/);
  assert.equal(invoked, 0);
});
