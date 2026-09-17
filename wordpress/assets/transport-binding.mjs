import { createTransportKeyboardBinding } from '../../src/transport/keyboard-binding.mjs';
import { createTransportController } from '../../src/transport/transport-controller.mjs';

export const WORDPRESS_TRANSPORT_BINDING_OPTIONS_KEYS = Object.freeze([
  'root',
  'commandPort'
]);
export const WORDPRESS_TRANSPORT_BINDING_KEYS = Object.freeze(['dispose']);

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
    'removeEventListener'
  ]) {
    if (typeof root[method] !== 'function') {
      fail(`WordPress Transport root must expose ${method}().`);
    }
  }
  return root;
}

function restoreTabIndex(root, previousTabIndex) {
  if (previousTabIndex === null) root.removeAttribute('tabindex');
  else root.setAttribute('tabindex', previousTabIndex);
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
  const previousTabIndex = root.getAttribute('tabindex');
  let keyboardBinding = null;

  try {
    root.setAttribute('tabindex', '0');
    const transport = createTransportController(commandPort);
    keyboardBinding = createTransportKeyboardBinding({
      root,
      timelineKey: (key) => transport.timelineKey(key)
    });
  } catch (error) {
    try {
      restoreTabIndex(root, previousTabIndex);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'WordPress Transport binding failed and tabindex rollback also failed.',
        { cause: error }
      );
    }
    throw error;
  }

  let disposed = false;
  function dispose() {
    if (disposed) return null;
    disposed = true;
    const errors = [];

    try {
      keyboardBinding.dispose();
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
