import {
  CONTINUITY_COMMAND,
  SESSION_STATUS,
  SESSION_STATUS_VALUES
} from '../contracts/session.mjs';

export const TRANSPORT_PLAYBACK_OBSERVATION_PORT_KEYS = Object.freeze([
  'snapshot'
]);

export const TRANSPORT_PLAYBACK_PRESENTATION_KEYS = Object.freeze([
  'read'
]);

export const TRANSPORT_PLAYBACK_STATE_KEYS = Object.freeze([
  'action'
]);

const SESSION_STATUS_SET = new Set(SESSION_STATUS_VALUES);

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

export function assertTransportPlaybackObservationPort(port) {
  assertPlainFrozenObject(port, 'Transport playback observation port');
  assertExactOwnKeys(port, TRANSPORT_PLAYBACK_OBSERVATION_PORT_KEYS, 'Transport playback observation port');

  const descriptor = Object.getOwnPropertyDescriptor(port, 'snapshot');
  if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'function') {
    fail('Transport playback observation port.snapshot must be an enumerable function data property.');
  }

  return port;
}

function projectPlaybackAction(observationPort) {
  const snapshot = observationPort.snapshot();
  assertPlainFrozenObject(snapshot, 'Transport playback snapshot');

  const canonical = readEnumerableDataProperty(snapshot, 'canonical', 'Transport playback snapshot');
  const operational = readEnumerableDataProperty(snapshot, 'operational', 'Transport playback snapshot');
  assertPlainFrozenObject(canonical, 'Transport playback canonical snapshot');
  assertPlainFrozenObject(operational, 'Transport playback operational snapshot');

  const status = readEnumerableDataProperty(canonical, 'status', 'Transport playback canonical snapshot');
  const playbackIntent = readEnumerableDataProperty(
    operational,
    'playbackIntent',
    'Transport playback operational snapshot'
  );

  if (typeof status !== 'string' || !SESSION_STATUS_SET.has(status)) {
    fail('Transport playback canonical status must be a known session status.');
  }
  if (typeof playbackIntent !== 'boolean') {
    fail('Transport playback operational playbackIntent must be boolean.');
  }

  const action = status === SESSION_STATUS.PAUSED
    ? CONTINUITY_COMMAND.PLAY
    : playbackIntent
      ? CONTINUITY_COMMAND.PAUSE
      : CONTINUITY_COMMAND.PLAY;

  const state = { action };
  assertExactOwnKeys(state, TRANSPORT_PLAYBACK_STATE_KEYS, 'Transport playback state');
  return Object.freeze(state);
}

export function createTransportPlaybackPresentation(observationPortInput) {
  const observationPort = assertTransportPlaybackObservationPort(observationPortInput);

  const presentation = {
    read() {
      return projectPlaybackAction(observationPort);
    }
  };

  assertExactOwnKeys(
    presentation,
    TRANSPORT_PLAYBACK_PRESENTATION_KEYS,
    'Transport playback presentation'
  );
  return Object.freeze(presentation);
}
