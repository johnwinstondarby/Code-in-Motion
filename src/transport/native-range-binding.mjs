import {
  TRANSPORT_NATIVE_RANGE_KEYS,
  TRANSPORT_RANGE_PRESENTATION_KEYS,
  TRANSPORT_RANGE_STATE_KEYS
} from './native-range-presentation.mjs';

export const TRANSPORT_NATIVE_RANGE_BINDING_KEYS = Object.freeze(['refresh']);
export const TRANSPORT_NATIVE_RANGE_BINDING_OPTIONS_KEYS = Object.freeze(['control', 'presentation']);

const RANGE_ATTRIBUTE_NAMES = Object.freeze(['aria-label', 'aria-valuetext']);
const RANGE_PROPERTY_NAMES = Object.freeze(['min', 'max', 'step', 'value']);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertPlainFrozenObject(value, label) {
  assertPlainObject(value, label);
  if (!Object.isFrozen(value)) fail(`${label} must be frozen.`);
}

function assertExactOwnKeys(value, expectedKeys, label) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) {
    fail(`${label} must not contain symbol keys.`);
  }
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !keys.includes(key))) {
    fail(`${label} must contain exactly: ${expectedKeys.join(', ')}.`);
  }
}

function readEnumerableDataProperty(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property.`);
  }
  return descriptor.value;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function readControlValue(control, key, label) {
  try {
    return control[key];
  } catch {
    fail(`${label}.${key} must be readable.`);
  }
}

function assertNativeRangeControl(control) {
  if (control === null || (typeof control !== 'object' && typeof control !== 'function')) {
    fail('Transport native range control must be an input element-like object.');
  }

  const tagName = readControlValue(control, 'tagName', 'Transport native range control');
  const type = readControlValue(control, 'type', 'Transport native range control');
  if (typeof tagName !== 'string' || tagName.toUpperCase() !== 'INPUT' || type !== 'range') {
    fail('Transport native range control must identify an input with type range.');
  }

  for (const method of ['getAttribute', 'setAttribute', 'removeAttribute']) {
    const candidate = readControlValue(control, method, 'Transport native range control');
    if (typeof candidate !== 'function') {
      fail(`Transport native range control.${method} must be a function.`);
    }
  }

  for (const property of RANGE_PROPERTY_NAMES) {
    readControlValue(control, property, 'Transport native range control');
  }

  return control;
}

function assertPresentation(presentation) {
  assertPlainFrozenObject(presentation, 'Transport native range presentation');
  assertExactOwnKeys(
    presentation,
    TRANSPORT_RANGE_PRESENTATION_KEYS,
    'Transport native range presentation'
  );
  const read = readEnumerableDataProperty(
    presentation,
    'read',
    'Transport native range presentation'
  );
  if (typeof read !== 'function') {
    fail('Transport native range presentation.read must be a function.');
  }
  return presentation;
}

function readRangeState(presentation) {
  const state = presentation.read();
  assertPlainFrozenObject(state, 'Transport native range presentation state');
  assertExactOwnKeys(state, TRANSPORT_RANGE_STATE_KEYS, 'Transport native range presentation state');

  const range = readEnumerableDataProperty(state, 'range', 'Transport native range presentation state');
  assertPlainFrozenObject(range, 'Transport native range state');
  assertExactOwnKeys(range, TRANSPORT_NATIVE_RANGE_KEYS, 'Transport native range state');

  const min = readEnumerableDataProperty(range, 'min', 'Transport native range state');
  const max = readEnumerableDataProperty(range, 'max', 'Transport native range state');
  const step = readEnumerableDataProperty(range, 'step', 'Transport native range state');
  const value = readEnumerableDataProperty(range, 'value', 'Transport native range state');
  const ariaLabel = readEnumerableDataProperty(range, 'ariaLabel', 'Transport native range state');
  const ariaValueText = readEnumerableDataProperty(range, 'ariaValueText', 'Transport native range state');

  if (min !== 0) fail('Transport native range state.min must be 0.');
  if (!Number.isSafeInteger(max) || max < 1) {
    fail('Transport native range state.max must be a positive safe integer.');
  }
  if (step !== 1) fail('Transport native range state.step must be 1.');
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail('Transport native range state.value must be a valid semantic boundary ordinal.');
  }
  assertNonEmptyString(ariaLabel, 'Transport native range state.ariaLabel');
  assertNonEmptyString(ariaValueText, 'Transport native range state.ariaValueText');

  return range;
}

function readAttribute(control, name) {
  try {
    return control.getAttribute(name);
  } catch {
    fail(`Transport native range control ${name} must be readable.`);
  }
}

function snapshotOwnedFields(control) {
  const properties = {};
  for (const name of RANGE_PROPERTY_NAMES) {
    properties[name] = readControlValue(control, name, 'Transport native range control');
  }

  const attributes = {};
  for (const name of RANGE_ATTRIBUTE_NAMES) {
    attributes[name] = readAttribute(control, name);
  }

  return { properties, attributes };
}

function restoreOwnedFields(control, snapshot) {
  const errors = [];

  for (const name of RANGE_PROPERTY_NAMES) {
    try {
      control[name] = snapshot.properties[name];
    } catch (error) {
      errors.push(error);
    }
  }

  for (const name of RANGE_ATTRIBUTE_NAMES) {
    try {
      const previous = snapshot.attributes[name];
      if (previous === null) control.removeAttribute(name);
      else control.setAttribute(name, previous);
    } catch (error) {
      errors.push(error);
    }
  }

  return errors;
}

function writeRangeState(control, range) {
  const snapshot = snapshotOwnedFields(control);

  try {
    control.min = String(range.min);
    control.max = String(range.max);
    control.step = String(range.step);
    control.value = String(range.value);
    control.setAttribute('aria-label', range.ariaLabel);
    control.setAttribute('aria-valuetext', range.ariaValueText);
  } catch (error) {
    const rollbackErrors = restoreOwnedFields(control, snapshot);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Transport native range binding write failed and rollback was incomplete.'
      );
    }
    throw error;
  }
}

export function createTransportNativeRangeBinding(optionsInput) {
  assertPlainObject(optionsInput, 'Transport native range binding options');
  assertExactOwnKeys(
    optionsInput,
    TRANSPORT_NATIVE_RANGE_BINDING_OPTIONS_KEYS,
    'Transport native range binding options'
  );

  const control = assertNativeRangeControl(
    readEnumerableDataProperty(optionsInput, 'control', 'Transport native range binding options')
  );
  const presentation = assertPresentation(
    readEnumerableDataProperty(optionsInput, 'presentation', 'Transport native range binding options')
  );

  function refresh() {
    const range = readRangeState(presentation);
    writeRangeState(control, range);
  }

  refresh();

  const binding = { refresh };
  assertExactOwnKeys(binding, TRANSPORT_NATIVE_RANGE_BINDING_KEYS, 'Transport native range binding');
  return Object.freeze(binding);
}
