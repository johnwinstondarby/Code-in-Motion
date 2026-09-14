import { createCoreEngine } from '../core/core-engine.mjs';

export function createRuntimeCoreSession(options) {
  const core = createCoreEngine(options);

  const session = Object.freeze({
    read: core.read,
    navigation: core.navigation
  });

  const controls = Object.freeze({
    semanticControl: core.semanticControl,
    faultControl: core.faultControl,
    statusControl: core.statusControl
  });

  return Object.freeze({ session, controls });
}
