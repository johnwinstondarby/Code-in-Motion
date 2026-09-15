import {
  TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS,
  TRANSPORT_VISUAL_MARKER_KEYS,
  TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS,
  TRANSPORT_VISUAL_RAIL_STATE_KEYS
} from './visual-rail-presentation.mjs';

export const TRANSPORT_VISUAL_RAIL_BINDING_KEYS = Object.freeze(['refresh']);
export const TRANSPORT_VISUAL_RAIL_BINDING_OPTIONS_KEYS = Object.freeze([
  'initialControl',
  'markerControls',
  'presentation'
]);

const COMMON_ATTRIBUTES = Object.freeze([
  'aria-label',
  'aria-current',
  'data-cim-step-id',
  'data-cim-index',
  'data-cim-current',
  'data-cim-target',
  'data-cim-preview'
]);
const MARKER_ATTRIBUTES = Object.freeze([...COMMON_ATTRIBUTES, 'data-cim-revealed']);

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
  readControlValue(control, 'textContent', label);
  for (const method of ['getAttribute', 'setAttribute', 'removeAttribute']) {
    if (typeof readControlValue(control, method, label) !== 'function') {
      fail(`${label}.${method} must be a function.`);
    }
  }
  return control;
}

function assertPresentation(presentation) {
  assertPlainFrozenObject(presentation, 'Transport visual rail DOM presentation');
  assertExactOwnKeys(
    presentation,
    TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS,
    'Transport visual rail DOM presentation'
  );
  if (typeof readEnumerableDataProperty(
    presentation,
    'read',
    'Transport visual rail DOM presentation'
  ) !== 'function') {
    fail('Transport visual rail DOM presentation.read must be a function.');
  }
  return presentation;
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be a non-empty string.`);
  return value;
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean.`);
  return value;
}

function readVisualRecord(record, expectedKeys, label, expectedIndex, expectsRevealed) {
  assertPlainFrozenObject(record, label);
  assertExactOwnKeys(record, expectedKeys, label);
  const stepId = assertString(readEnumerableDataProperty(record, 'stepId', label), `${label}.stepId`);
  const index = readEnumerableDataProperty(record, 'index', label);
  if (!Number.isSafeInteger(index) || index !== expectedIndex) fail(`${label}.index must match control order.`);
  const visualLabel = assertString(readEnumerableDataProperty(record, 'visualLabel', label), `${label}.visualLabel`);
  const accessibleLabel = assertString(readEnumerableDataProperty(record, 'accessibleLabel', label), `${label}.accessibleLabel`);
  const current = assertBoolean(readEnumerableDataProperty(record, 'current', label), `${label}.current`);
  const target = assertBoolean(readEnumerableDataProperty(record, 'target', label), `${label}.target`);
  const preview = assertBoolean(readEnumerableDataProperty(record, 'preview', label), `${label}.preview`);
  const revealed = expectsRevealed
    ? assertBoolean(readEnumerableDataProperty(record, 'revealed', label), `${label}.revealed`)
    : null;
  return { stepId, index, visualLabel, accessibleLabel, current, target, preview, revealed };
}

function readVisualState(presentation, markerCount) {
  const state = presentation.read();
  assertPlainFrozenObject(state, 'Transport visual rail DOM state');
  assertExactOwnKeys(state, TRANSPORT_VISUAL_RAIL_STATE_KEYS, 'Transport visual rail DOM state');

  const initial = readVisualRecord(
    readEnumerableDataProperty(state, 'initialAnchor', 'Transport visual rail DOM state'),
    TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS,
    'Transport visual rail DOM initial anchor',
    0,
    false
  );
  if (initial.stepId !== 'initial') fail('Transport visual rail DOM initial anchor must identify initial.');

  const markers = readEnumerableDataProperty(state, 'markers', 'Transport visual rail DOM state');
  if (!Array.isArray(markers) || !Object.isFrozen(markers) || markers.length !== markerCount) {
    fail('Transport visual rail DOM markers must be a frozen array aligned with marker controls.');
  }
  const seen = new Set(['initial']);
  const normalizedMarkers = markers.map((marker, offset) => {
    const normalized = readVisualRecord(
      marker,
      TRANSPORT_VISUAL_MARKER_KEYS,
      `Transport visual rail DOM marker[${offset}]`,
      offset + 1,
      true
    );
    if (seen.has(normalized.stepId)) fail('Transport visual rail DOM step IDs must be unique.');
    seen.add(normalized.stepId);
    return normalized;
  });
  return { initial, markers: normalizedMarkers };
}

function readAttribute(control, name, label) {
  try {
    return control.getAttribute(name);
  } catch {
    fail(`${label} ${name} must be readable.`);
  }
}

function snapshotControl(control, attributes, label) {
  const snapshot = {
    textContent: readControlValue(control, 'textContent', label),
    attributes: {}
  };
  for (const name of attributes) snapshot.attributes[name] = readAttribute(control, name, label);
  return snapshot;
}

function restoreControl(control, snapshot, attributes) {
  const errors = [];
  try {
    control.textContent = snapshot.textContent;
  } catch (error) {
    errors.push(error);
  }
  for (const name of attributes) {
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

function setAttributeOrRemove(control, name, value) {
  if (value === null) control.removeAttribute(name);
  else control.setAttribute(name, value);
}

function writeRecord(control, record, isMarker) {
  control.textContent = record.visualLabel;
  control.setAttribute('aria-label', record.accessibleLabel);
  setAttributeOrRemove(control, 'aria-current', record.current ? 'step' : null);
  control.setAttribute('data-cim-step-id', record.stepId);
  control.setAttribute('data-cim-index', String(record.index));
  control.setAttribute('data-cim-current', String(record.current));
  control.setAttribute('data-cim-target', String(record.target));
  control.setAttribute('data-cim-preview', String(record.preview));
  if (isMarker) control.setAttribute('data-cim-revealed', String(record.revealed));
}

export function createTransportVisualRailBinding(optionsInput) {
  assertPlainObject(optionsInput, 'Transport visual rail binding options');
  assertExactOwnKeys(
    optionsInput,
    TRANSPORT_VISUAL_RAIL_BINDING_OPTIONS_KEYS,
    'Transport visual rail binding options'
  );

  const initialControl = assertNativeButton(
    readEnumerableDataProperty(optionsInput, 'initialControl', 'Transport visual rail binding options'),
    'Transport visual rail initial control'
  );
  const markerControls = readEnumerableDataProperty(
    optionsInput,
    'markerControls',
    'Transport visual rail binding options'
  );
  if (!Array.isArray(markerControls) || !Object.isFrozen(markerControls) || markerControls.length < 1) {
    fail('Transport visual rail markerControls must be a non-empty frozen array.');
  }
  const controls = [initialControl];
  markerControls.forEach((control, offset) => {
    controls.push(assertNativeButton(control, `Transport visual rail marker control[${offset}]`));
  });
  if (new Set(controls).size !== controls.length) fail('Transport visual rail controls must be distinct.');

  const presentation = assertPresentation(
    readEnumerableDataProperty(optionsInput, 'presentation', 'Transport visual rail binding options')
  );

  function refresh() {
    const state = readVisualState(presentation, markerControls.length);
    const snapshots = [
      snapshotControl(initialControl, COMMON_ATTRIBUTES, 'Transport visual rail initial control'),
      ...markerControls.map((control, offset) => snapshotControl(
        control,
        MARKER_ATTRIBUTES,
        `Transport visual rail marker control[${offset}]`
      ))
    ];

    try {
      writeRecord(initialControl, state.initial, false);
      markerControls.forEach((control, offset) => writeRecord(control, state.markers[offset], true));
    } catch (error) {
      const rollbackErrors = [];
      rollbackErrors.push(...restoreControl(initialControl, snapshots[0], COMMON_ATTRIBUTES));
      markerControls.forEach((control, offset) => {
        rollbackErrors.push(...restoreControl(control, snapshots[offset + 1], MARKER_ATTRIBUTES));
      });
      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          'Transport visual rail binding write failed and rollback was incomplete.'
        );
      }
      throw error;
    }
  }

  refresh();

  const binding = { refresh };
  assertExactOwnKeys(binding, TRANSPORT_VISUAL_RAIL_BINDING_KEYS, 'Transport visual rail binding');
  return Object.freeze(binding);
}
