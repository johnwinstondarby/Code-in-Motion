import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WORDPRESS_TRANSPORT_BUTTON_LABELS,
  WORDPRESS_TRANSPORT_CONTROL_KEYS,
  WORDPRESS_TRANSPORT_VISIBLE_CONTROL_ORDER
} from '../wordpress/assets/transport-binding.mjs';

const EXPECTED_CONTROL_KEYS = Object.freeze([
  'home',
  'previous',
  'playback',
  'next',
  'end',
  'restart'
]);
const EXPECTED_VISIBLE_CONTROL_ORDER = Object.freeze([
  'home',
  'previous',
  'playback',
  'next',
  'end'
]);
const EXPECTED_BUTTON_LABELS = Object.freeze({
  play: 'Play',
  pause: 'Pause',
  previous: 'Previous',
  next: 'Next',
  home: 'Start',
  end: 'End',
  restart: 'Restart'
});

function fail(message) {
  throw new Error(`R40 WordPress production Transport composition: ${message}`);
}

function assertFrozenStringArray(actual, expected, label) {
  if (!Array.isArray(actual)) fail(`${label} must be an array.`);
  if (!Object.isFrozen(actual)) fail(`${label} must be frozen.`);
  if (actual.some((value) => typeof value !== 'string')) fail(`${label} must contain strings only.`);
  if (new Set(actual).size !== actual.length) fail(`${label} must not contain duplicate controls.`);
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    fail(`${label} must be exactly [${expected.join(', ')}] in that order.`);
  }
}

function assertFrozenLabels(actual) {
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
    fail('button labels must be an object.');
  }
  if (!Object.isFrozen(actual)) fail('button labels must be frozen.');

  const expectedKeys = Object.keys(EXPECTED_BUTTON_LABELS);
  const actualKeys = Object.keys(actual);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail(`button label keys must be exactly [${expectedKeys.join(', ')}] in that order.`);
  }

  for (const key of expectedKeys) {
    if (actual[key] !== EXPECTED_BUTTON_LABELS[key]) {
      fail(`button label ${key} must be ${JSON.stringify(EXPECTED_BUTTON_LABELS[key])}.`);
    }
  }
}

export function assertWordPressProductionTransportComposition({
  controlKeys,
  visibleControlOrder,
  buttonLabels
}) {
  assertFrozenStringArray(controlKeys, EXPECTED_CONTROL_KEYS, 'control keys');
  assertFrozenStringArray(
    visibleControlOrder,
    EXPECTED_VISIBLE_CONTROL_ORDER,
    'visible control order'
  );
  assertFrozenLabels(buttonLabels);
  return true;
}

function checkWordPressProductionTransportComposition() {
  assertWordPressProductionTransportComposition({
    controlKeys: WORDPRESS_TRANSPORT_CONTROL_KEYS,
    visibleControlOrder: WORDPRESS_TRANSPORT_VISIBLE_CONTROL_ORDER,
    buttonLabels: WORDPRESS_TRANSPORT_BUTTON_LABELS
  });
  console.log('PASS: R40 WordPress production Transport composition contract.');
}

const invokedAsScript =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  try {
    checkWordPressProductionTransportComposition();
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}
