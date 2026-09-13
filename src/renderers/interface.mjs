export const RENDER_CONTEXT_KEYS = Object.freeze([
  'animate',
  'fromState',
  'fromStepId',
  'stepId',
  'rendererConfig',
  'stepRendererConfig',
  'transitionId',
  'abortSignal',
  'clock',
  'reducedMotion'
]);

export const ABORT_SIGNAL_KEYS = Object.freeze([
  'aborted',
  'reason',
  'onAbort'
]);

export const RENDER_CLOCK_KEYS = Object.freeze([
  'now',
  'schedule',
  'cancel',
  'onFrame'
]);

export const DOM_SVG_CANONICALIZER_ID = 'cim-dom-svg/v1';

export class RendererCancelledError extends Error {
  constructor(reason = null) {
    super('Renderer render cancelled.');
    this.name = 'RendererCancelledError';
    Object.defineProperty(this, 'reason', {
      value: reason ?? null,
      enumerable: true,
      configurable: false,
      writable: false
    });
    Object.freeze(this);
  }
}

export function isRendererCancelledError(value) {
  return value instanceof RendererCancelledError;
}
