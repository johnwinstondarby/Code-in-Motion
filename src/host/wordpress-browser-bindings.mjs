import { ingestExperience } from '../experience/ingest-experience.mjs';

const LOADER_OPTIONS_KEYS = Object.freeze(['fetch', 'experienceUrlFor']);
const RESOLVER_OPTIONS_KEYS = Object.freeze(['registry']);
const CLOCK_FACTORY_OPTIONS_KEYS = Object.freeze([
  'now',
  'setTimeout',
  'clearTimeout',
  'requestAnimationFrame',
  'cancelAnimationFrame'
]);
const CLOCK_KEYS = Object.freeze(['now', 'schedule', 'cancel', 'onFrame']);
const RENDERER_KEYS = Object.freeze(['mount', 'render', 'dispose']);

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

function readFunction(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'function') {
    fail(`${label}.${key} must be an enumerable function data property.`);
  }
  return descriptor.value;
}

function assertExperienceId(experienceId) {
  if (typeof experienceId !== 'string' || experienceId.trim().length === 0) {
    fail('WordPress experience ID must be a non-empty string.');
  }
  return experienceId.trim();
}

function readFetchedJson(response) {
  if (response === null || typeof response !== 'object') {
    throw new TypeError('WordPress experience fetch must return a response object.');
  }
  if (response.ok !== true) {
    const status = Number.isInteger(response.status) ? ` (${response.status})` : '';
    throw new Error(`WordPress experience fetch failed${status}.`);
  }
  if (typeof response.json !== 'function') {
    throw new TypeError('WordPress experience fetch response must expose json().');
  }
  return response.json();
}

export function createWordPressExperienceLoader(optionsInput) {
  assertPlainObject(optionsInput, 'WordPress experience loader options');
  assertExactKeys(optionsInput, LOADER_OPTIONS_KEYS, 'WordPress experience loader options');
  const fetch = readFunction(optionsInput, 'fetch', 'WordPress experience loader options');
  const experienceUrlFor = readFunction(optionsInput, 'experienceUrlFor', 'WordPress experience loader options');
  const cache = new Map();

  function load(experienceIdInput) {
    const experienceId = assertExperienceId(experienceIdInput);
    const cached = cache.get(experienceId);
    if (cached) return cached;

    const pending = Promise.resolve().then(async () => {
      const url = experienceUrlFor(experienceId);
      if (typeof url !== 'string' || url.length === 0) {
        throw new TypeError(`WordPress experience URL is unavailable for ${experienceId}.`);
      }

      const response = await fetch(url);
      const raw = await readFetchedJson(response);
      const experience = ingestExperience(raw);
      if (experience.id !== experienceId) {
        throw new TypeError(
          `WordPress experience identity mismatch: requested ${experienceId}, received ${String(experience.id)}.`
        );
      }
      return experience;
    });

    cache.set(experienceId, pending);
    pending.catch(() => {
      if (cache.get(experienceId) === pending) cache.delete(experienceId);
    });
    return pending;
  }

  return Object.freeze({ load });
}

function rendererResolutionError(rendererId) {
  const error = new Error(`Unknown WordPress CiM renderer: ${rendererId}.`);
  Object.defineProperty(error, 'code', {
    value: 'CIM-RND-001',
    enumerable: true,
    configurable: false,
    writable: false
  });
  return error;
}

function assertRenderer(renderer, rendererId) {
  if (renderer === null || typeof renderer !== 'object') {
    throw new TypeError(`WordPress renderer factory ${rendererId} must return an object.`);
  }
  for (const key of RENDERER_KEYS) {
    if (typeof renderer[key] !== 'function') {
      throw new TypeError(`WordPress renderer ${rendererId}.${key} must be a function.`);
    }
  }
}

export function createWordPressRendererResolver(optionsInput) {
  assertPlainObject(optionsInput, 'WordPress renderer resolver options');
  assertExactKeys(optionsInput, RESOLVER_OPTIONS_KEYS, 'WordPress renderer resolver options');

  const descriptor = Object.getOwnPropertyDescriptor(optionsInput, 'registry');
  if (!descriptor?.enumerable || !('value' in descriptor) || !(descriptor.value instanceof Map)) {
    fail('WordPress renderer resolver options.registry must be an enumerable Map data property.');
  }

  const factories = new Map();
  for (const [rendererId, factory] of descriptor.value.entries()) {
    if (typeof rendererId !== 'string' || rendererId.length === 0) {
      fail('WordPress renderer registry IDs must be non-empty strings.');
    }
    if (typeof factory !== 'function') {
      fail(`WordPress renderer registry factory ${rendererId} must be a function.`);
    }
    factories.set(rendererId, factory);
  }

  function resolve(rendererId) {
    if (typeof rendererId !== 'string' || rendererId.length === 0) throw rendererResolutionError(String(rendererId));
    const factory = factories.get(rendererId);
    if (!factory) throw rendererResolutionError(rendererId);
    const renderer = factory();
    assertRenderer(renderer, rendererId);
    return renderer;
  }

  return Object.freeze({ resolve });
}

function readNow(now) {
  const value = now();
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('WordPress browser clock now() must return a finite non-negative number.');
  }
  return value;
}

export function createWordPressClockFactory(optionsInput) {
  assertPlainObject(optionsInput, 'WordPress clock factory options');
  assertExactKeys(optionsInput, CLOCK_FACTORY_OPTIONS_KEYS, 'WordPress clock factory options');

  const nowSource = readFunction(optionsInput, 'now', 'WordPress clock factory options');
  const setTimeoutSource = readFunction(optionsInput, 'setTimeout', 'WordPress clock factory options');
  const clearTimeoutSource = readFunction(optionsInput, 'clearTimeout', 'WordPress clock factory options');
  const requestAnimationFrameSource = readFunction(
    optionsInput,
    'requestAnimationFrame',
    'WordPress clock factory options'
  );
  const cancelAnimationFrameSource = readFunction(
    optionsInput,
    'cancelAnimationFrame',
    'WordPress clock factory options'
  );

  function create() {
    const handles = new Map();
    let lastNow = null;

    function now() {
      const value = readNow(nowSource);
      if (lastNow !== null && value < lastNow) {
        throw new RangeError('WordPress browser clock now() source must be monotonic.');
      }
      lastNow = value;
      return value;
    }

    function schedule(fn, ms) {
      if (typeof fn !== 'function') fail('WordPress browser clock schedule callback must be a function.');
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError('WordPress browser clock schedule delay must be a finite non-negative number.');
      }

      const handle = Symbol('cim-browser-delay');
      const sourceHandle = setTimeoutSource(() => {
        if (!handles.has(handle)) return;
        handles.delete(handle);
        fn(now());
      }, ms);
      handles.set(handle, { kind: 'delay', sourceHandle });
      return handle;
    }

    function armFrame(handle, entry) {
      entry.sourceHandle = requestAnimationFrameSource(() => {
        if (!handles.has(handle)) return;
        try {
          entry.callback(now());
        } catch (error) {
          handles.delete(handle);
          throw error;
        }
        if (handles.has(handle)) armFrame(handle, entry);
      });
    }

    function onFrame(fn) {
      if (typeof fn !== 'function') fail('WordPress browser clock frame callback must be a function.');
      const handle = Symbol('cim-browser-frame');
      const entry = { kind: 'frame', sourceHandle: null, callback: fn };
      handles.set(handle, entry);
      try {
        armFrame(handle, entry);
      } catch (error) {
        handles.delete(handle);
        throw error;
      }
      return handle;
    }

    function cancel(handle) {
      const entry = handles.get(handle);
      if (!entry) return false;
      handles.delete(handle);
      if (entry.kind === 'delay') clearTimeoutSource(entry.sourceHandle);
      else cancelAnimationFrameSource(entry.sourceHandle);
      return true;
    }

    const clock = Object.freeze({ now, schedule, cancel, onFrame });
    assertExactKeys(clock, CLOCK_KEYS, 'WordPress browser clock');
    return clock;
  }

  return Object.freeze({ create });
}
