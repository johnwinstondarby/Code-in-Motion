export const WORDPRESS_ROOT_LIFECYCLE_OPTIONS_KEYS = Object.freeze([
  'MutationObserver',
  'observeTarget',
  'roots',
  'onDetached'
]);
export const WORDPRESS_ROOT_LIFECYCLE_KEYS = Object.freeze(['dispose']);

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

function assertObject(value, label) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    fail(`${label} must be an object.`);
  }
  return value;
}

function readConnected(root) {
  const connected = root.isConnected;
  if (typeof connected !== 'boolean') {
    fail('WordPress lifecycle root.isConnected must be boolean.');
  }
  return connected;
}

export function createWordPressRootLifecycleBinding(optionsInput) {
  assertPlainObject(optionsInput, 'WordPress root lifecycle options');
  assertExactKeys(
    optionsInput,
    WORDPRESS_ROOT_LIFECYCLE_OPTIONS_KEYS,
    'WordPress root lifecycle options'
  );

  const MutationObserver = dataValue(optionsInput, 'MutationObserver', 'WordPress root lifecycle options');
  const observeTarget = assertObject(
    dataValue(optionsInput, 'observeTarget', 'WordPress root lifecycle options'),
    'WordPress root lifecycle observe target'
  );
  const roots = dataValue(optionsInput, 'roots', 'WordPress root lifecycle options');
  const onDetached = dataValue(optionsInput, 'onDetached', 'WordPress root lifecycle options');

  if (typeof MutationObserver !== 'function') {
    fail('WordPress root lifecycle MutationObserver must be a constructor function.');
  }
  if (!Array.isArray(roots) || !Object.isFrozen(roots)) {
    fail('WordPress root lifecycle roots must be a frozen array.');
  }
  if (typeof onDetached !== 'function') {
    fail('WordPress root lifecycle onDetached must be a function.');
  }

  const tracked = new Set();
  for (const root of roots) {
    assertObject(root, 'WordPress lifecycle root');
    readConnected(root);
    tracked.add(root);
  }

  let disposed = false;
  const observer = new MutationObserver(() => {
    if (disposed) return;
    for (const root of [...tracked]) {
      if (readConnected(root)) continue;
      tracked.delete(root);
      onDetached(root);
    }
  });

  if (observer === null || typeof observer !== 'object') {
    fail('WordPress root lifecycle MutationObserver must construct an object.');
  }
  if (typeof observer.observe !== 'function' || typeof observer.disconnect !== 'function') {
    fail('WordPress root lifecycle observer must expose observe() and disconnect().');
  }

  try {
    observer.observe(observeTarget, Object.freeze({ childList: true, subtree: true }));
  } catch (error) {
    try {
      observer.disconnect();
    } catch {
      // Preserve the observer installation failure as the construction outcome.
    }
    throw error;
  }

  function dispose() {
    if (disposed) return null;
    disposed = true;
    tracked.clear();
    observer.disconnect();
    return null;
  }

  const binding = { dispose };
  assertExactKeys(binding, WORDPRESS_ROOT_LIFECYCLE_KEYS, 'WordPress root lifecycle binding');
  return Object.freeze(binding);
}
