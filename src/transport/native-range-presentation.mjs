import { TRANSPORT_SCRUB_STATE_KEYS } from './scrub-gesture.mjs';

export const TRANSPORT_RANGE_PRESENTATION_KEYS = Object.freeze(['read']);
export const TRANSPORT_RANGE_STATE_KEYS = Object.freeze(['range', 'initialAnchor', 'markers']);
export const TRANSPORT_NATIVE_RANGE_KEYS = Object.freeze([
  'min',
  'max',
  'step',
  'value',
  'ariaLabel',
  'ariaValueText'
]);
export const TRANSPORT_INITIAL_ANCHOR_LABEL_KEYS = Object.freeze([
  'stepId',
  'index',
  'visualLabel',
  'accessibleLabel'
]);
export const TRANSPORT_MARKER_LABEL_KEYS = Object.freeze([
  'stepId',
  'index',
  'visualLabel',
  'accessibleLabel'
]);
export const TRANSPORT_STEP_METADATA_KEYS = Object.freeze([
  'stepId',
  'label',
  'marker'
]);
export const TRANSPORT_SCRUB_OBSERVATION_KEYS = Object.freeze(['read']);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainFrozenObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
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

function assertBoundaryIds(boundaryIds) {
  if (!Array.isArray(boundaryIds) || !Object.isFrozen(boundaryIds)) {
    fail('Transport range boundaryIds must be a frozen array.');
  }
  if (boundaryIds.length < 2 || boundaryIds[0] !== 'initial') {
    fail('Transport range requires initial plus at least one authored semantic boundary.');
  }

  const seen = new Set();
  for (const stepId of boundaryIds) {
    if (typeof stepId !== 'string' || stepId.length === 0 || seen.has(stepId)) {
      fail('Transport range boundary IDs must be unique non-empty strings.');
    }
    seen.add(stepId);
  }
  return boundaryIds;
}

function assertScrubObservation(scrubObservation) {
  assertPlainFrozenObject(scrubObservation, 'Transport scrub observation');
  assertExactOwnKeys(scrubObservation, TRANSPORT_SCRUB_OBSERVATION_KEYS, 'Transport scrub observation');
  const read = readEnumerableDataProperty(scrubObservation, 'read', 'Transport scrub observation');
  if (typeof read !== 'function') {
    fail('Transport scrub observation.read must be a function.');
  }
  return scrubObservation;
}

function assertStepMetadata(steps, boundaryIds) {
  if (!Array.isArray(steps) || !Object.isFrozen(steps)) {
    fail('Transport step metadata must be a frozen array.');
  }
  if (steps.length !== boundaryIds.length - 1) {
    fail('Transport step metadata must contain exactly one record per authored boundary.');
  }

  return Object.freeze(steps.map((step, offset) => {
    const label = `Transport step metadata[${offset}]`;
    assertPlainFrozenObject(step, label);
    assertExactOwnKeys(step, TRANSPORT_STEP_METADATA_KEYS, label);

    const stepId = readEnumerableDataProperty(step, 'stepId', label);
    const fullLabel = readEnumerableDataProperty(step, 'label', label);
    const marker = readEnumerableDataProperty(step, 'marker', label);

    assertNonEmptyString(stepId, `${label}.stepId`);
    assertNonEmptyString(fullLabel, `${label}.label`);
    if (marker !== null) assertNonEmptyString(marker, `${label}.marker`);

    const expectedStepId = boundaryIds[offset + 1];
    if (stepId !== expectedStepId) {
      fail(`${label}.stepId must match canonical boundary order.`);
    }

    return Object.freeze({ stepId, label: fullLabel, marker });
  }));
}

function assertScrubState(state, boundaryIds) {
  assertPlainFrozenObject(state, 'Transport scrub observation state');
  assertExactOwnKeys(state, TRANSPORT_SCRUB_STATE_KEYS, 'Transport scrub observation state');

  const displayStepId = readEnumerableDataProperty(
    state,
    'displayStepId',
    'Transport scrub observation state'
  );
  const displayIndex = readEnumerableDataProperty(
    state,
    'displayIndex',
    'Transport scrub observation state'
  );

  if (!Number.isSafeInteger(displayIndex) || displayIndex < 0 || displayIndex >= boundaryIds.length) {
    fail('Transport scrub observation state.displayIndex must be a valid boundary ordinal.');
  }
  if (displayStepId !== boundaryIds[displayIndex]) {
    fail('Transport scrub observation step identity must match its canonical ordinal.');
  }

  return { displayStepId, displayIndex };
}

function makeInitialAnchor() {
  const anchor = {
    stepId: 'initial',
    index: 0,
    visualLabel: 'Start',
    accessibleLabel: 'Start'
  };
  assertExactOwnKeys(anchor, TRANSPORT_INITIAL_ANCHOR_LABEL_KEYS, 'Transport initial anchor label');
  return Object.freeze(anchor);
}

function makeMarkers(steps) {
  return Object.freeze(steps.map((step, offset) => {
    const marker = {
      stepId: step.stepId,
      index: offset + 1,
      visualLabel: step.marker ?? step.label,
      accessibleLabel: step.label
    };
    assertExactOwnKeys(marker, TRANSPORT_MARKER_LABEL_KEYS, 'Transport marker label');
    return Object.freeze(marker);
  }));
}

function valueTextFor(displayIndex, boundaryCount, initialAnchor, markers) {
  const descriptor = displayIndex === 0 ? initialAnchor : markers[displayIndex - 1];
  return `${descriptor.accessibleLabel}, position ${displayIndex + 1} of ${boundaryCount}`;
}

export function createTransportNativeRangePresentation(optionsInput) {
  if (optionsInput === null || typeof optionsInput !== 'object' || Object.getPrototypeOf(optionsInput) !== Object.prototype) {
    fail('Transport native range presentation options must be a plain object.');
  }
  assertExactOwnKeys(
    optionsInput,
    ['boundaryIds', 'scrubObservation', 'steps', 'ariaLabel'],
    'Transport native range presentation options'
  );

  const boundaryIds = assertBoundaryIds(
    readEnumerableDataProperty(optionsInput, 'boundaryIds', 'Transport native range presentation options')
  );
  const scrubObservation = assertScrubObservation(
    readEnumerableDataProperty(optionsInput, 'scrubObservation', 'Transport native range presentation options')
  );
  const steps = assertStepMetadata(
    readEnumerableDataProperty(optionsInput, 'steps', 'Transport native range presentation options'),
    boundaryIds
  );
  const ariaLabel = assertNonEmptyString(
    readEnumerableDataProperty(optionsInput, 'ariaLabel', 'Transport native range presentation options'),
    'Transport native range presentation options.ariaLabel'
  );

  const initialAnchor = makeInitialAnchor();
  const markers = makeMarkers(steps);
  const max = boundaryIds.length - 1;

  const presentation = {
    read() {
      const { displayIndex } = assertScrubState(scrubObservation.read(), boundaryIds);
      const range = {
        min: 0,
        max,
        step: 1,
        value: displayIndex,
        ariaLabel,
        ariaValueText: valueTextFor(displayIndex, boundaryIds.length, initialAnchor, markers)
      };
      assertExactOwnKeys(range, TRANSPORT_NATIVE_RANGE_KEYS, 'Transport native range state');

      const state = { range: Object.freeze(range), initialAnchor, markers };
      assertExactOwnKeys(state, TRANSPORT_RANGE_STATE_KEYS, 'Transport range presentation state');
      return Object.freeze(state);
    }
  };

  assertExactOwnKeys(presentation, TRANSPORT_RANGE_PRESENTATION_KEYS, 'Transport range presentation');
  return Object.freeze(presentation);
}
