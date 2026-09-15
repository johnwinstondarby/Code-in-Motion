import {
  TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS,
  TRANSPORT_VISUAL_MARKER_KEYS,
  TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS,
  TRANSPORT_VISUAL_RAIL_STATE_KEYS
} from './visual-rail-presentation.mjs';

export const TRANSPORT_MARKER_INTERACTION_KEYS = Object.freeze(['dispose']);
export const TRANSPORT_MARKER_INTERACTION_OPTIONS_KEYS = Object.freeze([
  'initialControl',
  'markerControls',
  'presentation',
  'marker'
]);

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
  if (keys.some((key) => typeof key !== 'string')) fail(`${label} must not contain symbol keys.`);
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

function readControlValue(control, key, label) {
  try {
    return control[key];
  } catch {
    fail(`${label}.${key} must be readable.`);
  }
}

function assertNativeButton(control, label) {
  if (control === null || (typeof control !== 'object' && typeof control !== 'function')) {
    fail(`${label} must be a button element-like object.`);
  }
  const tagName = readControlValue(control, 'tagName', label);
  const type = readControlValue(control, 'type', label);
  if (typeof tagName !== 'string' || tagName.toUpperCase() !== 'BUTTON' || type !== 'button') {
    fail(`${label} must identify a button with type button.`);
  }
  for (const method of ['addEventListener', 'removeEventListener']) {
    if (typeof readControlValue(control, method, label) !== 'function') {
      fail(`${label}.${method} must be a function.`);
    }
  }
  return control;
}

function assertPresentation(presentation) {
  assertPlainFrozenObject(presentation, 'Transport marker presentation');
  assertExactOwnKeys(presentation, TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS, 'Transport marker presentation');
  if (typeof readEnumerableDataProperty(presentation, 'read', 'Transport marker presentation') !== 'function') {
    fail('Transport marker presentation.read must be a function.');
  }
  return presentation;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be a non-empty string.`);
  return value;
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean.`);
}

function readRecord(record, expectedKeys, label, expectedIndex, expectsRevealed) {
  assertPlainFrozenObject(record, label);
  assertExactOwnKeys(record, expectedKeys, label);
  const stepId = assertNonEmptyString(readEnumerableDataProperty(record, 'stepId', label), `${label}.stepId`);
  const index = readEnumerableDataProperty(record, 'index', label);
  if (!Number.isSafeInteger(index) || index !== expectedIndex) fail(`${label}.index must match control order.`);
  assertNonEmptyString(readEnumerableDataProperty(record, 'visualLabel', label), `${label}.visualLabel`);
  assertNonEmptyString(readEnumerableDataProperty(record, 'accessibleLabel', label), `${label}.accessibleLabel`);
  assertBoolean(readEnumerableDataProperty(record, 'current', label), `${label}.current`);
  assertBoolean(readEnumerableDataProperty(record, 'target', label), `${label}.target`);
  if (expectsRevealed) assertBoolean(readEnumerableDataProperty(record, 'revealed', label), `${label}.revealed`);
  assertBoolean(readEnumerableDataProperty(record, 'preview', label), `${label}.preview`);
  return stepId;
}

function captureStepIds(presentation, markerCount) {
  const state = presentation.read();
  assertPlainFrozenObject(state, 'Transport marker presentation state');
  assertExactOwnKeys(state, TRANSPORT_VISUAL_RAIL_STATE_KEYS, 'Transport marker presentation state');

  const initial = readEnumerableDataProperty(state, 'initialAnchor', 'Transport marker presentation state');
  const initialStepId = readRecord(
    initial,
    TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS,
    'Transport marker initial anchor',
    0,
    false
  );
  if (initialStepId !== 'initial') fail('Transport marker initial anchor must identify initial.');

  const markers = readEnumerableDataProperty(state, 'markers', 'Transport marker presentation state');
  if (!Array.isArray(markers) || !Object.isFrozen(markers) || markers.length !== markerCount) {
    fail('Transport marker presentation markers must be a frozen array aligned with marker controls.');
  }

  const stepIds = ['initial'];
  const seen = new Set(stepIds);
  markers.forEach((record, offset) => {
    const stepId = readRecord(
      record,
      TRANSPORT_VISUAL_MARKER_KEYS,
      `Transport marker record[${offset}]`,
      offset + 1,
      true
    );
    if (seen.has(stepId)) fail('Transport marker step IDs must be unique.');
    seen.add(stepId);
    stepIds.push(stepId);
  });
  return Object.freeze(stepIds);
}

function assertClickEvent(event) {
  if (event === null || (typeof event !== 'object' && typeof event !== 'function')) return false;
  try {
    return event.defaultPrevented !== true;
  } catch {
    return false;
  }
}

export function createTransportMarkerInteraction(optionsInput) {
  assertPlainObject(optionsInput, 'Transport marker interaction options');
  assertExactOwnKeys(
    optionsInput,
    TRANSPORT_MARKER_INTERACTION_OPTIONS_KEYS,
    'Transport marker interaction options'
  );

  const initialControl = assertNativeButton(
    readEnumerableDataProperty(optionsInput, 'initialControl', 'Transport marker interaction options'),
    'Transport marker initial control'
  );
  const markerControls = readEnumerableDataProperty(
    optionsInput,
    'markerControls',
    'Transport marker interaction options'
  );
  if (!Array.isArray(markerControls) || !Object.isFrozen(markerControls) || markerControls.length < 1) {
    fail('Transport marker markerControls must be a non-empty frozen array.');
  }
  markerControls.forEach((control, offset) => {
    assertNativeButton(control, `Transport marker control[${offset}]`);
  });
  const controls = Object.freeze([initialControl, ...markerControls]);
  if (new Set(controls).size !== controls.length) fail('Transport marker controls must be distinct.');

  const presentation = assertPresentation(
    readEnumerableDataProperty(optionsInput, 'presentation', 'Transport marker interaction options')
  );
  const marker = readEnumerableDataProperty(optionsInput, 'marker', 'Transport marker interaction options');
  if (typeof marker !== 'function') fail('Transport marker interaction marker must be a function.');

  const stepIds = captureStepIds(presentation, markerControls.length);
  const activeEntries = new Set();

  try {
    controls.forEach((control, index) => {
      const listener = (event) => {
        if (!assertClickEvent(event)) return;
        marker(stepIds[index]);
      };
      control.addEventListener('click', listener);
      activeEntries.add({ control, listener });
    });
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of activeEntries) {
      try {
        entry.control.removeEventListener('click', entry.listener);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Transport marker interaction listener installation failed and rollback was incomplete.'
      );
    }
    throw error;
  }

  function dispose() {
    if (activeEntries.size === 0) return;
    const errors = [];
    for (const entry of [...activeEntries]) {
      try {
        entry.control.removeEventListener('click', entry.listener);
        activeEntries.delete(entry);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Transport marker interaction disposal was incomplete.');
    }
  }

  const surface = { dispose };
  assertExactOwnKeys(surface, TRANSPORT_MARKER_INTERACTION_KEYS, 'Transport marker interaction');
  return Object.freeze(surface);
}
