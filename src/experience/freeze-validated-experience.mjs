function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function isPlainObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rebuildArray(value, path, clones, active) {
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0) {
    fail(path, 'validated JSON arrays must declare a safe integer length.');
  }

  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)) {
      fail(path, 'validated JSON arrays cannot carry named, symbol, or hidden properties.');
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index >= length) {
      fail(path, 'validated JSON arrays contain an invalid index property.');
    }
  }

  const clone = [];
  for (let index = 0; index < length; index += 1) {
    const entryPath = `${path}[${index}]`;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) {
      fail(entryPath, 'validated JSON arrays cannot contain sparse entries.');
    }
    if (!descriptor.enumerable || !('value' in descriptor)) {
      fail(entryPath, 'validated JSON array entries must be enumerable data properties.');
    }
    clone.push(rebuildJsonValue(descriptor.value, entryPath, clones, active));
  }

  return clone;
}

function rebuildObject(value, path, clones, active) {
  if (!isPlainObject(value)) {
    fail(path, 'validated experience objects must have Object or null prototypes.');
  }

  const ownKeys = Reflect.ownKeys(value);
  const enumerableKeys = Object.keys(value);
  if (ownKeys.length !== enumerableKeys.length || ownKeys.some((key) => typeof key !== 'string')) {
    fail(path, 'validated JSON objects cannot carry symbol or hidden properties.');
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of enumerableKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(`${path}.${key}`, 'validated JSON properties must be enumerable data properties.');
    }
  }

  const clone = {};
  for (const key of enumerableKeys) {
    clone[key] = rebuildJsonValue(descriptors[key].value, `${path}.${key}`, clones, active);
  }

  return clone;
}

function rebuildJsonValue(value, path, clones, active) {
  if (value === null) return null;

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
  if (clones.has(value)) return clones.get(value);

  active.add(value);
  const clone = Array.isArray(value)
    ? rebuildArray(value, path, clones, active)
    : rebuildObject(value, path, clones, active);
  active.delete(value);

  Object.freeze(clone);
  clones.set(value, clone);
  return clone;
}

/**
 * Rebuilds validated experience data into a fresh graph of plain objects and
 * arrays, then deep-freezes the result.
 *
 * The source graph is read through own property descriptors and is never
 * retained. Proxies, accessors, symbol-keyed members, non-Object prototypes,
 * and non-JSON values either fail validation or are rebuilt into inert JSON
 * data, so no caller-supplied object identity survives into runtime data. The
 * argument is not mutated; the returned graph is a different reference.
 */
export function freezeValidatedExperience(experience) {
  if (!experience || typeof experience !== 'object' || Array.isArray(experience) || !isPlainObject(experience)) {
    throw new TypeError('validated experience must be a plain object.');
  }

  return rebuildJsonValue(experience, 'experience', new Map(), new WeakSet());
}
