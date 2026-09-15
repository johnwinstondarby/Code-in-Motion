import {
  TRANSPORT_PLAYBACK_PRESENTATION_KEYS,
  TRANSPORT_PLAYBACK_STATE_KEYS
} from './playback-presentation.mjs';

export const TRANSPORT_BUTTON_PRESENTATION_KEYS = Object.freeze(['read']);
export const TRANSPORT_BUTTON_PRESENTATION_OPTIONS_KEYS = Object.freeze([
  'playbackPresentation',
  'labels'
]);
export const TRANSPORT_BUTTON_LABEL_KEYS = Object.freeze([
  'play',
  'pause',
  'previous',
  'next',
  'home',
  'end',
  'restart'
]);
export const TRANSPORT_BUTTON_STATE_KEYS = Object.freeze([
  'playback',
  'previous',
  'next',
  'home',
  'end',
  'restart'
]);
export const TRANSPORT_BUTTON_RECORD_KEYS = Object.freeze(['action', 'label']);

const PLAYBACK_ACTIONS = new Set(['play', 'pause']);
const STATIC_ACTIONS = Object.freeze({
  previous: 'previous',
  next: 'next',
  home: 'home',
  end: 'end',
  restart: 'restart'
});

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertPlainFrozenObject(value, label) {
  assertPlainObject(value, label);
  if (!Object.isFrozen(value)) fail(`${label} must be frozen.`);
}

function assertExactOwnKeys(value, expectedKeys, label) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) fail(`${label} must not contain symbol keys.`);
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

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertPlaybackPresentation(value) {
  assertPlainFrozenObject(value, 'Transport button playback presentation');
  assertExactOwnKeys(
    value,
    TRANSPORT_PLAYBACK_PRESENTATION_KEYS,
    'Transport button playback presentation'
  );
  if (typeof readEnumerableDataProperty(
    value,
    'read',
    'Transport button playback presentation'
  ) !== 'function') {
    fail('Transport button playback presentation.read must be a function.');
  }
  return value;
}

function readLabels(value) {
  assertPlainFrozenObject(value, 'Transport button labels');
  assertExactOwnKeys(value, TRANSPORT_BUTTON_LABEL_KEYS, 'Transport button labels');
  const labels = {};
  for (const key of TRANSPORT_BUTTON_LABEL_KEYS) {
    labels[key] = assertNonEmptyString(
      readEnumerableDataProperty(value, key, 'Transport button labels'),
      `Transport button labels.${key}`
    );
  }
  return Object.freeze(labels);
}

function readPlaybackAction(presentation) {
  const state = presentation.read();
  assertPlainFrozenObject(state, 'Transport button playback state');
  assertExactOwnKeys(state, TRANSPORT_PLAYBACK_STATE_KEYS, 'Transport button playback state');
  const action = readEnumerableDataProperty(state, 'action', 'Transport button playback state');
  if (!PLAYBACK_ACTIONS.has(action)) {
    fail('Transport button playback action must be play or pause.');
  }
  return action;
}

function makeRecord(action, label) {
  const record = Object.freeze({ action, label });
  assertExactOwnKeys(record, TRANSPORT_BUTTON_RECORD_KEYS, 'Transport button record');
  return record;
}

export function createTransportButtonPresentation(optionsInput) {
  assertPlainObject(optionsInput, 'Transport button presentation options');
  assertExactOwnKeys(
    optionsInput,
    TRANSPORT_BUTTON_PRESENTATION_OPTIONS_KEYS,
    'Transport button presentation options'
  );

  const playbackPresentation = assertPlaybackPresentation(
    readEnumerableDataProperty(
      optionsInput,
      'playbackPresentation',
      'Transport button presentation options'
    )
  );
  const labels = readLabels(
    readEnumerableDataProperty(optionsInput, 'labels', 'Transport button presentation options')
  );

  const staticRecords = Object.freeze({
    previous: makeRecord(STATIC_ACTIONS.previous, labels.previous),
    next: makeRecord(STATIC_ACTIONS.next, labels.next),
    home: makeRecord(STATIC_ACTIONS.home, labels.home),
    end: makeRecord(STATIC_ACTIONS.end, labels.end),
    restart: makeRecord(STATIC_ACTIONS.restart, labels.restart)
  });

  const presentation = {
    read() {
      const playbackAction = readPlaybackAction(playbackPresentation);
      const state = Object.freeze({
        playback: makeRecord(playbackAction, labels[playbackAction]),
        previous: staticRecords.previous,
        next: staticRecords.next,
        home: staticRecords.home,
        end: staticRecords.end,
        restart: staticRecords.restart
      });
      assertExactOwnKeys(state, TRANSPORT_BUTTON_STATE_KEYS, 'Transport button presentation state');
      return state;
    }
  };

  assertExactOwnKeys(
    presentation,
    TRANSPORT_BUTTON_PRESENTATION_KEYS,
    'Transport button presentation'
  );
  return Object.freeze(presentation);
}
