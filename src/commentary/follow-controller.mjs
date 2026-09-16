import {
  COMMENTARY_PRESENTATION_ENTRY_KEYS,
  COMMENTARY_PRESENTATION_KEYS,
  COMMENTARY_PRESENTATION_STATE_KEYS
} from './presentation.mjs';
import { COMMENTARY_LINK_KEYS } from './reveal-projection.mjs';

export const COMMENTARY_FOLLOW_CONTROLLER_KEYS = Object.freeze(['read', 'suspend', 'resume']);
export const COMMENTARY_FOLLOW_OPTIONS_KEYS = Object.freeze(['presentation']);
export const COMMENTARY_FOLLOW_STATE_KEYS = Object.freeze([
  'following',
  'newerStepsAvailable',
  'latestVisibleStepId'
]);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertFrozenPlainObject(value, label) {
  assertPlainObject(value, label);
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

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string.`);
  return value;
}

function validatePresentation(presentation) {
  assertFrozenPlainObject(presentation, 'Commentary presentation capability');
  assertExactKeys(presentation, COMMENTARY_PRESENTATION_KEYS, 'Commentary presentation capability');
  if (typeof dataValue(presentation, 'read', 'Commentary presentation capability') !== 'function') {
    fail('Commentary presentation capability.read must be a function.');
  }
  return presentation;
}

function validateLink(link, entryOffset, linkOffset) {
  const label = `Commentary presentation entries[${entryOffset}].links[${linkOffset}]`;
  assertFrozenPlainObject(link, label);
  assertExactKeys(link, COMMENTARY_LINK_KEYS, label);
  requireNonEmptyString(dataValue(link, 'id', label), `${label}.id`);
  requireNonEmptyString(dataValue(link, 'label', label), `${label}.label`);
  requireNonEmptyString(dataValue(link, 'href', label), `${label}.href`);
}

function validatePresentationState(state) {
  assertFrozenPlainObject(state, 'Commentary presentation state');
  assertExactKeys(state, COMMENTARY_PRESENTATION_STATE_KEYS, 'Commentary presentation state');

  const revealFrontier = requireNonEmptyString(
    dataValue(state, 'revealFrontier', 'Commentary presentation state'),
    'Commentary presentation state.revealFrontier'
  );
  const currentStepId = requireNonEmptyString(
    dataValue(state, 'currentStepId', 'Commentary presentation state'),
    'Commentary presentation state.currentStepId'
  );
  const selectedStepId = dataValue(state, 'selectedStepId', 'Commentary presentation state');
  if (selectedStepId !== null) requireNonEmptyString(selectedStepId, 'Commentary presentation state.selectedStepId');

  const entryCount = dataValue(state, 'entryCount', 'Commentary presentation state');
  if (!Number.isSafeInteger(entryCount) || entryCount < 1) {
    fail('Commentary presentation state.entryCount must be a positive safe integer.');
  }

  const entries = dataValue(state, 'entries', 'Commentary presentation state');
  if (!Array.isArray(entries) || !Object.isFrozen(entries)) {
    fail('Commentary presentation state.entries must be a frozen array.');
  }
  if (entries.length > entryCount) fail('Commentary visible entry count cannot exceed entryCount.');

  const visibleIds = new Set();
  let selectedCount = 0;
  let activeCount = 0;
  for (let offset = 0; offset < entries.length; offset += 1) {
    const entry = entries[offset];
    const label = `Commentary presentation entries[${offset}]`;
    assertFrozenPlainObject(entry, label);
    assertExactKeys(entry, COMMENTARY_PRESENTATION_ENTRY_KEYS, label);

    const stepId = requireNonEmptyString(dataValue(entry, 'stepId', label), `${label}.stepId`);
    if (visibleIds.has(stepId)) fail(`Commentary presentation contains duplicate stepId ${stepId}.`);
    visibleIds.add(stepId);

    const index = dataValue(entry, 'index', label);
    if (index !== offset + 1) fail(`${label}.index must preserve the visible canonical prefix ordinal.`);
    if (typeof dataValue(entry, 'text', label) !== 'string') fail(`${label}.text must be a string.`);

    const links = dataValue(entry, 'links', label);
    if (!Array.isArray(links) || !Object.isFrozen(links)) fail(`${label}.links must be a frozen array.`);
    links.forEach((link, linkOffset) => validateLink(link, offset, linkOffset));

    const selected = dataValue(entry, 'selected', label);
    if (typeof selected !== 'boolean') fail(`${label}.selected must be a boolean.`);
    if (selected) {
      selectedCount += 1;
      if (selectedStepId !== stepId) fail(`${label}.selected must agree with selectedStepId.`);
    }

    const active = dataValue(entry, 'active', label);
    if (typeof active !== 'boolean') fail(`${label}.active must be a boolean.`);
    if (active) {
      activeCount += 1;
      if (currentStepId !== stepId) fail(`${label}.active must agree with currentStepId.`);
    }
  }

  if (selectedCount > 1) fail('Commentary presentation may select at most one visible entry.');
  if (selectedStepId !== null && (!visibleIds.has(selectedStepId) || selectedCount !== 1)) {
    fail('Commentary selectedStepId must identify exactly one visible selected entry.');
  }
  if (activeCount > 1) fail('Commentary presentation may mark at most one visible entry active.');
  if (currentStepId !== 'initial' && (!visibleIds.has(currentStepId) || activeCount !== 1)) {
    fail('Commentary currentStepId must identify exactly one visible active entry or initial.');
  }
  if (currentStepId === 'initial' && activeCount !== 0) {
    fail('Commentary initial state cannot mark an authored entry active.');
  }

  if (entries.length === 0) {
    if (revealFrontier !== 'initial') fail('Commentary empty presentation must have revealFrontier initial.');
  } else if (revealFrontier !== entries[entries.length - 1].stepId) {
    fail('Commentary revealFrontier must identify the final visible entry.');
  }

  return {
    latestVisibleIndex: entries.length,
    latestVisibleStepId: entries.length === 0 ? null : entries[entries.length - 1].stepId
  };
}

function freezeState(following, newerStepsAvailable, latestVisibleStepId) {
  return Object.freeze({
    following,
    newerStepsAvailable,
    latestVisibleStepId
  });
}

export function createCommentaryFollowController(optionsInput) {
  assertPlainObject(optionsInput, 'Commentary follow options');
  assertExactKeys(optionsInput, COMMENTARY_FOLLOW_OPTIONS_KEYS, 'Commentary follow options');
  const presentation = validatePresentation(dataValue(optionsInput, 'presentation', 'Commentary follow options'));

  let following = true;
  let acknowledgedFrontierIndex = null;

  function readFresh() {
    return validatePresentationState(presentation.read());
  }

  function projectFresh() {
    const fresh = readFresh();

    if (acknowledgedFrontierIndex === null || fresh.latestVisibleIndex < acknowledgedFrontierIndex) {
      acknowledgedFrontierIndex = fresh.latestVisibleIndex;
    }

    if (following) {
      acknowledgedFrontierIndex = fresh.latestVisibleIndex;
      return freezeState(true, false, fresh.latestVisibleStepId);
    }

    return freezeState(
      false,
      fresh.latestVisibleIndex > acknowledgedFrontierIndex,
      fresh.latestVisibleStepId
    );
  }

  const controller = {
    read() {
      return projectFresh();
    },

    suspend() {
      const fresh = readFresh();
      if (acknowledgedFrontierIndex === null || fresh.latestVisibleIndex < acknowledgedFrontierIndex) {
        acknowledgedFrontierIndex = fresh.latestVisibleIndex;
      }
      if (following) {
        following = false;
        acknowledgedFrontierIndex = fresh.latestVisibleIndex;
        return freezeState(false, false, fresh.latestVisibleStepId);
      }
      return freezeState(
        false,
        fresh.latestVisibleIndex > acknowledgedFrontierIndex,
        fresh.latestVisibleStepId
      );
    },

    resume() {
      const fresh = readFresh();
      following = true;
      acknowledgedFrontierIndex = fresh.latestVisibleIndex;
      return freezeState(true, false, fresh.latestVisibleStepId);
    }
  };

  assertExactKeys(controller, COMMENTARY_FOLLOW_CONTROLLER_KEYS, 'Commentary follow controller');
  return Object.freeze(controller);
}
