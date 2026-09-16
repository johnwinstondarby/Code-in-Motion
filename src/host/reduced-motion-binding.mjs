import {
  REDUCED_MOTION_CHANGE_KEYS,
  REDUCED_MOTION_CHANGE_RECORD_KEYS
} from '../accessibility/reduced-motion-preference-source.mjs';

export const HOST_REDUCED_MOTION_BINDING_KEYS = Object.freeze(['dispose']);
export const HOST_REDUCED_MOTION_BINDING_OPTIONS_KEYS = Object.freeze(['instance', 'changes']);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertExactKeys(value, expected, label) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) fail(`${label} must not contain symbol keys.`);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    fail(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function dataValue(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property.`);
  }
  return descriptor.value;
}

function assertChanges(changes) {
  assertPlainObject(changes, 'Host reduced-motion changes');
  if (!Object.isFrozen(changes)) fail('Host reduced-motion changes must be frozen.');
  assertExactKeys(changes, REDUCED_MOTION_CHANGE_KEYS, 'Host reduced-motion changes');

  const subscribe = dataValue(changes, 'subscribe', 'Host reduced-motion changes');
  const dispose = dataValue(changes, 'dispose', 'Host reduced-motion changes');
  if (typeof subscribe !== 'function') fail('Host reduced-motion changes.subscribe must be a function.');
  if (typeof dispose !== 'function') fail('Host reduced-motion changes.dispose must be a function.');
  return subscribe;
}

function assertRuntimeInstance(instance) {
  if (instance === null || (typeof instance !== 'object' && typeof instance !== 'function')) {
    fail('Host reduced-motion Runtime instance must be an object.');
  }
  if (!Object.isFrozen(instance)) fail('Host reduced-motion Runtime instance must be frozen.');
  if (typeof instance.applyReducedMotion !== 'function') {
    fail('Host reduced-motion Runtime instance must expose applyReducedMotion().');
  }
}

function readChangeRecord(record) {
  assertPlainObject(record, 'Host reduced-motion change record');
  if (!Object.isFrozen(record)) fail('Host reduced-motion change record must be frozen.');
  assertExactKeys(record, REDUCED_MOTION_CHANGE_RECORD_KEYS, 'Host reduced-motion change record');

  const reducedMotion = dataValue(record, 'reducedMotion', 'Host reduced-motion change record');
  if (typeof reducedMotion !== 'boolean') {
    fail('Host reduced-motion change record.reducedMotion must be boolean.');
  }
  return reducedMotion;
}

export function createHostReducedMotionBinding(optionsInput) {
  assertPlainObject(optionsInput, 'Host reduced-motion binding options');
  assertExactKeys(
    optionsInput,
    HOST_REDUCED_MOTION_BINDING_OPTIONS_KEYS,
    'Host reduced-motion binding options'
  );

  const instance = dataValue(optionsInput, 'instance', 'Host reduced-motion binding options');
  const changes = dataValue(optionsInput, 'changes', 'Host reduced-motion binding options');
  assertRuntimeInstance(instance);
  const subscribe = assertChanges(changes);

  const unsubscribe = subscribe.call(changes, (record) => {
    instance.applyReducedMotion(readChangeRecord(record));
  });
  if (typeof unsubscribe !== 'function') {
    fail('Host reduced-motion changes.subscribe must return an unsubscribe function.');
  }
  if (!Object.isFrozen(unsubscribe)) {
    try {
      unsubscribe();
    } catch {
      // Preserve the unsubscribe-shape failure.
    }
    fail('Host reduced-motion unsubscribe function must be frozen.');
  }

  let open = true;
  const binding = {
    dispose() {
      if (!open) return false;
      unsubscribe();
      open = false;
      return true;
    }
  };
  assertExactKeys(binding, HOST_REDUCED_MOTION_BINDING_KEYS, 'Host reduced-motion binding');
  return Object.freeze(binding);
}
