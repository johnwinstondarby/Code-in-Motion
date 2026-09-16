export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';
export const REDUCED_MOTION_PREFERENCE_KEYS = Object.freeze(['read']);
export const REDUCED_MOTION_PREFERENCE_OPTIONS_KEYS = Object.freeze(['matchMedia']);

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
  let matches;
  try {
    matches = mediaQueryList.matches;
  } catch (error) {
    throw error;
  }
  if (typeof matches !== 'boolean') {
    fail('Reduced-motion media query matches must be boolean.');
  }
  return matches;
}

export function createReducedMotionPreference(optionsInput) {
  assertPlainObject(optionsInput, 'Reduced-motion preference options');
  assertExactKeys(optionsInput, REDUCED_MOTION_PREFERENCE_OPTIONS_KEYS, 'Reduced-motion preference options');

  const matchMedia = dataValue(optionsInput, 'matchMedia', 'Reduced-motion preference options');
  if (typeof matchMedia !== 'function') {
    fail('Reduced-motion preference matchMedia must be a function.');
  }

  const mediaQueryList = matchMedia(REDUCED_MOTION_MEDIA_QUERY);
  if (mediaQueryList === null || (typeof mediaQueryList !== 'object' && typeof mediaQueryList !== 'function')) {
    fail('Reduced-motion preference matchMedia must return a media-query object.');
  }

  readMatches(mediaQueryList);

  const capability = {
    read() {
      return readMatches(mediaQueryList);
    }
  };

  assertExactKeys(capability, REDUCED_MOTION_PREFERENCE_KEYS, 'Reduced-motion preference capability');
  return Object.freeze(capability);
}
