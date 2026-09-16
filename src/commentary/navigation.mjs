import { COMMAND_SOURCE } from '../contracts/events.mjs';

export const COMMENTARY_COMMAND_PORT_KEYS = Object.freeze(['seek']);
export const COMMENTARY_NAVIGATION_KEYS = Object.freeze(['seek']);

function fail(message) {
  throw new TypeError(message);
}

function assertFrozenPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
  if (!Object.isFrozen(value)) fail(`${label} must be frozen.`);
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

export function createCommentaryNavigation(commandPort) {
  assertFrozenPlainObject(commandPort, 'Commentary command port');
  assertExactKeys(commandPort, COMMENTARY_COMMAND_PORT_KEYS, 'Commentary command port');
  const seek = dataValue(commandPort, 'seek', 'Commentary command port');
  if (typeof seek !== 'function') fail('Commentary command port.seek must be a function.');

  const navigation = {
    seek(stepId) {
      if (typeof stepId !== 'string' || stepId.length === 0) {
        fail('Commentary navigation stepId must be a non-empty string.');
      }
      return seek(stepId, COMMAND_SOURCE.COMMENTARY);
    }
  };
  assertExactKeys(navigation, COMMENTARY_NAVIGATION_KEYS, 'Commentary navigation');
  return Object.freeze(navigation);
}
