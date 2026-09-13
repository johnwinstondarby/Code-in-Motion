import { ABORT_SIGNAL_KEYS, RENDER_CLOCK_KEYS } from './interface.mjs';

export const RENDER_CAPABILITY_MAX_DEPTH = 8;

const TERMINAL_PROTOTYPES = new Set([Object.prototype, Array.prototype]);
const ABORT_ACCESSOR_KEYS = new Set(['aborted', 'reason']);
const ABORT_FUNCTION_KEYS = new Set(['onAbort']);
const CLOCK_FUNCTION_KEYS = new Set(RENDER_CLOCK_KEYS);

export class RendererCapabilityViolationError extends TypeError {
  constructor(path, reason) {
    super(`${path}: ${reason}`);
    this.name = 'RendererCapabilityViolationError';
    this.path = path;
    this.reason = reason;
  }
}

function fail(path, reason) {
  throw new RendererCapabilityViolationError(path, reason);
}

function childPath(path, key) {
  if (typeof key === 'symbol') return `${path}[${key.toString()}]`;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `${path}.${key}`;
  return `${path}[${JSON.stringify(key)}]`;
}

function facadeFromContextDescriptor(context, key) {
  const descriptor = Object.getOwnPropertyDescriptor(context, key);
  if (!descriptor || !('value' in descriptor)) {
    fail(`context.${key}`, 'approved renderer capability must be an own data property.');
  }
  return descriptor.value;
}

export function assertRendererContextCapabilities(context, { maxDepth = RENDER_CAPABILITY_MAX_DEPTH } = {}) {
  if (!context || typeof context !== 'object') {
    fail('context', 'renderer context must be an object.');
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new RangeError('renderer capability maxDepth must be a positive integer.');
  }

  const abortSignal = facadeFromContextDescriptor(context, 'abortSignal');
  const clock = facadeFromContextDescriptor(context, 'clock');
  const visitedObjects = new WeakSet();
  const visitedPrototypes = new WeakSet();

  function approvedAccessor(owner, key, descriptor) {
    if (owner !== abortSignal || !ABORT_ACCESSOR_KEYS.has(key)) return false;
    return typeof descriptor.get === 'function' && descriptor.set === undefined;
  }

  function approvedFunction(owner, key, value) {
    if (owner === abortSignal && ABORT_FUNCTION_KEYS.has(key)) {
      return typeof value === 'function';
    }
    if (owner === clock && CLOCK_FUNCTION_KEYS.has(key)) {
      return typeof value === 'function';
    }
    return false;
  }

  function inspectDescriptors(holder, owner, path, depth, prototypeMode = false) {
    const keys = Reflect.ownKeys(holder);
    const orderedKeys = prototypeMode && keys.includes('constructor')
      ? [...keys.filter((key) => key !== 'constructor'), 'constructor']
      : keys;

    for (const key of orderedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(holder, key);
      if (!descriptor) continue;
      const nextPath = childPath(path, key);

      if (!('value' in descriptor)) {
        if (!prototypeMode && approvedAccessor(owner, key, descriptor)) continue;
        fail(nextPath, 'accessor properties are prohibited outside the documented abort facade and are never invoked during inspection.');
      }

      const value = descriptor.value;
      if (typeof value === 'function') {
        if (!prototypeMode && approvedFunction(owner, key, value)) continue;
        fail(nextPath, 'reachable function capability is outside the renderer allowlist.');
      }

      if (value && typeof value === 'object') {
        walk(value, nextPath, depth + 1);
      }
    }
  }

  function inspectPrototypeChain(value, path, depth) {
    let prototype = Object.getPrototypeOf(value);
    let prototypeDepth = depth + 1;

    while (prototype && !TERMINAL_PROTOTYPES.has(prototype)) {
      if (prototypeDepth > maxDepth) {
        fail(`${path}[[Prototype]]`, `capability graph exceeds the v1 maximum depth of ${maxDepth} object edges.`);
      }
      if (visitedPrototypes.has(prototype)) return;
      visitedPrototypes.add(prototype);
      inspectDescriptors(prototype, value, `${path}[[Prototype]]`, prototypeDepth, true);
      prototype = Object.getPrototypeOf(prototype);
      prototypeDepth += 1;
    }
  }

  function walk(value, path, depth) {
    if (depth > maxDepth) {
      fail(path, `capability graph exceeds the v1 maximum depth of ${maxDepth} object edges.`);
    }
    if (visitedObjects.has(value)) return;
    visitedObjects.add(value);

    inspectDescriptors(value, value, path, depth, false);
    inspectPrototypeChain(value, path, depth);
  }

  walk(context, 'context', 0);

  const abortKeys = Object.keys(abortSignal);
  if (abortKeys.length !== ABORT_SIGNAL_KEYS.length || ABORT_SIGNAL_KEYS.some((key, index) => abortKeys[index] !== key)) {
    fail('context.abortSignal', `abort facade must expose exactly: ${ABORT_SIGNAL_KEYS.join(', ')}.`);
  }
  for (const key of ABORT_ACCESSOR_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(abortSignal, key);
    if (!descriptor || !approvedAccessor(abortSignal, key, descriptor)) {
      fail(`context.abortSignal.${key}`, 'abort state must be exposed through a getter with no setter.');
    }
  }
  const abortMethod = Object.getOwnPropertyDescriptor(abortSignal, 'onAbort');
  if (!abortMethod || !('value' in abortMethod) || typeof abortMethod.value !== 'function') {
    fail('context.abortSignal.onAbort', 'abort facade onAbort must be a function-valued data property.');
  }

  const clockKeys = Object.keys(clock);
  if (clockKeys.length !== RENDER_CLOCK_KEYS.length || RENDER_CLOCK_KEYS.some((key, index) => clockKeys[index] !== key)) {
    fail('context.clock', `clock facade must expose exactly: ${RENDER_CLOCK_KEYS.join(', ')}.`);
  }
  for (const key of RENDER_CLOCK_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(clock, key);
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'function') {
      fail(`context.clock.${key}`, 'clock facade methods must be function-valued data properties.');
    }
  }

  return true;
}
