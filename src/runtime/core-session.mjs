import { createCoreEngine } from '../core/core-engine.mjs';

const RUNTIME_CONTROL_GRANTS = new WeakMap();

export function createRuntimeCoreSession(options) {
  const core = createCoreEngine(options);
  const session = Object.freeze({
    read: core.read,
    navigation: core.navigation
  });

  RUNTIME_CONTROL_GRANTS.set(
    session,
    Object.freeze({
      semanticControl: core.semanticControl,
      faultControl: core.faultControl,
      statusControl: core.statusControl
    })
  );

  return session;
}

export function acquireRuntimeCoreControls(session) {
  if (!session || typeof session !== 'object') {
    throw new TypeError('session must be a Runtime Core session projection.');
  }

  const controls = RUNTIME_CONTROL_GRANTS.get(session);
  if (!controls) {
    throw new Error('Runtime Core controls are unavailable or were already acquired.');
  }

  RUNTIME_CONTROL_GRANTS.delete(session);
  return controls;
}
