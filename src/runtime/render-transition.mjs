import { createRendererContext } from './renderer-context.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from './renderer-capabilities.mjs';
import { classifyRendererRejection } from './renderer-outcome.mjs';

export function beginRuntimeRender({
  renderer,
  scheduler,
  rendererConfig,
  reducedMotion,
  transitionId,
  stepId,
  state,
  stepRendererConfig,
  animate,
  fromStepId = null,
  fromState = null
}) {
  const abort = createRendererAbortCapability();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const context = createRendererContext({
    animate,
    fromState: animate ? fromState : null,
    fromStepId: animate ? fromStepId : null,
    stepId,
    rendererConfig,
    stepRendererConfig,
    transitionId,
    abortSignal: abort.facade,
    clock: clock.facade,
    reducedMotion
  });

  const renderDone = Promise.resolve()
    .then(() => renderer.render(state, context))
    .then(
      () => Object.freeze({ kind: 'settled' }),
      (error) => classifyRendererRejection(error, {
        abortSignal: abort.facade,
        transitionId
      })
    );

  return {
    abort,
    clock,
    context,
    renderDone
  };
}

export function closeRuntimeRender(task) {
  task.clock.controller.revoke();
  task.abort.controller.close();
}
