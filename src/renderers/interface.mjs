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
