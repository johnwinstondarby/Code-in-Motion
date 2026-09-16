import {
  COMMENTARY_ENTRY_KEYS,
  COMMENTARY_LINK_KEYS,
  COMMENTARY_REVEAL_PROJECTION_KEYS,
  COMMENTARY_REVEAL_STATE_KEYS
} from './reveal-projection.mjs';

export const COMMENTARY_SELECTION_CONTROLLER_KEYS = Object.freeze(['read', 'select', 'clear']);
export const COMMENTARY_SELECTION_OPTIONS_KEYS = Object.freeze(['reveal']);
export const COMMENTARY_SELECTION_STATE_KEYS = Object.freeze([
  'revealFrontier',
  'selectedStepId',
  'entries'
]);
export const COMMENTARY_SELECTION_ENTRY_KEYS = Object.freeze([
  ...COMMENTARY_ENTRY_KEYS,
  'selected'
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

function validateRevealCapability(reveal) {
  assertFrozenPlainObject(reveal, 'Commentary reveal capability');
  assertExactKeys(reveal, COMMENTARY_REVEAL_PROJECTION_KEYS, 'Commentary reveal capability');
  if (typeof dataValue(reveal, 'read', 'Commentary reveal capability') !== 'function') {
    fail('Commentary reveal capability.read must be a function.');
  }
  return reveal;
}

function validateLink(link, entryIndex, linkIndex) {
  const label = `Commentary reveal entries[${entryIndex}].links[${linkIndex}]`;
  assertFrozenPlainObject(link, label);
  assertExactKeys(link, COMMENTARY_LINK_KEYS, label);
  requireNonEmptyString(dataValue(link, 'id', label), `${label}.id`);
  requireNonEmptyString(dataValue(link, 'label', label), `${label}.label`);
  requireNonEmptyString(dataValue(link, 'href', label), `${label}.href`);
  return link;
}

function validateRevealState(state) {
  assertFrozenPlainObject(state, 'Commentary reveal state');
  assertExactKeys(state, COMMENTARY_REVEAL_STATE_KEYS, 'Commentary reveal state');
  const revealFrontier = requireNonEmptyString(
    dataValue(state, 'revealFrontier', 'Commentary reveal state'),
    'Commentary reveal state.revealFrontier'
  );
  const entries = dataValue(state, 'entries', 'Commentary reveal state');
  if (!Array.isArray(entries) || !Object.isFrozen(entries)) {
    fail('Commentary reveal state.entries must be a frozen array.');
  }

  let priorIndex = 0;
  const seen = new Set();
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    const label = `Commentary reveal entries[${entryIndex}]`;
    assertFrozenPlainObject(entry, label);
    assertExactKeys(entry, COMMENTARY_ENTRY_KEYS, label);
    const stepId = requireNonEmptyString(dataValue(entry, 'stepId', label), `${label}.stepId`);
    if (seen.has(stepId)) fail(`Commentary reveal state contains duplicate stepId ${stepId}.`);
    seen.add(stepId);
    const index = dataValue(entry, 'index', label);
    if (!Number.isInteger(index) || index <= priorIndex) {
      fail(`${label}.index must be a strictly increasing positive integer.`);
    }
    priorIndex = index;
    if (typeof dataValue(entry, 'text', label) !== 'string') fail(`${label}.text must be a string.`);
    const links = dataValue(entry, 'links', label);
    if (!Array.isArray(links) || !Object.isFrozen(links)) fail(`${label}.links must be a frozen array.`);
    links.forEach((link, linkIndex) => validateLink(link, entryIndex, linkIndex));
  }

  return { revealFrontier, entries };
}

function validateStepId(stepId) {
  return requireNonEmptyString(stepId, 'Commentary selected stepId');
}

export function createCommentarySelectionController(optionsInput) {
  assertPlainObject(optionsInput, 'Commentary selection options');
  assertExactKeys(optionsInput, COMMENTARY_SELECTION_OPTIONS_KEYS, 'Commentary selection options');
  const reveal = validateRevealCapability(dataValue(optionsInput, 'reveal', 'Commentary selection options'));

  let selectedStepId = null;

  function project() {
    const { revealFrontier, entries } = validateRevealState(reveal.read());
    const visibleIds = new Set(entries.map((entry) => entry.stepId));
    if (selectedStepId !== null && !visibleIds.has(selectedStepId)) selectedStepId = null;

    const projectedEntries = Object.freeze(entries.map((entry) => Object.freeze({
      stepId: entry.stepId,
      index: entry.index,
      text: entry.text,
      links: entry.links,
      selected: entry.stepId === selectedStepId
    })));

    return Object.freeze({
      revealFrontier,
      selectedStepId,
      entries: projectedEntries
    });
  }

  const controller = {
    read() {
      return project();
    },

    select(stepIdInput) {
      const stepId = validateStepId(stepIdInput);
      const { entries } = validateRevealState(reveal.read());
      if (!entries.some((entry) => entry.stepId === stepId)) {
        throw new RangeError(`Commentary selection requires a currently visible entry; received ${stepId}.`);
      }
      selectedStepId = stepId;
      return project();
    },

    clear() {
      validateRevealState(reveal.read());
      selectedStepId = null;
      return project();
    }
  };

  assertExactKeys(controller, COMMENTARY_SELECTION_CONTROLLER_KEYS, 'Commentary selection controller');
  return Object.freeze(controller);
}
