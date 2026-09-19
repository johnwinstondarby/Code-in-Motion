import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ACCEPTED_EXCEPTIONS = new Map([
  [
    'EnqueuedStylesScope',
    'CiM keeps the stable stylesheet available across frontend contexts so Host rendering does not depend on shortcode-presence prediction.'
  ],
  [
    'EnqueuedScriptsScope',
    'CiM keeps the stable bootstrap available across frontend contexts so Host startup does not depend on shortcode-presence prediction.'
  ]
]);

const SEMVER_LITERAL_PATTERN = /\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/;

function fail(message) {
  throw new Error('R21 Plugin Check classification: ' + message);
}

export function parsePluginCheckReport(source) {
  if (typeof source !== 'string') fail('report source must be a string.');

  const lines = source.split(/\r?\n/);
  const findings = [];
  let currentFile = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (line.startsWith('FILE: ')) {
      currentFile = line.slice('FILE: '.length).trim();
      if (currentFile.length === 0) fail('FILE marker must name a path.');
      continue;
    }

    if (!line.startsWith('[')) {
      fail('unexpected report line: ' + line);
    }
    if (currentFile === null) fail('JSON findings appeared before a FILE marker.');

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      fail('invalid JSON for ' + currentFile + ': ' + error.message);
    }
    if (!Array.isArray(parsed)) fail('findings for ' + currentFile + ' must be a JSON array.');

    for (const finding of parsed) {
      if (finding === null || typeof finding !== 'object' || Array.isArray(finding)) {
        fail('finding for ' + currentFile + ' must be an object.');
      }
      const { type, code, message } = finding;
      if (typeof type !== 'string' || typeof code !== 'string' || typeof message !== 'string') {
        fail('finding for ' + currentFile + ' must contain string type, code, and message.');
      }
      findings.push(Object.freeze({ file: currentFile, type, code, message }));
    }
  }

  return Object.freeze(findings);
}

export function classifyPluginCheckFindings(findings) {
  if (!Array.isArray(findings)) fail('findings must be an array.');

  const accepted = [];
  const review = [];
  const failures = [];

  for (const finding of findings) {
    if (finding.type === 'ERROR') {
      failures.push(Object.freeze({
        ...finding,
        classification: 'FAIL',
        rationale: 'Plugin Check errors are release-blocking in R21.'
      }));
      continue;
    }

    if (finding.type !== 'WARNING') {
      review.push(Object.freeze({
        ...finding,
        classification: 'REVIEW',
        rationale: 'Unknown Plugin Check finding type: ' + finding.type
      }));
      continue;
    }

    const rationale = ACCEPTED_EXCEPTIONS.get(finding.code);
    if (rationale === undefined) {
      review.push(Object.freeze({
        ...finding,
        classification: 'REVIEW',
        rationale: 'Warning code has no R21-approved classification.'
      }));
      continue;
    }

    if (SEMVER_LITERAL_PATTERN.test(rationale)) {
      fail(
        'accepted-exception rationale for ' + finding.code +
        ' must be version-neutral; release identity belongs to artifact evidence.'
      );
    }

    accepted.push(Object.freeze({
      ...finding,
      classification: 'ACCEPTED EXCEPTION',
      rationale
    }));
  }

  return Object.freeze({
    accepted: Object.freeze(accepted),
    review: Object.freeze(review),
    failures: Object.freeze(failures)
  });
}

export function assertPluginCheckReleaseGate(source, logPrefix = '') {
  if (typeof logPrefix !== 'string') fail('log prefix must be a string.');

  const findings = parsePluginCheckReport(source);
  const classified = classifyPluginCheckFindings(findings);

  for (const finding of [...classified.failures, ...classified.review]) {
    console.error(
      logPrefix + finding.classification + ': ' + finding.code + ' (' + finding.file + ') — ' + finding.message
    );
  }
  for (const finding of classified.accepted) {
    console.log(
      logPrefix + 'ACCEPTED EXCEPTION: ' + finding.code + ' (' + finding.file + ') — ' + finding.rationale
    );
  }

  if (classified.failures.length > 0 || classified.review.length > 0) {
    fail(
      classified.failures.length + ' FAIL, ' +
      classified.review.length + ' REVIEW, ' +
      classified.accepted.length + ' ACCEPTED EXCEPTION.'
    );
  }

  console.log(
    logPrefix + 'PASS: R21 Plugin Check classification (' + findings.length + ' finding(s), 0 FAIL, 0 REVIEW, ' +
    classified.accepted.length + ' ACCEPTED EXCEPTION).'
  );
  return classified;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error('Usage: node tools/check-wordpress-plugin-check.mjs <plugin-check-report>');
    process.exitCode = 2;
  } else {
    readFile(resolve(reportPath), 'utf8')
      .then(assertPluginCheckReleaseGate)
      .catch((error) => {
        console.error(error.stack ?? error.message);
        process.exitCode = 1;
      });
  }
}
