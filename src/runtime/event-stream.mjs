import {
  EVENT_COMPONENT_VALUES,
  EVENT_NAME_VALUES,
  EVENT_RESULT_VALUES,
  EVENT_SCHEMA
} from '../contracts/events.mjs';

const EVENT_INPUT_KEYS = Object.freeze([
  'component',
  'event',
  'result',
  'command_id',
  'transition_id',
  'from_step',
  'to_step',
  'step_id',
  'error_code',
  'recovered',
  'details'
]);

const OPTIONAL_STRING_KEYS = Object.freeze([
  'command_id',
  'transition_id',
  'from_step',
  'to_step',
  'step_id',
  'error_code'
]);

const NOOP_UNSUBSCRIBE = Object.freeze(() => false);

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value, path, active = new WeakSet()) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    if (!Number.isFinite(value)) fail(`${path} numbers must be finite.`);
    return value;
  }
  if (type !== 'object') fail(`${path} must contain JSON data only.`);
  if (active.has(value)) fail(`${path} cannot contain cycles.`);

  active.add(value);
  let clone;

  if (Array.isArray(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)))) {
      fail(`${path} arrays cannot contain named, symbol, or hidden properties.`);
    }
    clone = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        fail(`${path}[${index}] must be an enumerable data property.`);
      }
      clone.push(cloneJson(descriptor.value, `${path}[${index}]`, active));
    }
  } else {
    if (!isPlainObject(value)) fail(`${path} objects must have Object or null prototypes.`);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) fail(`${path} cannot contain symbol keys.`);
    clone = {};
    for (const key of ownKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        fail(`${path}.${key} must be an enumerable data property.`);
      }
      clone[key] = cloneJson(descriptor.value, `${path}.${key}`, active);
    }
  }

  active.delete(value);
  return Object.freeze(clone);
}

function readEventInput(input) {
  if (!isPlainObject(input)) fail('event input must be a plain object.');

  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.some((key) => typeof key !== 'string')) fail('event input cannot contain symbol keys.');
  const extra = ownKeys.filter((key) => !EVENT_INPUT_KEYS.includes(key));
  if (extra.length > 0) fail(`event input contains unsupported field(s): ${extra.join(', ')}.`);

  const descriptors = Object.getOwnPropertyDescriptors(input);
  const read = (key, required = false) => {
    const descriptor = descriptors[key];
    if (!descriptor) {
      if (required) fail(`event input ${key} is required.`);
      return undefined;
    }
    if (!descriptor.enumerable || !('value' in descriptor)) {
      fail(`event input ${key} must be an enumerable data property.`);
    }
    return descriptor.value;
  };

  const component = read('component', true);
  const event = read('event', true);
  const result = read('result', true);

  if (!EVENT_COMPONENT_VALUES.includes(component)) fail(`unsupported event component: ${String(component)}.`);
  if (!EVENT_NAME_VALUES.includes(event)) fail(`unsupported event name: ${String(event)}.`);
  if (!EVENT_RESULT_VALUES.includes(result)) fail(`unsupported event result: ${String(result)}.`);

  const parsed = { component, event, result };

  for (const key of OPTIONAL_STRING_KEYS) {
    const value = read(key);
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length === 0) fail(`event input ${key} must be a non-empty string when present.`);
    parsed[key] = value;
  }

  const recovered = read('recovered');
  if (recovered !== undefined) {
    if (typeof recovered !== 'boolean') fail('event input recovered must be boolean when present.');
    parsed.recovered = recovered;
  }

  const details = read('details');
  if (details !== undefined) {
    if (!isPlainObject(details)) fail('event input details must be a plain object when present.');
    parsed.details = cloneJson(details, 'event input details');
  }

  return parsed;
}

function assertClock(clock) {
  if (!clock || typeof clock !== 'object' || typeof clock.now !== 'function') {
    fail('event stream clock must expose now().');
  }
}

export function createRuntimeEventStream({ instanceId, clock }) {
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    fail('event stream instanceId must be a non-empty string.');
  }
  assertClock(clock);

  let sequence = 0;
  let open = true;
  const listeners = new Set();

  const observe = Object.freeze({
    subscribe(listener) {
      if (typeof listener !== 'function') fail('event subscriber must be a function.');
      if (!open) return NOOP_UNSUBSCRIBE;

      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) return false;
        subscribed = false;
        return listeners.delete(listener);
      });
    }
  });

  const control = Object.freeze({
    emit(input) {
      if (!open) throw new Error('event stream is closed.');
      const parsed = readEventInput(input);
      const timestamp = clock.now.call(clock);
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new RangeError('event stream clock.now() must return a finite non-negative number.');
      }

      sequence += 1;
      const eventRecord = Object.freeze({
        schema: EVENT_SCHEMA,
        instance_id: instanceId,
        sequence,
        timestamp_ms: timestamp,
        ...parsed
      });

      for (const listener of [...listeners]) {
        try {
          listener(eventRecord);
        } catch {
          // Observation failures cannot alter production control flow.
        }
      }

      return eventRecord;
    },

    close() {
      if (!open) return false;
      open = false;
      listeners.clear();
      return true;
    }
  });

  return Object.freeze({ observe, control });
}
