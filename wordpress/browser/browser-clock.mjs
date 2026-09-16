function fail(message) {
  throw new TypeError(message);
}

function assertFunction(value, label) {
  if (typeof value !== 'function') fail(`${label} must be a function.`);
}

function readNow(performance) {
  const value = performance.now();
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('browser clock performance.now() must return a finite non-negative number.');
  }
  return value;
}

export function createBrowserClock({
  performance,
  setTimeout,
  clearTimeout,
  requestAnimationFrame,
  cancelAnimationFrame
}) {
  if (!performance || typeof performance !== 'object') {
    fail('browser clock performance must be an object.');
  }
  assertFunction(performance.now, 'browser clock performance.now');
  assertFunction(setTimeout, 'browser clock setTimeout');
  assertFunction(clearTimeout, 'browser clock clearTimeout');
  assertFunction(requestAnimationFrame, 'browser clock requestAnimationFrame');
  assertFunction(cancelAnimationFrame, 'browser clock cancelAnimationFrame');

  const handles = new Map();

  function now() {
    return readNow(performance);
  }

  function schedule(callback, delayMs) {
    assertFunction(callback, 'browser clock schedule callback');
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError('browser clock schedule delay must be a finite non-negative number.');
    }

    const handle = Symbol('cim-browser-delay');
    const nativeHandle = setTimeout(() => {
      if (!handles.has(handle)) return;
      handles.delete(handle);
      callback(now());
    }, delayMs);
    handles.set(handle, { kind: 'delay', nativeHandle });
    return handle;
  }

  function onFrame(callback) {
    assertFunction(callback, 'browser clock onFrame callback');

    const handle = Symbol('cim-browser-frame');
    const entry = { kind: 'frame', nativeHandle: null };

    const tick = () => {
      if (!handles.has(handle)) return;
      callback(now());
      if (!handles.has(handle)) return;
      entry.nativeHandle = requestAnimationFrame(tick);
    };

    handles.set(handle, entry);
    entry.nativeHandle = requestAnimationFrame(tick);
    return handle;
  }

  function cancel(handle) {
    const entry = handles.get(handle);
    if (!entry) return false;
    handles.delete(handle);

    if (entry.kind === 'delay') clearTimeout(entry.nativeHandle);
    else cancelAnimationFrame(entry.nativeHandle);
    return true;
  }

  return Object.freeze({ now, schedule, cancel, onFrame });
}

export function createBrowserClockFactory(windowObject) {
  if (!windowObject || typeof windowObject !== 'object') {
    fail('browser clock factory window must be an object.');
  }

  const performance = windowObject.performance;
  const setTimeout = windowObject.setTimeout?.bind(windowObject);
  const clearTimeout = windowObject.clearTimeout?.bind(windowObject);
  const requestAnimationFrame = windowObject.requestAnimationFrame?.bind(windowObject);
  const cancelAnimationFrame = windowObject.cancelAnimationFrame?.bind(windowObject);

  return Object.freeze({
    create() {
      return createBrowserClock({
        performance,
        setTimeout,
        clearTimeout,
        requestAnimationFrame,
        cancelAnimationFrame
      });
    }
  });
}
