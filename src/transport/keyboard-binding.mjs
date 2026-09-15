import {
  TRANSPORT_PLAYBACK_ACTION,
  TRANSPORT_PLAYBACK_KEY,
  TRANSPORT_TIMELINE_KEY_ACTION
} from './transport-controller.mjs';

export const TRANSPORT_KEYBOARD_BINDING_KEYS = Object.freeze(['dispose']);

export const TRANSPORT_PLAYBACK_KEYBOARD_OPTIONS_KEYS = Object.freeze([
  'root',
  'timelineKey',
  'playbackKey',
  'playbackPresentation'
]);

const PROTECTED_TAG_NAMES = new Set([
  'A',
  'AUDIO',
  'BUTTON',
  'EMBED',
  'IFRAME',
  'INPUT',
  'OBJECT',
  'OPTION',
  'SELECT',
  'SUMMARY',
  'TEXTAREA',
  'VIDEO'
]);

const PROTECTED_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem'
]);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(input, label) {
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertExactDataOptions(input, expectedKeys, label) {
  assertPlainObject(input, label);
  const keys = Reflect.ownKeys(input);
  if (
    keys.some((key) => typeof key !== 'string') ||
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !keys.includes(key))
  ) {
    fail(`${label} must contain exactly: ${expectedKeys.join(', ')}.`);
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`${label} option ${key} must be an enumerable data property.`);
    }
  }
  return descriptors;
}

function assertRoot(root) {
  if (root === null || (typeof root !== 'object' && typeof root !== 'function')) {
    fail('Transport keyboard root must be an EventTarget-like object.');
  }
  if (typeof root.addEventListener !== 'function' || typeof root.removeEventListener !== 'function') {
    fail('Transport keyboard root must expose addEventListener and removeEventListener.');
  }
  return root;
}

function assertExactOptions(input) {
  const descriptors = assertExactDataOptions(
    input,
    ['root', 'timelineKey'],
    'Transport keyboard binding options'
  );
  const root = assertRoot(descriptors.root.value);
  const timelineKey = descriptors.timelineKey.value;

  if (typeof timelineKey !== 'function') {
    fail('Transport keyboard timelineKey capability must be a function.');
  }

  return { root, timelineKey };
}

function assertPlaybackPresentation(presentation) {
  assertPlainObject(presentation, 'Transport playback presentation');
  if (!Object.isFrozen(presentation)) {
    fail('Transport playback presentation must be frozen.');
  }

  const keys = Reflect.ownKeys(presentation);
  if (keys.length !== 1 || keys[0] !== 'read') {
    fail('Transport playback presentation must contain exactly: read.');
  }

  const descriptor = Object.getOwnPropertyDescriptor(presentation, 'read');
  if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'function') {
    fail('Transport playback presentation.read must be an enumerable function data property.');
  }
  return presentation;
}

function assertPlaybackOptions(input) {
  const descriptors = assertExactDataOptions(
    input,
    TRANSPORT_PLAYBACK_KEYBOARD_OPTIONS_KEYS,
    'Transport playback keyboard binding options'
  );

  const root = assertRoot(descriptors.root.value);
  const timelineKey = descriptors.timelineKey.value;
  const playbackKey = descriptors.playbackKey.value;
  const playbackPresentation = assertPlaybackPresentation(descriptors.playbackPresentation.value);

  if (typeof timelineKey !== 'function') {
    fail('Transport keyboard timelineKey capability must be a function.');
  }
  if (typeof playbackKey !== 'function') {
    fail('Transport keyboard playbackKey capability must be a function.');
  }

  return { root, timelineKey, playbackKey, playbackPresentation };
}

function readAttribute(node, name) {
  if (node === null || (typeof node !== 'object' && typeof node !== 'function')) return null;
  if (typeof node.getAttribute !== 'function') return null;
  try {
    return node.getAttribute(name);
  } catch {
    return '__cim_unreadable__';
  }
}

function isProtectedInteractionNode(node) {
  if (node === null || (typeof node !== 'object' && typeof node !== 'function')) return false;

  let tagName = '';
  try {
    tagName = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
  } catch {
    return true;
  }
  if (PROTECTED_TAG_NAMES.has(tagName)) return true;

  try {
    if (node.isContentEditable === true) return true;
  } catch {
    return true;
  }

  const contentEditable = readAttribute(node, 'contenteditable');
  if (contentEditable === '__cim_unreadable__') return true;
  if (contentEditable !== null && String(contentEditable).toLowerCase() !== 'false') return true;

  const tabIndex = readAttribute(node, 'tabindex');
  if (tabIndex === '__cim_unreadable__') return true;
  if (tabIndex !== null) return true;

  const nativeOptOut = readAttribute(node, 'data-cim-keyboard-native');
  if (nativeOptOut === '__cim_unreadable__') return true;
  if (nativeOptOut !== null) return true;

  const role = readAttribute(node, 'role');
  if (role === '__cim_unreadable__') return true;
  if (typeof role === 'string') {
    const roleTokens = role.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (roleTokens.some((token) => PROTECTED_ROLES.has(token))) return true;
  }

  return false;
}

function hasActiveTextSelection(root) {
  let ownerDocument;
  try {
    ownerDocument = root.ownerDocument;
  } catch {
    return true;
  }

  if (ownerDocument === null || ownerDocument === undefined || typeof ownerDocument.getSelection !== 'function') {
    return false;
  }

  try {
    const selection = ownerDocument.getSelection();
    return selection !== null && selection !== undefined && selection.isCollapsed === false;
  } catch {
    return true;
  }
}

function eventPathWithinRoot(event, root) {
  if (event === null || typeof event !== 'object' || typeof event.composedPath !== 'function') return null;

  let path;
  try {
    path = event.composedPath();
  } catch {
    return null;
  }
  if (!Array.isArray(path)) return null;

  const rootIndex = path.indexOf(root);
  if (rootIndex < 0) return null;
  return path.slice(0, rootIndex);
}

function shouldYieldToNativeInteraction(event, root) {
  if (event.defaultPrevented === true || event.isComposing === true) return true;
  if (event.altKey === true || event.ctrlKey === true || event.metaKey === true || event.shiftKey === true) return true;

  const path = eventPathWithinRoot(event, root);
  if (path === null) return true;
  if (path.some(isProtectedInteractionNode)) return true;

  return hasActiveTextSelection(root);
}

function readPlaybackAction(playbackPresentation) {
  let state;
  try {
    state = playbackPresentation.read();
  } catch {
    return null;
  }

  if (
    state === null ||
    typeof state !== 'object' ||
    Object.getPrototypeOf(state) !== Object.prototype ||
    !Object.isFrozen(state)
  ) {
    return null;
  }

  const keys = Reflect.ownKeys(state);
  if (keys.length !== 1 || keys[0] !== 'action') return null;

  const descriptor = Object.getOwnPropertyDescriptor(state, 'action');
  if (!descriptor?.enumerable || !('value' in descriptor)) return null;

  const action = descriptor.value;
  if (action !== TRANSPORT_PLAYBACK_ACTION.PLAY && action !== TRANSPORT_PLAYBACK_ACTION.PAUSE) {
    return null;
  }
  return action;
}

function installBinding(root, onKeydown) {
  let active = true;
  root.addEventListener('keydown', onKeydown);

  const binding = {
    dispose() {
      if (!active) return null;
      root.removeEventListener('keydown', onKeydown);
      active = false;
      return null;
    }
  };

  const keys = Reflect.ownKeys(binding);
  if (
    keys.length !== TRANSPORT_KEYBOARD_BINDING_KEYS.length ||
    !TRANSPORT_KEYBOARD_BINDING_KEYS.every((key) => keys.includes(key))
  ) {
    fail('Transport keyboard binding surface is invalid.');
  }

  return Object.freeze(binding);
}

export function createTransportKeyboardBinding(optionsInput) {
  const { root, timelineKey } = assertExactOptions(optionsInput);

  function onKeydown(event) {
    const key = event?.key;
    if (TRANSPORT_TIMELINE_KEY_ACTION[key] === undefined) return;
    if (shouldYieldToNativeInteraction(event, root)) return;
    if (typeof event.preventDefault !== 'function') return;

    event.preventDefault();
    timelineKey(key);
  }

  return installBinding(root, onKeydown);
}

export function createTransportPlaybackKeyboardBinding(optionsInput) {
  const { root, timelineKey, playbackKey, playbackPresentation } = assertPlaybackOptions(optionsInput);

  function onKeydown(event) {
    const key = event?.key;
    const isTimelineKey = TRANSPORT_TIMELINE_KEY_ACTION[key] !== undefined;
    const isPlaybackKey = key === TRANSPORT_PLAYBACK_KEY;
    if (!isTimelineKey && !isPlaybackKey) return;

    if (isPlaybackKey && event?.repeat === true) return;
    if (shouldYieldToNativeInteraction(event, root)) return;
    if (typeof event.preventDefault !== 'function') return;

    if (isPlaybackKey) {
      const action = readPlaybackAction(playbackPresentation);
      if (action === null) return;
      event.preventDefault();
      playbackKey(key, action);
      return;
    }

    event.preventDefault();
    timelineKey(key);
  }

  return installBinding(root, onKeydown);
}
