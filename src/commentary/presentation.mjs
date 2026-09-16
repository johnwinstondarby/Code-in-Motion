import { COMMENTARY_LINK_KEYS } from './reveal-projection.mjs';
import {
  COMMENTARY_SELECTION_CONTROLLER_KEYS,
  COMMENTARY_SELECTION_ENTRY_KEYS,
  COMMENTARY_SELECTION_STATE_KEYS
} from './selection-controller.mjs';

export const COMMENTARY_POSITION_OBSERVATION_KEYS = Object.freeze(['snapshot']);
export const COMMENTARY_PRESENTATION_KEYS = Object.freeze(['read']);
export const COMMENTARY_PRESENTATION_OPTIONS_KEYS = Object.freeze([
  'selection',
  'observation',
  'entryCount'
]);
export const COMMENTARY_PRESENTATION_STATE_KEYS = Object.freeze([
  'revealFrontier',
  'currentStepId',
  'selectedStepId',
  'entryCount',
  'entries'
]);
export const COMMENTARY_PRESENTATION_ENTRY_KEYS = Object.freeze([
  ...COMMENTARY_SELECTION_ENTRY_KEYS,
  'active'
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

function validateSelection(selection) {
  assertFrozenPlainObject(selection, 'Commentary selection capability');
  assertExactKeys(selection, COMMENTARY_SELECTION_CONTROLLER_KEYS, 'Commentary selection capability');
  for (const key of COMMENTARY_SELECTION_CONTROLLER_KEYS) {
    if (typeof dataValue(selection, key, 'Commentary selection capability') !== 'function') {
      fail(`Commentary selection capability.${key} must be a function.`);
    }
  }
  return selection;
}

function validateObservation(observation) {
  assertFrozenPlainObject(observation, 'Commentary position observation');
  assertExactKeys(observation, COMMENTARY_POSITION_OBSERVATION_KEYS, 'Commentary position observation');
  if (typeof dataValue(observation, 'snapshot', 'Commentary position observation') !== 'function') {
    fail('Commentary position observation.snapshot must be a function.');
  }
  return observation;
}

function validateEntryCount(entryCount) {
  if (!Number.isSafeInteger(entryCount) || entryCount < 1) {
    fail('Commentary entryCount must be a positive safe integer.');
  }
  return entryCount;
}

function validateLink(link, entryOffset, linkOffset) {
  const label = `Commentary selection entries[${entryOffset}].links[${linkOffset}]`;
  assertFrozenPlainObject(link, label);
  assertExactKeys(link, COMMENTARY_LINK_KEYS, label);
  requireNonEmptyString(dataValue(link, 'id', label), `${label}.id`);
  requireNonEmptyString(dataValue(link, 'label', label), `${label}.label`);
  requireNonEmptyString(dataValue(link, 'href', label), `${label}.href`);
}

function validateSelectionState(state, entryCount) {
  assertFrozenPlainObject(state, 'Commentary selection state');
  assertExactKeys(state, COMMENTARY_SELECTION_STATE_KEYS, 'Commentary selection state');
  const revealFrontier = requireNonEmptyString(
    dataValue(state, 'revealFrontier', 'Commentary selection state'),
    'Commentary selection state.revealFrontier'
  );
  const selectedStepId = dataValue(state, 'selectedStepId', 'Commentary selection state');
  if (selectedStepId !== null) requireNonEmptyString(selectedStepId, 'Commentary selection state.selectedStepId');
  const entries = dataValue(state, 'entries', 'Commentary selection state');
  if (!Array.isArray(entries) || !Object.isFrozen(entries)) fail('Commentary selection state.entries must be a frozen array.');
  if (entries.length > entryCount) fail('Commentary visible entry count cannot exceed entryCount.');

  let expectedIndex = 1;
  const seen = new Set();
  let selectedCount = 0;
  for (let offset = 0; offset < entries.length; offset += 1) {
    const entry = entries[offset];
    const label = `Commentary selection entries[${offset}]`;
    assertFrozenPlainObject(entry, label);
    assertExactKeys(entry, COMMENTARY_SELECTION_ENTRY_KEYS, label);
    const stepId = requireNonEmptyString(dataValue(entry, 'stepId', label), `${label}.stepId`);
    if (seen.has(stepId)) fail(`Commentary selection state contains duplicate stepId ${stepId}.`);
    seen.add(stepId);
    const index = dataValue(entry, 'index', label);
    if (index !== expectedIndex) fail(`${label}.index must preserve the visible canonical prefix ordinal.`);
    expectedIndex += 1;
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
  }
  if (selectedCount > 1) fail('Commentary selection state may select at most one visible entry.');
  if (selectedStepId !== null && !seen.has(selectedStepId)) {
    fail('Commentary selectedStepId must identify a currently visible entry.');
  }
  if (selectedStepId !== null && selectedCount !== 1) {
    fail('Commentary selectedStepId must have one matching selected entry.');
  }
  return { revealFrontier, selectedStepId, entries };
}

function readCurrentStepId(observation) {
  const snapshot = observation.snapshot();
  assertFrozenPlainObject(snapshot, 'Commentary Runtime snapshot');
  const canonical = dataValue(snapshot, 'canonical', 'Commentary Runtime snapshot');
  assertFrozenPlainObject(canonical, 'Commentary canonical snapshot');
  return requireNonEmptyString(
    dataValue(canonical, 'currentStepId', 'Commentary canonical snapshot'),
    'Commentary canonical snapshot.currentStepId'
  );
}

export function createCommentaryPresentation(optionsInput) {
  assertPlainObject(optionsInput, 'Commentary presentation options');
  assertExactKeys(optionsInput, COMMENTARY_PRESENTATION_OPTIONS_KEYS, 'Commentary presentation options');

  const selection = validateSelection(dataValue(optionsInput, 'selection', 'Commentary presentation options'));
  const observation = validateObservation(dataValue(optionsInput, 'observation', 'Commentary presentation options'));
  const entryCount = validateEntryCount(dataValue(optionsInput, 'entryCount', 'Commentary presentation options'));

  const presentation = {
    read() {
      const selectionState = validateSelectionState(selection.read(), entryCount);
      const currentStepId = readCurrentStepId(observation);
      const visibleIds = new Set(selectionState.entries.map((entry) => entry.stepId));
      if (currentStepId !== 'initial' && !visibleIds.has(currentStepId)) {
        fail('Commentary currentStepId must be initial or a currently revealed entry.');
      }

      return Object.freeze({
        revealFrontier: selectionState.revealFrontier,
        currentStepId,
        selectedStepId: selectionState.selectedStepId,
        entryCount,
        entries: Object.freeze(selectionState.entries.map((entry) => Object.freeze({
          stepId: entry.stepId,
          index: entry.index,
          text: entry.text,
          links: entry.links,
          selected: entry.selected,
          active: entry.stepId === currentStepId
        })))
      });
    }
  };

  assertExactKeys(presentation, COMMENTARY_PRESENTATION_KEYS, 'Commentary presentation');
  return Object.freeze(presentation);
}
