import { TRANSPORT_TIMELINE_KEYS } from './timeline-projection.mjs';

export const TRANSPORT_SCRUB_GESTURE_KEYS = Object.freeze([
  'begin',
  'update',
  'commit',
  'cancel',
  'read'
]);

export const TRANSPORT_SCRUB_STATE_KEYS = Object.freeze([
  'active',
  'displayStepId',
  'displayIndex',
  'displayRatio'
]);

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

function assertTransportTimeline(timeline) {
  assertPlainFrozenObject(timeline, 'Transport timeline');
  assertExactOwnKeys(timeline, TRANSPORT_TIMELINE_KEYS, 'Transport timeline');
  const descriptors = Object.getOwnPropertyDescriptors(timeline);
  for (const key of TRANSPORT_TIMELINE_KEYS) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'function') {
      fail(`Transport timeline.${key} must be an enumerable function data property.`);
    }
  }
  return timeline;
}

function assertBoundaryIds(boundaryIds) {
  if (!Array.isArray(boundaryIds) || !Object.isFrozen(boundaryIds)) {
    fail('Transport scrub boundaryIds() must return a frozen array.');
  }
  if (boundaryIds.length < 2 || boundaryIds[0] !== 'initial') {
    fail('Transport scrub requires initial plus at least one authored semantic boundary.');
  }
  const seen = new Set();
  for (const stepId of boundaryIds) {
    if (typeof stepId !== 'string' || stepId.length === 0 || seen.has(stepId)) {
      fail('Transport scrub boundary IDs must be unique non-empty strings.');
    }
    seen.add(stepId);
  }
  return boundaryIds;
}

function normalizeRatio(ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
    fail('Transport scrub ratio must be a finite number.');
  }
  return Math.min(1, Math.max(0, ratio));
}

function makeState(active, snap) {
  const state = {
    active,
    displayStepId: snap.stepId,
    displayIndex: snap.index,
    displayRatio: snap.ratio
  };
  assertExactOwnKeys(state, TRANSPORT_SCRUB_STATE_KEYS, 'Transport scrub state');
  return Object.freeze(state);
}

export function resolveTransportScrubSnap(boundaryIdsInput, ratioInput) {
  const boundaryIds = assertBoundaryIds(boundaryIdsInput);
  const ratio = normalizeRatio(ratioInput);
  const lastIndex = boundaryIds.length - 1;
  const scaled = ratio * lastIndex;
  const lower = Math.floor(scaled);
  const upper = Math.ceil(scaled);
  const lowerDistance = scaled - lower;
  const upperDistance = upper - scaled;
  const index = upperDistance < lowerDistance ? upper : lower;

  return Object.freeze({
    stepId: boundaryIds[index],
    index,
    ratio: index / lastIndex
  });
}

export function createTransportScrubGesture(timelineInput, scrubCommitInput) {
  const timeline = assertTransportTimeline(timelineInput);
  if (typeof scrubCommitInput !== 'function') {
    fail('Transport scrub commit capability must be a function.');
  }

  const boundaryIds = assertBoundaryIds(timeline.boundaryIds());
  const boundaryIndex = new Map(boundaryIds.map((stepId, index) => [stepId, index]));
  const lastIndex = boundaryIds.length - 1;
  let active = false;
  let preview = null;

  function canonicalSnap() {
    const projection = timeline.project();
    assertPlainFrozenObject(projection, 'Transport timeline projection');
    const descriptor = Object.getOwnPropertyDescriptor(projection, 'currentStepId');
    if (!descriptor?.enumerable || !('value' in descriptor) || !boundaryIndex.has(descriptor.value)) {
      fail('Transport timeline projection.currentStepId must identify a known semantic boundary.');
    }
    const index = boundaryIndex.get(descriptor.value);
    return Object.freeze({
      stepId: descriptor.value,
      index,
      ratio: index / lastIndex
    });
  }

  const gesture = {
    begin(ratio) {
      if (active) {
        throw new Error('Transport scrub gesture is already active.');
      }
      preview = resolveTransportScrubSnap(boundaryIds, ratio);
      active = true;
      return makeState(true, preview);
    },

    update(ratio) {
      if (!active) return null;
      preview = resolveTransportScrubSnap(boundaryIds, ratio);
      return makeState(true, preview);
    },

    commit() {
      if (!active) return null;
      const stepId = preview.stepId;
      active = false;
      preview = null;
      return scrubCommitInput(stepId);
    },

    cancel() {
      if (!active) return null;
      active = false;
      preview = null;
      return makeState(false, canonicalSnap());
    },

    read() {
      return active ? makeState(true, preview) : makeState(false, canonicalSnap());
    }
  };

  assertExactOwnKeys(gesture, TRANSPORT_SCRUB_GESTURE_KEYS, 'Transport scrub gesture');
  return Object.freeze(gesture);
}
