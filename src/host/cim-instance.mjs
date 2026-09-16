import {
  REDUCED_MOTION_PREFERENCE_KEYS
} from '../accessibility/reduced-motion-preference.mjs';
import { createCiMInstance } from '../runtime/cim-instance.mjs';

export const HOST_CIM_INSTANCE_OPTIONS_KEYS = Object.freeze([
  'instanceId',
  'experience',
  'clock',
  'renderer',
  'rendererRoot',
  'reducedMotionPreference'
]);

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

function readReducedMotionPreference(preference) {
  assertPlainObject(preference, 'Host reduced-motion preference');
  if (!Object.isFrozen(preference)) fail('Host reduced-motion preference must be frozen.');
  assertExactKeys(preference, REDUCED_MOTION_PREFERENCE_KEYS, 'Host reduced-motion preference');

  const read = dataValue(preference, 'read', 'Host reduced-motion preference');
  if (typeof read !== 'function') fail('Host reduced-motion preference.read must be a function.');

  const reducedMotion = read();
  if (typeof reducedMotion !== 'boolean') {
    fail('Host reduced-motion preference.read must return boolean.');
  }
  return reducedMotion;
}

export function createHostCiMInstance(optionsInput) {
  assertPlainObject(optionsInput, 'Host CiM instance options');
  assertExactKeys(optionsInput, HOST_CIM_INSTANCE_OPTIONS_KEYS, 'Host CiM instance options');

  const instanceId = dataValue(optionsInput, 'instanceId', 'Host CiM instance options');
  const experience = dataValue(optionsInput, 'experience', 'Host CiM instance options');
  const clock = dataValue(optionsInput, 'clock', 'Host CiM instance options');
  const renderer = dataValue(optionsInput, 'renderer', 'Host CiM instance options');
  const rendererRoot = dataValue(optionsInput, 'rendererRoot', 'Host CiM instance options');
  const reducedMotionPreference = dataValue(
    optionsInput,
    'reducedMotionPreference',
    'Host CiM instance options'
  );

  const reducedMotion = readReducedMotionPreference(reducedMotionPreference);

  return createCiMInstance({
    instanceId,
    experience,
    clock,
    renderer,
    rendererRoot,
    reducedMotion
  });
}
