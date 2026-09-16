import { COMMENTARY_LINK_KEYS } from './reveal-projection.mjs';
import {
  COMMENTARY_PRESENTATION_ENTRY_KEYS,
  COMMENTARY_PRESENTATION_KEYS,
  COMMENTARY_PRESENTATION_STATE_KEYS
} from './presentation.mjs';

export const COMMENTARY_NATIVE_BINDING_KEYS = Object.freeze(['refresh', 'dispose']);
export const COMMENTARY_NATIVE_BINDING_OPTIONS_KEYS = Object.freeze([
  'controls',
  'presentation',
  'select',
  'navigate'
]);
export const COMMENTARY_NATIVE_CONTROL_KEYS = Object.freeze(['root', 'text', 'select', 'links']);

const ROOT_ATTRIBUTES = Object.freeze(['data-cim-step-id', 'data-cim-selected', 'aria-current']);
const LINK_ATTRIBUTES = Object.freeze(['href', 'data-cim-link-id']);

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

function readProperty(element, key, label) {
  try {
    return element[key];
  } catch {
    fail(`${label}.${key} must be readable.`);
  }
}

function requireElementMethods(element, methods, label) {
  if (element === null || (typeof element !== 'object' && typeof element !== 'function')) {
    fail(`${label} must be an element-like object.`);
  }
  for (const method of methods) {
    if (typeof readProperty(element, method, label) !== 'function') fail(`${label}.${method} must be a function.`);
  }
  return element;
}

function assertRoot(root, label) {
  requireElementMethods(root, ['getAttribute', 'setAttribute', 'removeAttribute'], label);
  readProperty(root, 'hidden', label);
  return root;
}

function assertTextNode(text, label) {
  requireElementMethods(text, [], label);
  readProperty(text, 'textContent', label);
  return text;
}

function assertNativeButton(button, label) {
  requireElementMethods(button, ['addEventListener', 'removeEventListener'], label);
  const tagName = readProperty(button, 'tagName', label);
  const type = readProperty(button, 'type', label);
  if (typeof tagName !== 'string' || tagName.toUpperCase() !== 'BUTTON' || type !== 'button') {
    fail(`${label} must identify a button with type button.`);
  }
  return button;
}

function assertNativeAnchor(anchor, label) {
  requireElementMethods(anchor, ['getAttribute', 'setAttribute', 'removeAttribute'], label);
  const tagName = readProperty(anchor, 'tagName', label);
  if (typeof tagName !== 'string' || tagName.toUpperCase() !== 'A') fail(`${label} must identify an anchor element.`);
  readProperty(anchor, 'textContent', label);
  return anchor;
}

function validateControls(controls) {
  if (!Array.isArray(controls) || !Object.isFrozen(controls) || controls.length < 1) {
    fail('Commentary controls must be a non-empty frozen array.');
  }
  const allNodes = [];
  const validated = controls.map((record, offset) => {
    const label = `Commentary controls[${offset}]`;
    assertFrozenPlainObject(record, label);
    assertExactKeys(record, COMMENTARY_NATIVE_CONTROL_KEYS, label);
    const root = assertRoot(dataValue(record, 'root', label), `${label}.root`);
    const text = assertTextNode(dataValue(record, 'text', label), `${label}.text`);
    const select = assertNativeButton(dataValue(record, 'select', label), `${label}.select`);
    const links = dataValue(record, 'links', label);
    if (!Array.isArray(links) || !Object.isFrozen(links)) fail(`${label}.links must be a frozen array.`);
    links.forEach((link, linkOffset) => assertNativeAnchor(link, `${label}.links[${linkOffset}]`));
    allNodes.push(root, text, select, ...links);
    return Object.freeze({ root, text, select, links });
  });
  if (new Set(allNodes).size !== allNodes.length) fail('Commentary native control nodes must be distinct.');
  return Object.freeze(validated);
}

function validatePresentationCapability(presentation) {
  assertFrozenPlainObject(presentation, 'Commentary native presentation');
  assertExactKeys(presentation, COMMENTARY_PRESENTATION_KEYS, 'Commentary native presentation');
  if (typeof dataValue(presentation, 'read', 'Commentary native presentation') !== 'function') {
    fail('Commentary native presentation.read must be a function.');
  }
  return presentation;
}

function validateLink(link, entryOffset, linkOffset) {
  const label = `Commentary native state.entries[${entryOffset}].links[${linkOffset}]`;
  assertFrozenPlainObject(link, label);
  assertExactKeys(link, COMMENTARY_LINK_KEYS, label);
  return {
    id: requireNonEmptyString(dataValue(link, 'id', label), `${label}.id`),
    label: requireNonEmptyString(dataValue(link, 'label', label), `${label}.label`),
    href: requireNonEmptyString(dataValue(link, 'href', label), `${label}.href`)
  };
}

function validatePresentationState(state, controlCount) {
  assertFrozenPlainObject(state, 'Commentary native presentation state');
  assertExactKeys(state, COMMENTARY_PRESENTATION_STATE_KEYS, 'Commentary native presentation state');
  const revealFrontier = requireNonEmptyString(
    dataValue(state, 'revealFrontier', 'Commentary native presentation state'),
    'Commentary native presentation state.revealFrontier'
  );
  const currentStepId = requireNonEmptyString(
    dataValue(state, 'currentStepId', 'Commentary native presentation state'),
    'Commentary native presentation state.currentStepId'
  );
  const selectedStepId = dataValue(state, 'selectedStepId', 'Commentary native presentation state');
  if (selectedStepId !== null) requireNonEmptyString(selectedStepId, 'Commentary native presentation state.selectedStepId');
  const entryCount = dataValue(state, 'entryCount', 'Commentary native presentation state');
  if (entryCount !== controlCount) fail('Commentary native presentation entryCount must match control count.');
  const entries = dataValue(state, 'entries', 'Commentary native presentation state');
  if (!Array.isArray(entries) || !Object.isFrozen(entries) || entries.length > controlCount) {
    fail('Commentary native presentation entries must be a frozen visible prefix within control count.');
  }

  const normalized = [];
  let activeCount = 0;
  let selectedCount = 0;
  for (let offset = 0; offset < entries.length; offset += 1) {
    const entry = entries[offset];
    const label = `Commentary native state.entries[${offset}]`;
    assertFrozenPlainObject(entry, label);
    assertExactKeys(entry, COMMENTARY_PRESENTATION_ENTRY_KEYS, label);
    const stepId = requireNonEmptyString(dataValue(entry, 'stepId', label), `${label}.stepId`);
    const index = dataValue(entry, 'index', label);
    if (index !== offset + 1) fail(`${label}.index must match the visible canonical prefix ordinal.`);
    const text = dataValue(entry, 'text', label);
    if (typeof text !== 'string') fail(`${label}.text must be a string.`);
    const links = dataValue(entry, 'links', label);
    if (!Array.isArray(links) || !Object.isFrozen(links)) fail(`${label}.links must be a frozen array.`);
    const projectedLinks = links.map((link, linkOffset) => validateLink(link, offset, linkOffset));
    const selected = dataValue(entry, 'selected', label);
    const active = dataValue(entry, 'active', label);
    if (typeof selected !== 'boolean' || typeof active !== 'boolean') fail(`${label} flags must be boolean.`);
    if (selected) {
      selectedCount += 1;
      if (selectedStepId !== stepId) fail(`${label}.selected must agree with selectedStepId.`);
    }
    if (active) {
      activeCount += 1;
      if (currentStepId !== stepId) fail(`${label}.active must agree with currentStepId.`);
    }
    normalized.push({ stepId, index, text, links: projectedLinks, selected, active });
  }
  if (selectedCount > 1 || activeCount > 1) fail('Commentary native state may have at most one selected and one active entry.');
  if (selectedStepId !== null && selectedCount !== 1) fail('Commentary native selectedStepId must match one visible entry.');
  if (currentStepId !== 'initial' && activeCount !== 1) fail('Commentary native currentStepId must match one visible entry.');
  return { revealFrontier, currentStepId, selectedStepId, entryCount, entries: normalized };
}

function getAttribute(element, name, label) {
  try {
    return element.getAttribute(name);
  } catch {
    fail(`${label}.getAttribute(${name}) must succeed.`);
  }
}

function setAttribute(element, name, value) {
  element.setAttribute(name, value);
}

function restoreAttribute(element, name, value) {
  if (value === null || value === undefined) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function snapshotDom(controls) {
  return controls.map((control, offset) => ({
    rootHidden: control.root.hidden,
    rootAttributes: Object.fromEntries(ROOT_ATTRIBUTES.map((name) => [name, getAttribute(control.root, name, `Commentary controls[${offset}].root`)])),
    textContent: control.text.textContent,
    links: control.links.map((link, linkOffset) => ({
      textContent: link.textContent,
      attributes: Object.fromEntries(LINK_ATTRIBUTES.map((name) => [name, getAttribute(link, name, `Commentary controls[${offset}].links[${linkOffset}]`)]))
    }))
  }));
}

function restoreDom(controls, snapshot) {
  const errors = [];
  controls.forEach((control, offset) => {
    const prior = snapshot[offset];
    try { control.root.hidden = prior.rootHidden; } catch (error) { errors.push(error); }
    for (const name of ROOT_ATTRIBUTES) {
      try { restoreAttribute(control.root, name, prior.rootAttributes[name]); } catch (error) { errors.push(error); }
    }
    try { control.text.textContent = prior.textContent; } catch (error) { errors.push(error); }
    control.links.forEach((link, linkOffset) => {
      const linkPrior = prior.links[linkOffset];
      try { link.textContent = linkPrior.textContent; } catch (error) { errors.push(error); }
      for (const name of LINK_ATTRIBUTES) {
        try { restoreAttribute(link, name, linkPrior.attributes[name]); } catch (error) { errors.push(error); }
      }
    });
  });
  return errors;
}

function applyState(controls, state) {
  controls.forEach((control, offset) => {
    const entry = state.entries[offset] ?? null;
    control.root.hidden = entry === null;
    if (entry === null) {
      control.root.setAttribute('data-cim-selected', 'false');
      control.root.removeAttribute('aria-current');
      return;
    }
    if (control.links.length !== entry.links.length) {
      fail(`Commentary controls[${offset}].links must match the validated structured link count.`);
    }
    setAttribute(control.root, 'data-cim-step-id', entry.stepId);
    setAttribute(control.root, 'data-cim-selected', entry.selected ? 'true' : 'false');
    if (entry.active) setAttribute(control.root, 'aria-current', 'step');
    else control.root.removeAttribute('aria-current');
    control.text.textContent = entry.text;
    entry.links.forEach((linkData, linkOffset) => {
      const link = control.links[linkOffset];
      link.textContent = linkData.label;
      setAttribute(link, 'href', linkData.href);
      setAttribute(link, 'data-cim-link-id', linkData.id);
    });
  });
}

function eligibleClick(event) {
  if (event === null || (typeof event !== 'object' && typeof event !== 'function')) return false;
  try {
    return event.defaultPrevented !== true;
  } catch {
    return false;
  }
}

export function createCommentaryNativeBinding(optionsInput) {
  assertPlainObject(optionsInput, 'Commentary native binding options');
  assertExactKeys(optionsInput, COMMENTARY_NATIVE_BINDING_OPTIONS_KEYS, 'Commentary native binding options');

  const controls = validateControls(dataValue(optionsInput, 'controls', 'Commentary native binding options'));
  const presentation = validatePresentationCapability(dataValue(optionsInput, 'presentation', 'Commentary native binding options'));
  const select = dataValue(optionsInput, 'select', 'Commentary native binding options');
  const navigate = dataValue(optionsInput, 'navigate', 'Commentary native binding options');
  if (typeof select !== 'function') fail('Commentary native binding select must be a function.');
  if (typeof navigate !== 'function') fail('Commentary native binding navigate must be a function.');

  const listeners = new Map();
  let disposalStarted = false;

  function readState() {
    return validatePresentationState(presentation.read(), controls.length);
  }

  function installListener(offset, stepId) {
    const existing = listeners.get(offset);
    if (existing) {
      if (existing.stepId !== stepId) fail('Commentary captured semantic identity cannot change for one control ordinal.');
      return null;
    }
    const control = controls[offset].select;
    const listener = (event) => {
      if (disposalStarted || !eligibleClick(event)) return;
      const fresh = readState();
      const entry = fresh.entries[offset];
      if (!entry) return;
      if (entry.stepId !== stepId) fail('Commentary activation semantic identity no longer matches validated presentation.');
      select(stepId);
      try {
        navigate(stepId);
      } finally {
        refresh();
      }
    };
    control.addEventListener('click', listener);
    const record = { control, listener, stepId };
    listeners.set(offset, record);
    return record;
  }

  function refresh() {
    if (disposalStarted) fail('Commentary native binding cannot refresh after disposal begins.');
    const state = readState();
    for (let offset = 0; offset < state.entries.length; offset += 1) {
      const existing = listeners.get(offset);
      if (existing && existing.stepId !== state.entries[offset].stepId) {
        fail('Commentary captured semantic identity cannot change for one control ordinal.');
      }
      if (controls[offset].links.length !== state.entries[offset].links.length) {
        fail(`Commentary controls[${offset}].links must match the validated structured link count.`);
      }
    }

    const priorDom = snapshotDom(controls);
    const installed = [];
    try {
      applyState(controls, state);
      state.entries.forEach((entry, offset) => {
        const record = installListener(offset, entry.stepId);
        if (record) installed.push([offset, record]);
      });
      return state;
    } catch (error) {
      const rollbackErrors = [];
      for (const [offset, record] of installed.reverse()) {
        try {
          record.control.removeEventListener('click', record.listener);
          listeners.delete(offset);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      rollbackErrors.push(...restoreDom(controls, priorDom));
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], 'Commentary native refresh failed and rollback was incomplete.');
      }
      throw error;
    }
  }

  function dispose() {
    disposalStarted = true;
    if (listeners.size === 0) return;
    const errors = [];
    for (const [offset, record] of [...listeners.entries()]) {
      try {
        record.control.removeEventListener('click', record.listener);
        listeners.delete(offset);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Commentary native binding disposal was incomplete.');
  }

  refresh();

  const surface = { refresh, dispose };
  assertExactKeys(surface, COMMENTARY_NATIVE_BINDING_KEYS, 'Commentary native binding');
  return Object.freeze(surface);
}
