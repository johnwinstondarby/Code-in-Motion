function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function isPlainObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function freezeJsonValue(value, path, seen, active) {
  if (value === null) return value;

  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    if (!Number.isFinite(value)) fail(path, 'validated JSON numbers must be finite.');
    return value;
  }

  if (type !== 'object') {
    fail(path, `validated experience data must remain JSON data; found ${type}.`);
  }

  if (active.has(value)) fail(path, 'validated JSON data cannot contain cycles.');
  if (seen.has(value)) return value;
  seen.add(value);
  active.add(value);

  if (Array.isArray(value)) {
    const ownKeys = Reflect.ownKeys(value);
    for (const key of ownKeys) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)) {
        fail(path, 'validated JSON arrays cannot carry named, symbol, or hidden properties.');
      }
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= value.length) {
        fail(path, 'validated JSON arrays contain an invalid index property.');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        fail(`${path}[${key}]`, 'validated JSON array entries must be enumerable data properties.');
      }
    }

    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, String(index))) {
        fail(`${path}[${index}]`, 'validated JSON arrays cannot contain sparse entries.');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      freezeJsonValue(descriptor.value, `${path}[${index}]`, seen, active);
    }

    active.delete(value);
    return Object.freeze(value);
  }

  if (!isPlainObject(value)) {
    fail(path, 'validated experience objects must have Object or null prototypes.');
  }

  const enumerableKeys = Object.keys(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== enumerableKeys.length || ownKeys.some((key) => typeof key !== 'string')) {
    fail(path, 'validated JSON objects cannot carry symbol or hidden properties.');
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of enumerableKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(`${path}.${key}`, 'validated JSON properties must be enumerable data properties.');
    }
    freezeJsonValue(descriptor.value, `${path}.${key}`, seen, active);
  }

  active.delete(value);
  return Object.freeze(value);
}

export function freezeValidatedExperience(experience) {
  if (!experience || typeof experience !== 'object' || Array.isArray(experience) || !isPlainObject(experience)) {
    throw new TypeError('validated experience must be a plain object.');
  }

  return freezeJsonValue(experience, 'experience', new WeakSet(), new WeakSet());
}
