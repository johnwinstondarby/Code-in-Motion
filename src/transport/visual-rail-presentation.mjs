export const TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS = Object.freeze(['read']);
export const TRANSPORT_VISUAL_RAIL_STATE_KEYS = Object.freeze(['initialAnchor', 'markers']);
export const TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS = Object.freeze([
  'stepId',
  'index',
  'visualLabel',
  'accessibleLabel',
  'current',
  'target',
  'preview'
]);
export const TRANSPORT_VISUAL_MARKER_KEYS = Object.freeze([
  'stepId',
  'index',
  'visualLabel',
  'accessibleLabel',
  'current',
  'target',
  'revealed',
  'preview'
]);

const TIMELINE_KEYS = Object.freeze(['boundaryIds', 'project']);
const TIMELINE_STATE_KEYS = Object.freeze([
  'currentStepId',
  'targetStepId',
  'revealFrontier',
  'initialAnchor',
  'markers'
]);
const TIMELINE_INITIAL_KEYS = Object.freeze(['stepId', 'index', 'current', 'target']);
const TIMELINE_MARKER_KEYS = Object.freeze(['stepId', 'index', 'current', 'target', 'revealed']);
const RANGE_PRESENTATION_KEYS = Object.freeze(['read']);
const RANGE_STATE_KEYS = Object.freeze(['range', 'initialAnchor', 'markers']);
const RANGE_KEYS = Object.freeze(['min', 'max', 'step', 'value', 'ariaLabel', 'ariaValueText']);
const RANGE_LABEL_KEYS = Object.freeze(['stepId', 'index', 'visualLabel', 'accessibleLabel']);

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

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean.`);
  return value;
}

function assertFunctionSurface(surface, expectedKeys, label) {
  assertPlainFrozenObject(surface, label);
  assertExactOwnKeys(surface, expectedKeys, label);
  for (const key of expectedKeys) {
    const value = readEnumerableDataProperty(surface, key, label);
    if (typeof value !== 'function') fail(`${label}.${key} must be a function.`);
  }
  return surface;
}

function readBoundaryIds(timeline) {
  const boundaryIds = timeline.boundaryIds();
  if (!Array.isArray(boundaryIds) || !Object.isFrozen(boundaryIds)) {
    fail('Transport visual rail boundaryIds() must return a frozen array.');
  }
  if (boundaryIds.length < 2 || boundaryIds[0] !== 'initial') {
    fail('Transport visual rail requires initial plus at least one authored boundary.');
  }
  const seen = new Set();
  for (const stepId of boundaryIds) {
    if (typeof stepId !== 'string' || stepId.length === 0 || seen.has(stepId)) {
      fail('Transport visual rail boundary IDs must be unique non-empty strings.');
    }
    seen.add(stepId);
  }
  return boundaryIds;
}

function assertTimelineState(state, boundaryIds) {
  assertPlainFrozenObject(state, 'Transport visual rail timeline state');
  assertExactOwnKeys(state, TIMELINE_STATE_KEYS, 'Transport visual rail timeline state');

  const currentStepId = readEnumerableDataProperty(state, 'currentStepId', 'Transport visual rail timeline state');
  const targetStepId = readEnumerableDataProperty(state, 'targetStepId', 'Transport visual rail timeline state');
  const revealFrontier = readEnumerableDataProperty(state, 'revealFrontier', 'Transport visual rail timeline state');
  if (!boundaryIds.includes(currentStepId)) fail('Transport visual rail currentStepId must identify a known boundary.');
  if (targetStepId !== null && !boundaryIds.includes(targetStepId)) {
    fail('Transport visual rail targetStepId must identify a known boundary or be null.');
  }
  if (!boundaryIds.includes(revealFrontier)) fail('Transport visual rail revealFrontier must identify a known boundary.');

  const initialAnchor = readEnumerableDataProperty(state, 'initialAnchor', 'Transport visual rail timeline state');
  assertPlainFrozenObject(initialAnchor, 'Transport visual rail timeline initial anchor');
  assertExactOwnKeys(initialAnchor, TIMELINE_INITIAL_KEYS, 'Transport visual rail timeline initial anchor');
  if (readEnumerableDataProperty(initialAnchor, 'stepId', 'Transport visual rail timeline initial anchor') !== 'initial') {
    fail('Transport visual rail timeline initial anchor stepId must be initial.');
  }
  if (readEnumerableDataProperty(initialAnchor, 'index', 'Transport visual rail timeline initial anchor') !== 0) {
    fail('Transport visual rail timeline initial anchor index must be 0.');
  }
  assertBoolean(readEnumerableDataProperty(initialAnchor, 'current', 'Transport visual rail timeline initial anchor'), 'Transport visual rail timeline initial anchor.current');
  assertBoolean(readEnumerableDataProperty(initialAnchor, 'target', 'Transport visual rail timeline initial anchor'), 'Transport visual rail timeline initial anchor.target');

  const markers = readEnumerableDataProperty(state, 'markers', 'Transport visual rail timeline state');
  if (!Array.isArray(markers) || !Object.isFrozen(markers) || markers.length !== boundaryIds.length - 1) {
    fail('Transport visual rail timeline markers must be a frozen array aligned with authored boundaries.');
  }
  markers.forEach((marker, offset) => {
    const label = `Transport visual rail timeline marker[${offset}]`;
    assertPlainFrozenObject(marker, label);
    assertExactOwnKeys(marker, TIMELINE_MARKER_KEYS, label);
    if (readEnumerableDataProperty(marker, 'stepId', label) !== boundaryIds[offset + 1]) {
      fail(`${label}.stepId must match canonical boundary order.`);
    }
    if (readEnumerableDataProperty(marker, 'index', label) !== offset + 1) {
      fail(`${label}.index must match canonical boundary order.`);
    }
    assertBoolean(readEnumerableDataProperty(marker, 'current', label), `${label}.current`);
    assertBoolean(readEnumerableDataProperty(marker, 'target', label), `${label}.target`);
    assertBoolean(readEnumerableDataProperty(marker, 'revealed', label), `${label}.revealed`);
  });

  return { initialAnchor, markers };
}

function assertRangeState(state, boundaryIds) {
  assertPlainFrozenObject(state, 'Transport visual rail range state');
  assertExactOwnKeys(state, RANGE_STATE_KEYS, 'Transport visual rail range state');

  const range = readEnumerableDataProperty(state, 'range', 'Transport visual rail range state');
  assertPlainFrozenObject(range, 'Transport visual rail native range state');
  assertExactOwnKeys(range, RANGE_KEYS, 'Transport visual rail native range state');
  const min = readEnumerableDataProperty(range, 'min', 'Transport visual rail native range state');
  const max = readEnumerableDataProperty(range, 'max', 'Transport visual rail native range state');
  const step = readEnumerableDataProperty(range, 'step', 'Transport visual rail native range state');
  const value = readEnumerableDataProperty(range, 'value', 'Transport visual rail native range state');
  if (min !== 0 || max !== boundaryIds.length - 1 || step !== 1) {
    fail('Transport visual rail native range geometry must match canonical boundary ordinals.');
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    fail('Transport visual rail native range value must be a valid boundary ordinal.');
  }
  assertNonEmptyString(readEnumerableDataProperty(range, 'ariaLabel', 'Transport visual rail native range state'), 'Transport visual rail native range state.ariaLabel');
  assertNonEmptyString(readEnumerableDataProperty(range, 'ariaValueText', 'Transport visual rail native range state'), 'Transport visual rail native range state.ariaValueText');

  const initialAnchor = readEnumerableDataProperty(state, 'initialAnchor', 'Transport visual rail range state');
  assertPlainFrozenObject(initialAnchor, 'Transport visual rail range initial anchor');
  assertExactOwnKeys(initialAnchor, RANGE_LABEL_KEYS, 'Transport visual rail range initial anchor');
  if (readEnumerableDataProperty(initialAnchor, 'stepId', 'Transport visual rail range initial anchor') !== 'initial' ||
      readEnumerableDataProperty(initialAnchor, 'index', 'Transport visual rail range initial anchor') !== 0) {
    fail('Transport visual rail range initial anchor must identify initial at ordinal 0.');
  }
  const initialVisualLabel = assertNonEmptyString(
    readEnumerableDataProperty(initialAnchor, 'visualLabel', 'Transport visual rail range initial anchor'),
    'Transport visual rail range initial anchor.visualLabel'
  );
  const initialAccessibleLabel = assertNonEmptyString(
    readEnumerableDataProperty(initialAnchor, 'accessibleLabel', 'Transport visual rail range initial anchor'),
    'Transport visual rail range initial anchor.accessibleLabel'
  );

  const markers = readEnumerableDataProperty(state, 'markers', 'Transport visual rail range state');
  if (!Array.isArray(markers) || !Object.isFrozen(markers) || markers.length !== boundaryIds.length - 1) {
    fail('Transport visual rail range markers must be a frozen array aligned with authored boundaries.');
  }
  const labels = markers.map((marker, offset) => {
    const label = `Transport visual rail range marker[${offset}]`;
    assertPlainFrozenObject(marker, label);
    assertExactOwnKeys(marker, RANGE_LABEL_KEYS, label);
    if (readEnumerableDataProperty(marker, 'stepId', label) !== boundaryIds[offset + 1] ||
        readEnumerableDataProperty(marker, 'index', label) !== offset + 1) {
      fail(`${label} must match canonical boundary order.`);
    }
    return Object.freeze({
      visualLabel: assertNonEmptyString(readEnumerableDataProperty(marker, 'visualLabel', label), `${label}.visualLabel`),
      accessibleLabel: assertNonEmptyString(readEnumerableDataProperty(marker, 'accessibleLabel', label), `${label}.accessibleLabel`)
    });
  });

  return {
    value,
    initialLabel: Object.freeze({ visualLabel: initialVisualLabel, accessibleLabel: initialAccessibleLabel }),
    labels: Object.freeze(labels)
  };
}

export function createTransportVisualRailPresentation(optionsInput) {
  assertPlainObject(optionsInput, 'Transport visual rail presentation options');
  assertExactOwnKeys(optionsInput, ['timeline', 'rangePresentation'], 'Transport visual rail presentation options');

  const timeline = assertFunctionSurface(
    readEnumerableDataProperty(optionsInput, 'timeline', 'Transport visual rail presentation options'),
    TIMELINE_KEYS,
    'Transport visual rail timeline'
  );
  const rangePresentation = assertFunctionSurface(
    readEnumerableDataProperty(optionsInput, 'rangePresentation', 'Transport visual rail presentation options'),
    RANGE_PRESENTATION_KEYS,
    'Transport visual rail range presentation'
  );
  const boundaryIds = readBoundaryIds(timeline);

  const presentation = {
    read() {
      const timelineState = assertTimelineState(timeline.project(), boundaryIds);
      const rangeState = assertRangeState(rangePresentation.read(), boundaryIds);

      const initialAnchor = Object.freeze({
        stepId: 'initial',
        index: 0,
        visualLabel: rangeState.initialLabel.visualLabel,
        accessibleLabel: rangeState.initialLabel.accessibleLabel,
        current: timelineState.initialAnchor.current,
        target: timelineState.initialAnchor.target,
        preview: rangeState.value === 0
      });
      assertExactOwnKeys(initialAnchor, TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS, 'Transport visual initial anchor');

      const markers = Object.freeze(timelineState.markers.map((marker, offset) => {
        const labels = rangeState.labels[offset];
        const visualMarker = Object.freeze({
          stepId: marker.stepId,
          index: marker.index,
          visualLabel: labels.visualLabel,
          accessibleLabel: labels.accessibleLabel,
          current: marker.current,
          target: marker.target,
          revealed: marker.revealed,
          preview: rangeState.value === marker.index
        });
        assertExactOwnKeys(visualMarker, TRANSPORT_VISUAL_MARKER_KEYS, `Transport visual marker[${offset}]`);
        return visualMarker;
      }));

      const state = Object.freeze({ initialAnchor, markers });
      assertExactOwnKeys(state, TRANSPORT_VISUAL_RAIL_STATE_KEYS, 'Transport visual rail state');
      return state;
    }
  };

  assertExactOwnKeys(presentation, TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS, 'Transport visual rail presentation');
  return Object.freeze(presentation);
}
