import {
  ABORT_SIGNAL_KEYS,
  RENDER_CLOCK_KEYS,
  RENDER_CONTEXT_KEYS
} from '../renderers/interface.mjs';

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactDataBag(value) {
  if (!isPlainObject(value)) fail('renderer context input must be a plain object.');

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    fail('renderer context input cannot contain symbol keys.');
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of ownKeys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`renderer context input field ${String(key)} must be an enumerable data property.`);
    }
  }

  const provided = new Set(ownKeys);
  const missing = RENDER_CONTEXT_KEYS.filter((key) => !provided.has(key));
  const extra = ownKeys.filter((key) => !RENDER_CONTEXT_KEYS.includes(key));

  if (missing.length || extra.length) {
    const details = [];
    if (missing.length) details.push(`missing: ${missing.join(', ')}`);
    if (extra.length) details.push(`extra: ${extra.join(', ')}`);
    fail(`renderer context input must contain exactly the v1 key set (${details.join('; ')}).`);
  }

  return descriptors;
}

function assertExactFrozenFacade(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  if (!Object.isFrozen(value)) fail(`${label} must be frozen before context construction.`);

  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || expectedKeys.some((key, index) => keys[index] !== key)) {
    fail(`${label} must expose exactly: ${expectedKeys.join(', ')}.`);
  }
}

function assertFrozenObjectOrNull(value, label) {
  if (value === null) return;
  if (!isPlainObject(value)) fail(`${label} must be a plain object or null.`);
  if (!Object.isFrozen(value)) fail(`${label} must be frozen before context construction.`);
}

function assertFrozenJsonReference(value, label) {
  if (value === null) return;
  if (typeof value === 'object' && !Object.isFrozen(value)) {
    fail(`${label} object/array values must be frozen before context construction.`);
  }
}

export function createRendererContext(input) {
  const descriptors = assertExactDataBag(input);
  const read = (key) => descriptors[key].value;

  const animate = read('animate');
  const fromState = read('fromState');
  const fromStepId = read('fromStepId');
  const stepId = read('stepId');
  const rendererConfig = read('rendererConfig');
  const stepRendererConfig = read('stepRendererConfig');
  const transitionId = read('transitionId');
  const abortSignal = read('abortSignal');
  const clock = read('clock');
  const reducedMotion = read('reducedMotion');

  if (typeof animate !== 'boolean') fail('renderer context animate must be boolean.');
  if (typeof reducedMotion !== 'boolean') fail('renderer context reducedMotion must be boolean.');
  if (typeof stepId !== 'string' || stepId.length === 0) fail('renderer context stepId must be a non-empty string.');
  if (transitionId === null || transitionId === undefined) fail('renderer context transitionId is required.');

  const hasFromState = fromState !== null;
  const hasFromStepId = fromStepId !== null;
  if (hasFromState !== hasFromStepId) {
    fail('renderer context fromState and fromStepId must either both be present or both be null.');
  }
  if (!animate && (hasFromState || hasFromStepId)) {
    fail('non-animated absolute renderer context must use null predecessor fields.');
  }
  if (animate && (!hasFromState || !hasFromStepId)) {
    fail('animated continuity renderer context requires both predecessor fields.');
  }
  if (hasFromStepId && (typeof fromStepId !== 'string' || fromStepId.length === 0)) {
    fail('renderer context fromStepId must be a non-empty string when present.');
  }

  assertFrozenJsonReference(fromState, 'renderer context fromState');
  assertFrozenObjectOrNull(rendererConfig, 'renderer context rendererConfig');
  assertFrozenObjectOrNull(stepRendererConfig, 'renderer context stepRendererConfig');
  assertExactFrozenFacade(abortSignal, ABORT_SIGNAL_KEYS, 'renderer context abortSignal');
  assertExactFrozenFacade(clock, RENDER_CLOCK_KEYS, 'renderer context clock');

  return Object.freeze({
    animate,
    fromState,
    fromStepId,
    stepId,
    rendererConfig,
    stepRendererConfig,
    transitionId,
    abortSignal,
    clock,
    reducedMotion
  });
}
