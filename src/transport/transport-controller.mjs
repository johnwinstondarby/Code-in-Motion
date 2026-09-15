import { COMMAND_SOURCE } from '../contracts/events.mjs';

export const TRANSPORT_COMMAND_PORT_KEYS = Object.freeze([
  'play',
  'pause',
  'next',
  'previous',
  'seek',
  'home',
  'end',
  'restart'
]);

export const TRANSPORT_TIMELINE_KEY_ACTION = Object.freeze({
  ArrowLeft: 'previous',
  ArrowRight: 'next',
  Home: 'home',
  End: 'end'
});

export const TRANSPORT_PLAYBACK_ACTION = Object.freeze({
  PLAY: 'play',
  PAUSE: 'pause'
});

export const TRANSPORT_PLAYBACK_KEY = ' ';

export const TRANSPORT_CONTROLLER_KEYS = Object.freeze([
  'play',
  'pause',
  'next',
  'previous',
  'home',
  'end',
  'restart',
  'marker',
  'scrubCommit',
  'scrubCancel',
  'timelineKey',
  'playbackKey'
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

export function assertTransportCommandPort(port) {
  assertPlainFrozenObject(port, 'Transport command port');
  assertExactOwnKeys(port, TRANSPORT_COMMAND_PORT_KEYS, 'Transport command port');

  const descriptors = Object.getOwnPropertyDescriptors(port);
  for (const key of TRANSPORT_COMMAND_PORT_KEYS) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`Transport command port.${key} must be an enumerable data property.`);
    }
    if (typeof descriptor.value !== 'function') {
      fail(`Transport command port.${key} must be a function.`);
    }
  }

  return port;
}

function assertPlaybackAction(action) {
  if (action !== TRANSPORT_PLAYBACK_ACTION.PLAY && action !== TRANSPORT_PLAYBACK_ACTION.PAUSE) {
    fail('Transport playback action must be play or pause.');
  }
  return action;
}

export function createTransportController(portInput) {
  const port = assertTransportCommandPort(portInput);

  const controller = {
    play() {
      return port.play(COMMAND_SOURCE.TRANSPORT);
    },

    pause() {
      return port.pause(COMMAND_SOURCE.TRANSPORT);
    },

    next() {
      return port.next(COMMAND_SOURCE.TRANSPORT);
    },

    previous() {
      return port.previous(COMMAND_SOURCE.TRANSPORT);
    },

    home() {
      return port.home(COMMAND_SOURCE.TRANSPORT);
    },

    end() {
      return port.end(COMMAND_SOURCE.TRANSPORT);
    },

    restart() {
      return port.restart(COMMAND_SOURCE.TRANSPORT);
    },

    marker(stepId) {
      return port.seek(stepId, COMMAND_SOURCE.MARKER);
    },

    scrubCommit(stepId) {
      return port.seek(stepId, COMMAND_SOURCE.SCRUB);
    },

    scrubCancel() {
      return null;
    },

    timelineKey(key) {
      const action = TRANSPORT_TIMELINE_KEY_ACTION[key];
      if (action === undefined) return null;
      return controller[action]();
    },

    playbackKey(key, actionInput) {
      if (key !== TRANSPORT_PLAYBACK_KEY) return null;
      const action = assertPlaybackAction(actionInput);
      return controller[action]();
    }
  };

  assertExactOwnKeys(controller, TRANSPORT_CONTROLLER_KEYS, 'Transport controller');
  return Object.freeze(controller);
}
