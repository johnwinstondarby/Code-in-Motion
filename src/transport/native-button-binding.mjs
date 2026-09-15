import {
  TRANSPORT_BUTTON_PRESENTATION_KEYS,
  TRANSPORT_BUTTON_RECORD_KEYS,
  TRANSPORT_BUTTON_STATE_KEYS
} from './button-presentation.mjs';

export const TRANSPORT_NATIVE_BUTTON_BINDING_KEYS = Object.freeze(['refresh', 'dispose']);
export const TRANSPORT_NATIVE_BUTTON_BINDING_OPTIONS_KEYS = Object.freeze([
  'controls',
  'presentation',
  'commands'
]);
export const TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS = Object.freeze([
  'playback',
  'previous',
  'next',
  'home',
  'end',
  'restart'
]);
export const TRANSPORT_NATIVE_BUTTON_COMMAND_KEYS = Object.freeze([
  'play',
  'pause',
  'previous',
  'next',
  'home',
  'end',
  'restart'
]);

const STATIC_ACTIONS = Object.freeze({
  previous: 'previous',
  next: 'next',
  home: 'home',
  end: 'end',
  restart: 'restart'
});
const OWNED_ATTRIBUTES = Object.freeze(['aria-label', 'data-cim-action']);

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
  for (const method of ['getAttribute', 'setAttribute', 'removeAttribute', 'addEventListener', 'removeEventListener']) {
    if (typeof readControlValue(control, method, label) !== 'function') {
      fail(`${label}.${method} must be a function.`);
    }
  }
  return control;
}

function readControls(value) {
  assertPlainFrozenObject(value, 'Transport native button controls');
  assertExactOwnKeys(value, TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS, 'Transport native button controls');
  const controls = {};
  const identities = new Set();
  for (const key of TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS) {
    const control = assertNativeButton(
      readEnumerableDataProperty(value, key, 'Transport native button controls'),
      `Transport native button control.${key}`
    );
    if (identities.has(control)) fail('Transport native button controls must be distinct.');
    identities.add(control);
    controls[key] = control;
  }
  return Object.freeze(controls);
}

function assertPresentation(value) {
  assertPlainFrozenObject(value, 'Transport native button presentation');
  assertExactOwnKeys(value, TRANSPORT_BUTTON_PRESENTATION_KEYS, 'Transport native button presentation');
  if (typeof readEnumerableDataProperty(value, 'read', 'Transport native button presentation') !== 'function') {
    fail('Transport native button presentation.read must be a function.');
  }
  return value;
}

function readCommands(value) {
  assertPlainFrozenObject(value, 'Transport native button commands');
  assertExactOwnKeys(value, TRANSPORT_NATIVE_BUTTON_COMMAND_KEYS, 'Transport native button commands');
  const commands = {};
  for (const key of TRANSPORT_NATIVE_BUTTON_COMMAND_KEYS) {
    const command = readEnumerableDataProperty(value, key, 'Transport native button commands');
    if (typeof command !== 'function') fail(`Transport native button commands.${key} must be a function.`);
    commands[key] = command;
  }
  return Object.freeze(commands);
}

function readRecord(record, label, allowedActions) {
  assertPlainFrozenObject(record, label);
  assertExactOwnKeys(record, TRANSPORT_BUTTON_RECORD_KEYS, label);
  const action = readEnumerableDataProperty(record, 'action', label);
  if (!allowedActions.includes(action)) fail(`${label}.action must be one of: ${allowedActions.join(', ')}.`);
  const text = readEnumerableDataProperty(record, 'label', label);
  if (typeof text !== 'string' || text.trim().length === 0) fail(`${label}.label must be a non-empty string.`);
  return Object.freeze({ action, label: text });
}

function readPresentationState(presentation) {
  const state = presentation.read();
  assertPlainFrozenObject(state, 'Transport native button state');
  assertExactOwnKeys(state, TRANSPORT_BUTTON_STATE_KEYS, 'Transport native button state');
  return Object.freeze({
    playback: readRecord(
      readEnumerableDataProperty(state, 'playback', 'Transport native button state'),
      'Transport native button state.playback',
      ['play', 'pause']
    ),
    previous: readRecord(
      readEnumerableDataProperty(state, 'previous', 'Transport native button state'),
      'Transport native button state.previous',
      ['previous']
    ),
    next: readRecord(
      readEnumerableDataProperty(state, 'next', 'Transport native button state'),
      'Transport native button state.next',
      ['next']
    ),
    home: readRecord(
      readEnumerableDataProperty(state, 'home', 'Transport native button state'),
      'Transport native button state.home',
      ['home']
    ),
    end: readRecord(
      readEnumerableDataProperty(state, 'end', 'Transport native button state'),
      'Transport native button state.end',
      ['end']
    ),
    restart: readRecord(
      readEnumerableDataProperty(state, 'restart', 'Transport native button state'),
      'Transport native button state.restart',
      ['restart']
    )
  });
}

function readAttribute(control, name, label) {
  try {
    return control.getAttribute(name);
  } catch {
    fail(`${label} ${name} must be readable.`);
  }
}

function snapshotControls(controls) {
  const snapshots = {};
  for (const key of TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS) {
    const control = controls[key];
    snapshots[key] = {
      textContent: readControlValue(control, 'textContent', `Transport native button control.${key}`),
      attributes: Object.fromEntries(
        OWNED_ATTRIBUTES.map((name) => [name, readAttribute(control, name, `Transport native button control.${key}`)])
      )
    };
  }
  return snapshots;
}

function restoreControls(controls, snapshots) {
  const errors = [];
  for (const key of TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS) {
    const control = controls[key];
    const snapshot = snapshots[key];
    try {
      control.textContent = snapshot.textContent;
    } catch (error) {
      errors.push(error);
    }
    for (const name of OWNED_ATTRIBUTES) {
      try {
        const previous = snapshot.attributes[name];
        if (previous === null) control.removeAttribute(name);
        else control.setAttribute(name, previous);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  return errors;
}

function writeState(controls, state) {
  for (const key of TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS) {
    const control = controls[key];
    const record = state[key];
    control.textContent = record.label;
    control.setAttribute('aria-label', record.label);
    control.setAttribute('data-cim-action', record.action);
  }
}

function applyStateTransactionally(controls, state) {
  const snapshots = snapshotControls(controls);
  try {
    writeState(controls, state);
  } catch (error) {
    const rollbackErrors = restoreControls(controls, snapshots);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Transport native button write failed and rollback was incomplete.'
      );
    }
    throw error;
  }
  return snapshots;
}

function isEligibleClick(event) {
  if (event === null || (typeof event !== 'object' && typeof event !== 'function')) return false;
  try {
    return event.defaultPrevented !== true;
  } catch {
    return false;
  }
}

export function createTransportNativeButtonBinding(optionsInput) {
  assertPlainObject(optionsInput, 'Transport native button binding options');
  assertExactOwnKeys(
    optionsInput,
    TRANSPORT_NATIVE_BUTTON_BINDING_OPTIONS_KEYS,
    'Transport native button binding options'
  );

  const controls = readControls(
    readEnumerableDataProperty(optionsInput, 'controls', 'Transport native button binding options')
  );
  const presentation = assertPresentation(
    readEnumerableDataProperty(optionsInput, 'presentation', 'Transport native button binding options')
  );
  const commands = readCommands(
    readEnumerableDataProperty(optionsInput, 'commands', 'Transport native button binding options')
  );

  const initialState = readPresentationState(presentation);
  const constructorSnapshots = applyStateTransactionally(controls, initialState);
  const activeEntries = new Set();

  const dispatchers = Object.freeze({
    playback() {
      const state = readPresentationState(presentation);
      return commands[state.playback.action]();
    },
    previous() { return commands.previous(); },
    next() { return commands.next(); },
    home() { return commands.home(); },
    end() { return commands.end(); },
    restart() { return commands.restart(); }
  });

  try {
    for (const key of TRANSPORT_NATIVE_BUTTON_CONTROL_KEYS) {
      const control = controls[key];
      const listener = (event) => {
        if (!isEligibleClick(event)) return;
        return dispatchers[key]();
      };
      control.addEventListener('click', listener);
      activeEntries.add({ control, listener });
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of activeEntries) {
      try {
        entry.control.removeEventListener('click', entry.listener);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    rollbackErrors.push(...restoreControls(controls, constructorSnapshots));
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Transport native button construction failed and rollback was incomplete.'
      );
    }
    throw error;
  }

  function refresh() {
    const state = readPresentationState(presentation);
    applyStateTransactionally(controls, state);
  }

  function dispose() {
    if (activeEntries.size === 0) return;
    const errors = [];
    for (const entry of [...activeEntries]) {
      try {
        entry.control.removeEventListener('click', entry.listener);
        activeEntries.delete(entry);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Transport native button disposal was incomplete.');
  }

  const binding = { refresh, dispose };
  assertExactOwnKeys(binding, TRANSPORT_NATIVE_BUTTON_BINDING_KEYS, 'Transport native button binding');
  return Object.freeze(binding);
}
