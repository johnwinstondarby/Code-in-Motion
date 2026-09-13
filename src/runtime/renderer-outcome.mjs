import { isRendererCancelledError } from '../renderers/interface.mjs';

function assertAbortSignal(abortSignal) {
  if (!abortSignal || typeof abortSignal !== 'object') {
    throw new TypeError('renderer outcome classification requires an abortSignal object.');
  }
  if (typeof abortSignal.aborted !== 'boolean') {
    throw new TypeError('renderer outcome abortSignal.aborted must be boolean.');
  }
}

export function classifyRendererRejection(error, { abortSignal, transitionId } = {}) {
  assertAbortSignal(abortSignal);
  if (transitionId === null || transitionId === undefined) {
    throw new TypeError('renderer outcome classification requires transitionId.');
  }

  const signalReason = abortSignal.reason ?? null;
  const cancelled = abortSignal.aborted === true &&
    isRendererCancelledError(error) &&
    Object.is(error.reason, signalReason);

  if (cancelled) {
    return Object.freeze({
      kind: 'cancelled',
      transitionId,
      reason: signalReason
    });
  }

  return Object.freeze({
    kind: 'error',
    transitionId,
    error
  });
}
