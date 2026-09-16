import {
  REDUCED_MOTION_MEDIA_QUERY,
  REDUCED_MOTION_PREFERENCE_KEYS
} from './reduced-motion-preference.mjs';

export const REDUCED_MOTION_PREFERENCE_SOURCE_KEYS = Object.freeze(['preference', 'changes']);
export const REDUCED_MOTION_PREFERENCE_SOURCE_OPTIONS_KEYS = Object.freeze(['matchMedia']);
export const REDUCED_MOTION_CHANGE_KEYS = Object.freeze(['subscribe', 'dispose']);
export const REDUCED_MOTION_CHANGE_RECORD_KEYS = Object.freeze(['reducedMotion']);

const NOOP_UNSUBSCRIBE = Object.freeze(() => false);

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

function readMatches(mediaQueryList) {
  const matches = mediaQueryList.matches;
  if (typeof matches !== 'boolean') {
    fail('Reduced-motion media query matches must be boolean.');
  }
  return matches;
}

function readListenerMethod(mediaQueryList, key) {
  const method = mediaQueryList[key];
  if (typeof method !== 'function') {
    fail(`Reduced-motion media query ${key} must be a function.`);
  }
  return method;
}

export function createReducedMotionPreferenceSource(optionsInput) {
  assertPlainObject(optionsInput, 'Reduced-motion preference source options');
  assertExactKeys(
    optionsInput,
    REDUCED_MOTION_PREFERENCE_SOURCE_OPTIONS_KEYS,
    'Reduced-motion preference source options'
  );

  const matchMedia = dataValue(
    optionsInput,
    'matchMedia',
    'Reduced-motion preference source options'
  );
  if (typeof matchMedia !== 'function') {
    fail('Reduced-motion preference source matchMedia must be a function.');
  }

  const mediaQueryList = matchMedia(REDUCED_MOTION_MEDIA_QUERY);
  if (mediaQueryList === null || (typeof mediaQueryList !== 'object' && typeof mediaQueryList !== 'function')) {
    fail('Reduced-motion preference source matchMedia must return a media-query object.');
  }

  readMatches(mediaQueryList);
  const addEventListener = readListenerMethod(mediaQueryList, 'addEventListener');
  const removeEventListener = readListenerMethod(mediaQueryList, 'removeEventListener');

  let open = true;
  const listeners = new Set();

  const preference = {
    read() {
      return readMatches(mediaQueryList);
    }
  };
  assertExactKeys(preference, REDUCED_MOTION_PREFERENCE_KEYS, 'Reduced-motion preference capability');
  Object.freeze(preference);

  const handleChange = () => {
    if (!open) return;
    const reducedMotion = readMatches(mediaQueryList);
    const record = Object.freeze({ reducedMotion });
    assertExactKeys(record, REDUCED_MOTION_CHANGE_RECORD_KEYS, 'Reduced-motion change record');

    for (const listener of [...listeners]) {
      try {
        listener(record);
      } catch {
        // Observation failures cannot alter the browser preference stream.
      }
    }
  };

  try {
    addEventListener.call(mediaQueryList, 'change', handleChange);
  } catch (error) {
    try {
      removeEventListener.call(mediaQueryList, 'change', handleChange);
    } catch {
      // Preserve the original listener-installation failure.
    }
    throw error;
  }

  const changes = {
    subscribe(listener) {
      if (typeof listener !== 'function') fail('Reduced-motion change subscriber must be a function.');
      if (!open) return NOOP_UNSUBSCRIBE;

      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) return false;
        subscribed = false;
        return listeners.delete(listener);
      });
    },

    dispose() {
      if (!open) return false;
      removeEventListener.call(mediaQueryList, 'change', handleChange);
      open = false;
      listeners.clear();
      return true;
    }
  };
  assertExactKeys(changes, REDUCED_MOTION_CHANGE_KEYS, 'Reduced-motion change capability');
  Object.freeze(changes);

  const source = { preference, changes };
  assertExactKeys(source, REDUCED_MOTION_PREFERENCE_SOURCE_KEYS, 'Reduced-motion preference source');
  return Object.freeze(source);
}
