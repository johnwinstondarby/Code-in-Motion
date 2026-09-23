import { createTransportButtonPresentation } from '../../src/transport/button-presentation.mjs';
import { createTransportPlaybackKeyboardBinding } from '../../src/transport/keyboard-binding.mjs';
import { createTransportNativeButtonBinding } from '../../src/transport/native-button-binding.mjs';
import { createTransportPlaybackPresentation } from '../../src/transport/playback-presentation.mjs';
import { createTransportController } from '../../src/transport/transport-controller.mjs';

export const WORDPRESS_TRANSPORT_BINDING_OPTIONS_KEYS = Object.freeze([
  'root',
  'commandPort',
  'observationPort'
]);
export const WORDPRESS_TRANSPORT_BINDING_KEYS = Object.freeze(['dispose']);

const CONTROL_ORDER = Object.freeze(['home', 'previous', 'playback', 'next', 'end', 'restart']);
const BUTTON_LABELS = Object.freeze({
  play: 'Play',
  pause: 'Pause',
  previous: 'Previous',
  next: 'Next',
  home: 'Start',
  end: 'End',
  restart: 'Restart'
});
const PRESENTATION_REFRESH_MS = 50;

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
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

function assertRoot(root) {
  if (root === null || (typeof root !== 'object' && typeof root !== 'function')) {
    fail('WordPress Transport root must be an object.');
  }
  for (const method of [
    'getAttribute',
    'setAttribute',
    'removeAttribute',
    'addEventListener',
    'removeEventListener',
    'appendChild',
    'removeChild'
  ]) {
    if (typeof root[method] !== 'function') {
      fail(`WordPress Transport root must expose ${method}().`);
    }
  }

  const document = root.ownerDocument;
  if (document === null || (typeof document !== 'object' && typeof document !== 'function')) {
    fail('WordPress Transport root must expose ownerDocument.');
  }
  if (typeof document.createElement !== 'function') {
    fail('WordPress Transport root ownerDocument must expose createElement().');
  }
  if (typeof document.getSelection !== 'function') {
    fail('WordPress Transport root ownerDocument must expose getSelection().');
  }

  const view = document.defaultView;
  if (view === null || (typeof view !== 'object' && typeof view !== 'function')) {
    fail('WordPress Transport root ownerDocument must expose defaultView.');
  }
  if (typeof view.setTimeout !== 'function' || typeof view.clearTimeout !== 'function') {
    fail('WordPress Transport defaultView must expose timeout scheduling.');
  }

  return root;
}

function restoreTabIndex(root, previousTabIndex) {
  if (previousTabIndex === null) root.removeAttribute('tabindex');
  else root.setAttribute('tabindex', previousTabIndex);
}

function createControlSurface(root) {
  const document = root.ownerDocument;
  const container = document.createElement('div');
  container.setAttribute('data-cim-transport-controls', '');
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Code in Motion controls');

  const controls = {};
  for (const key of CONTROL_ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-cim-control', key);
    container.appendChild(button);
    controls[key] = button;
  }

  return Object.freeze({
    container,
    controls: Object.freeze({
      playback: controls.playback,
      previous: controls.previous,
      next: controls.next,
      home: controls.home,
      end: controls.end,
      restart: controls.restart
    })
  });
}

function removeControlSurface(root, container) {
  if (container.parentNode === root) root.removeChild(container);
}

function cleanupAfterConstructionFailure({
  root,
  previousTabIndex,
  keyboardBinding,
  buttonBinding,
  controlSurface,
  refreshTimer
}) {
  const errors = [];
  const view = root.ownerDocument.defaultView;

  if (refreshTimer !== null) {
    try {
      view.clearTimeout(refreshTimer);
    } catch (error) {
      errors.push(error);
    }
  }

  if (buttonBinding !== null) {
    try {
      buttonBinding.dispose();
    } catch (error) {
      errors.push(error);
    }
  }

  if (keyboardBinding !== null) {
    try {
      keyboardBinding.dispose();
    } catch (error) {
      errors.push(error);
    }
  }

  if (controlSurface !== null) {
    try {
      removeControlSurface(root, controlSurface.container);
    } catch (error) {
      errors.push(error);
    }
  }

  try {
    restoreTabIndex(root, previousTabIndex);
  } catch (error) {
    errors.push(error);
  }

  return errors;
}

export function createWordPressTransportBinding(optionsInput) {
  assertPlainObject(optionsInput, 'WordPress Transport binding options');
  assertExactKeys(
    optionsInput,
    WORDPRESS_TRANSPORT_BINDING_OPTIONS_KEYS,
    'WordPress Transport binding options'
  );

  const root = assertRoot(dataValue(optionsInput, 'root', 'WordPress Transport binding options'));
  const commandPort = dataValue(optionsInput, 'commandPort', 'WordPress Transport binding options');
  const observationPort = dataValue(optionsInput, 'observationPort', 'WordPress Transport binding options');
  const previousTabIndex = root.getAttribute('tabindex');
  const view = root.ownerDocument.defaultView;

  let keyboardBinding = null;
  let buttonBinding = null;
  let controlSurface = null;
  let refreshTimer = null;
  let disposed = false;

  try {
    root.setAttribute('tabindex', '0');

    const transport = createTransportController(commandPort);
    const playbackPresentation = createTransportPlaybackPresentation(observationPort);
    const buttonPresentation = createTransportButtonPresentation({
      playbackPresentation,
      labels: BUTTON_LABELS
    });

    controlSurface = createControlSurface(root);

    function cancelPresentationRefresh() {
      if (refreshTimer === null) return;
      view.clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    function refreshControls() {
      if (disposed || buttonBinding === null) return;
      buttonBinding.refresh();
      const action = playbackPresentation.read().action;

      if (action !== 'pause') {
        cancelPresentationRefresh();
        return;
      }
      if (refreshTimer !== null) return;

      refreshTimer = view.setTimeout(() => {
        refreshTimer = null;
        refreshControls();
      }, PRESENTATION_REFRESH_MS);
    }

    function submit(command) {
      const outcome = command();
      refreshControls();
      return outcome;
    }

    const commands = Object.freeze({
      play: () => submit(() => transport.play()),
      pause: () => submit(() => transport.pause()),
      previous: () => submit(() => transport.previous()),
      next: () => submit(() => transport.next()),
      home: () => submit(() => transport.home()),
      end: () => submit(() => transport.end()),
      restart: () => submit(() => transport.restart())
    });

    buttonBinding = createTransportNativeButtonBinding({
      controls: controlSurface.controls,
      presentation: buttonPresentation,
      commands
    });

    keyboardBinding = createTransportPlaybackKeyboardBinding({
      root,
      timelineKey: (key) => submit(() => transport.timelineKey(key)),
      playbackKey: (key, action) => submit(() => transport.playbackKey(key, action)),
      playbackPresentation
    });

    root.appendChild(controlSurface.container);
  } catch (error) {
    const cleanupErrors = cleanupAfterConstructionFailure({
      root,
      previousTabIndex,
      keyboardBinding,
      buttonBinding,
      controlSurface,
      refreshTimer
    });
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'WordPress Transport binding failed and rollback was incomplete.',
        { cause: error }
      );
    }
    throw error;
  }

  function dispose() {
    if (disposed) return null;
    disposed = true;
    const errors = [];

    if (refreshTimer !== null) {
      try {
        view.clearTimeout(refreshTimer);
        refreshTimer = null;
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      buttonBinding.dispose();
    } catch (error) {
      errors.push(error);
    }

    try {
      keyboardBinding.dispose();
    } catch (error) {
      errors.push(error);
    }

    try {
      removeControlSurface(root, controlSurface.container);
    } catch (error) {
      errors.push(error);
    }

    try {
      restoreTabIndex(root, previousTabIndex);
    } catch (error) {
      errors.push(error);
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'WordPress Transport binding disposal failed.');
    }
    return null;
  }

  const binding = { dispose };
  assertExactKeys(binding, WORDPRESS_TRANSPORT_BINDING_KEYS, 'WordPress Transport binding');
  return Object.freeze(binding);
}
