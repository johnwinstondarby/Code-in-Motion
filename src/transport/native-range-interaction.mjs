import {
  TRANSPORT_NATIVE_RANGE_BINDING_KEYS
} from './native-range-binding.mjs';
import {
  TRANSPORT_SCRUB_GESTURE_KEYS,
  TRANSPORT_SCRUB_STATE_KEYS
} from './scrub-gesture.mjs';

export const TRANSPORT_NATIVE_RANGE_INTERACTION_KEYS = Object.freeze(['dispose']);
export const TRANSPORT_NATIVE_RANGE_INTERACTION_OPTIONS_KEYS = Object.freeze([
  'control',
  'gesture',
  'binding'
]);

const RANGE_INTERACTION_EVENTS = Object.freeze([
  'input',
  'change',
  'pointercancel',
  'touchcancel'
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

function readEnumerableDataProperty(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property.`);
  }
  return descriptor.value;
}

function readControlValue(control, key) {
  try {
    return control[key];
  } catch {
    fail(`Transport native range interaction control.${key} must be readable.`);
  }
}

function assertNativeRangeControl(control) {
  if (control === null || (typeof control !== 'object' && typeof control !== 'function')) {
    fail('Transport native range interaction control must be an input element-like object.');
  }

  const tagName = readControlValue(control, 'tagName');
  const type = readControlValue(control, 'type');
  if (typeof tagName !== 'string' || tagName.toUpperCase() !== 'INPUT' || type !== 'range') {
    fail('Transport native range interaction control must identify an input with type range.');
  }

  for (const method of ['addEventListener', 'removeEventListener']) {
    if (typeof readControlValue(control, method) !== 'function') {
      fail(`Transport native range interaction control.${method} must be a function.`);
    }
  }

  for (const property of ['min', 'max', 'step', 'value']) {
    readControlValue(control, property);
  }

  return control;
}

function assertGesture(gesture) {
  assertPlainFrozenObject(gesture, 'Transport scrub gesture');
  assertExactOwnKeys(gesture, TRANSPORT_SCRUB_GESTURE_KEYS, 'Transport scrub gesture');
  for (const key of TRANSPORT_SCRUB_GESTURE_KEYS) {
    const value = readEnumerableDataProperty(gesture, key, 'Transport scrub gesture');
    if (typeof value !== 'function') {
      fail(`Transport scrub gesture.${key} must be a function.`);
    }
  }
  return gesture;
}

function assertBinding(binding) {
  assertPlainFrozenObject(binding, 'Transport native range binding');
  assertExactOwnKeys(binding, TRANSPORT_NATIVE_RANGE_BINDING_KEYS, 'Transport native range binding');
  const refresh = readEnumerableDataProperty(binding, 'refresh', 'Transport native range binding');
  if (typeof refresh !== 'function') {
    fail('Transport native range binding.refresh must be a function.');
  }
  return binding;
}

function assertScrubState(state) {
  assertPlainFrozenObject(state, 'Transport scrub interaction state');
  assertExactOwnKeys(state, TRANSPORT_SCRUB_STATE_KEYS, 'Transport scrub interaction state');

  const active = readEnumerableDataProperty(state, 'active', 'Transport scrub interaction state');
  const displayStepId = readEnumerableDataProperty(
    state,
    'displayStepId',
    'Transport scrub interaction state'
  );
  const displayIndex = readEnumerableDataProperty(
    state,
    'displayIndex',
    'Transport scrub interaction state'
  );
  const displayRatio = readEnumerableDataProperty(
    state,
    'displayRatio',
    'Transport scrub interaction state'
  );

  if (typeof active !== 'boolean') {
    fail('Transport scrub interaction state.active must be boolean.');
  }
  if (typeof displayStepId !== 'string' || displayStepId.length === 0) {
    fail('Transport scrub interaction state.displayStepId must be a non-empty string.');
  }
  if (!Number.isSafeInteger(displayIndex) || displayIndex < 0) {
    fail('Transport scrub interaction state.displayIndex must be a non-negative safe integer.');
  }
  if (typeof displayRatio !== 'number' || !Number.isFinite(displayRatio) || displayRatio < 0 || displayRatio > 1) {
    fail('Transport scrub interaction state.displayRatio must be within the semantic rail.');
  }

  return state;
}

function readGestureState(gesture) {
  return assertScrubState(gesture.read());
}

function readOrdinalRatio(control) {
  const min = Number(readControlValue(control, 'min'));
  const max = Number(readControlValue(control, 'max'));
  const step = Number(readControlValue(control, 'step'));
  const value = Number(readControlValue(control, 'value'));

  if (min !== 0) {
    fail('Transport native range interaction control.min must remain 0.');
  }
  if (!Number.isSafeInteger(max) || max < 1) {
    fail('Transport native range interaction control.max must be a positive safe integer.');
  }
  if (step !== 1) {
    fail('Transport native range interaction control.step must remain 1.');
  }
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail('Transport native range interaction control.value must be a valid semantic boundary ordinal.');
  }

  return value / max;
}

function restoreGestureState(gesture, previous) {
  const current = readGestureState(gesture);

  if (previous.active) {
    const restored = current.active
      ? gesture.update(previous.displayRatio)
      : gesture.begin(previous.displayRatio);
    assertScrubState(restored);
    return;
  }

  if (current.active) {
    const restored = gesture.cancel();
    assertScrubState(restored);
  }
}

function rollbackInteraction(gesture, binding, previous, originalError, message) {
  const rollbackErrors = [];

  try {
    restoreGestureState(gesture, previous);
  } catch (error) {
    rollbackErrors.push(error);
  }

  try {
    binding.refresh();
  } catch (error) {
    rollbackErrors.push(error);
  }

  if (rollbackErrors.length > 0) {
    throw new AggregateError([originalError, ...rollbackErrors], message);
  }
  throw originalError;
}

function applyPreview(gesture, binding, ratio) {
  const previous = readGestureState(gesture);

  try {
    const next = previous.active ? gesture.update(ratio) : gesture.begin(ratio);
    assertScrubState(next);
    binding.refresh();
  } catch (error) {
    rollbackInteraction(
      gesture,
      binding,
      previous,
      error,
      'Transport native range preview failed and rollback was incomplete.'
    );
  }
}

function cancelPreview(gesture, binding) {
  const previous = readGestureState(gesture);
  if (!previous.active) return false;

  try {
    const cancelled = gesture.cancel();
    assertScrubState(cancelled);
    binding.refresh();
    return true;
  } catch (error) {
    rollbackInteraction(
      gesture,
      binding,
      previous,
      error,
      'Transport native range cancellation failed and rollback was incomplete.'
    );
  }
}

function installListeners(control, handlers) {
  const installed = [];

  try {
    for (const type of RANGE_INTERACTION_EVENTS) {
      control.addEventListener(type, handlers[type]);
      installed.push(type);
    }
  } catch (error) {
    const cleanupErrors = [];
    for (const type of installed.reverse()) {
      try {
        control.removeEventListener(type, handlers[type]);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'Transport native range interaction listener installation failed and cleanup was incomplete.'
      );
    }
    throw error;
  }
}

export function createTransportNativeRangeInteraction(optionsInput) {
  if (optionsInput === null || typeof optionsInput !== 'object' || Object.getPrototypeOf(optionsInput) !== Object.prototype) {
    fail('Transport native range interaction options must be a plain object.');
  }
  assertExactOwnKeys(
    optionsInput,
    TRANSPORT_NATIVE_RANGE_INTERACTION_OPTIONS_KEYS,
    'Transport native range interaction options'
  );

  const control = assertNativeRangeControl(
    readEnumerableDataProperty(optionsInput, 'control', 'Transport native range interaction options')
  );
  const gesture = assertGesture(
    readEnumerableDataProperty(optionsInput, 'gesture', 'Transport native range interaction options')
  );
  const binding = assertBinding(
    readEnumerableDataProperty(optionsInput, 'binding', 'Transport native range interaction options')
  );

  let disposed = false;
  let suppressChangeUntilInput = false;

  function onInput() {
    suppressChangeUntilInput = false;
    applyPreview(gesture, binding, readOrdinalRatio(control));
  }

  function onChange() {
    if (suppressChangeUntilInput) {
      suppressChangeUntilInput = false;
      binding.refresh();
      return;
    }

    applyPreview(gesture, binding, readOrdinalRatio(control));

    try {
      gesture.commit();
    } catch (error) {
      try {
        binding.refresh();
      } catch (refreshError) {
        throw new AggregateError(
          [error, refreshError],
          'Transport native range commit failed and canonical refresh also failed.'
        );
      }
      throw error;
    }
  }

  function onCancel() {
    if (cancelPreview(gesture, binding)) {
      suppressChangeUntilInput = true;
    }
  }

  const handlers = {
    input: onInput,
    change: onChange,
    pointercancel: onCancel,
    touchcancel: onCancel
  };

  installListeners(control, handlers);

  const interaction = {
    dispose() {
      if (disposed) return null;

      const removalErrors = [];
      for (const type of RANGE_INTERACTION_EVENTS) {
        try {
          control.removeEventListener(type, handlers[type]);
        } catch (error) {
          removalErrors.push(error);
        }
      }

      if (removalErrors.length === 1) throw removalErrors[0];
      if (removalErrors.length > 1) {
        throw new AggregateError(
          removalErrors,
          'Transport native range interaction listener removal was incomplete.'
        );
      }

      cancelPreview(gesture, binding);
      suppressChangeUntilInput = false;
      disposed = true;
      return null;
    }
  };

  assertExactOwnKeys(
    interaction,
    TRANSPORT_NATIVE_RANGE_INTERACTION_KEYS,
    'Transport native range interaction'
  );
  return Object.freeze(interaction);
}
