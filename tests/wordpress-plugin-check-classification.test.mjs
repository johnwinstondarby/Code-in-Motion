import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertPluginCheckReleaseGate,
  classifyPluginCheckFindings,
  parsePluginCheckReport
} from '../tools/check-wordpress-plugin-check.mjs';

test('R21 accepts only the approved global-enqueue warning codes', () => {
  const source = [
    'FILE: wordpress/assets/cim.css',
    JSON.stringify([
      {
        line: 0,
        column: 0,
        type: 'WARNING',
        code: 'EnqueuedStylesScope',
        message: 'This style is being loaded in all contexts.'
      }
    ]),
    '',
    'FILE: wordpress/assets/bootstrap.js',
    JSON.stringify([
      {
        line: 0,
        column: 0,
        type: 'WARNING',
        code: 'EnqueuedScriptsScope',
        message: 'This script is being loaded in all frontend contexts.'
      }
    ]),
    ''
  ].join('\n');

  const findings = parsePluginCheckReport(source);
  assert.equal(findings.length, 2);

  const classified = classifyPluginCheckFindings(findings);
  assert.equal(classified.failures.length, 0);
  assert.equal(classified.review.length, 0);
  assert.equal(classified.accepted.length, 2);

  assert.doesNotThrow(() => assertPluginCheckReleaseGate(source));
});

test('R21 rejects every Plugin Check error', () => {
  const source = [
    'FILE: code-in-motion.php',
    JSON.stringify([
      {
        line: 0,
        column: 0,
        type: 'ERROR',
        code: 'plugin_header_no_license',
        message: 'Missing License in Plugin Header.'
      }
    ])
  ].join('\n');

  assert.throws(
    () => assertPluginCheckReleaseGate(source),
    /1 FAIL, 0 REVIEW, 0 ACCEPTED EXCEPTION/
  );
});

test('R21 leaves an unclassified warning in REVIEW and fails the gate', () => {
  const source = [
    'FILE: code-in-motion.php',
    JSON.stringify([
      {
        line: 0,
        column: 0,
        type: 'WARNING',
        code: 'FutureUnknownWarning',
        message: 'A future warning needs an explicit decision.'
      }
    ])
  ].join('\n');

  assert.throws(
    () => assertPluginCheckReleaseGate(source),
    /0 FAIL, 1 REVIEW, 0 ACCEPTED EXCEPTION/
  );
});
