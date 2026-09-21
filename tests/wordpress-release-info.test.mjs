import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildWordPressReleaseInfo,
  parseCurrentReadmeRelease,
  validateWordPressReleaseInfo,
  validateWordPressReleaseInfoData,
  wordPressReleaseInfoSource
} from '../tools/check-wordpress-release-info.mjs';

test('R33 canonical release-info projection is exact and current', async () => {
  const readme = await readFile(new URL('../readme.txt', import.meta.url), 'utf8');
  const source = await readFile(
    new URL('../wordpress/release/release-info.generated.json', import.meta.url),
    'utf8'
  );
  const data = JSON.parse(source);
  const expected = buildWordPressReleaseInfo(readme);

  assert.equal(source, wordPressReleaseInfoSource(expected));
  assert.deepEqual(Reflect.ownKeys(data), [
    'schema',
    'stable_tag',
    'tested_up_to',
    'current_release',
    'support_uri'
  ]);
  assert.deepEqual(Reflect.ownKeys(data.current_release), ['version', 'notes']);
  assert.equal(data.schema, 'localis.cim/wordpress-release-info/v1');
  assert.equal(data.current_release.version, data.stable_tag);
  assert.ok(data.current_release.notes.length >= 1);
  await assert.doesNotReject(() => validateWordPressReleaseInfo());
});

test('R33 current release notes derive only from the current changelog entry', () => {
  const source = `=== Code in Motion ===
Tags: interactive
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 9.8.7
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Description.

== Description ==
Description.

== Installation ==
Install.

== Support ==
https://github.com/johnwinstondarby/Code-in-Motion/issues

== Changelog ==

= 9.8.7 =
* First current note.
* Second current note.

= 9.8.6 =
* Prior note.
`;

  assert.deepEqual(parseCurrentReadmeRelease(source, '9.8.7'), {
    version: '9.8.7',
    notes: ['First current note.', 'Second current note.']
  });
});

test('R33 release-info validation rejects widened or inconsistent data', () => {
  const base = {
    schema: 'localis.cim/wordpress-release-info/v1',
    stable_tag: '0.1.5',
    tested_up_to: '7.1',
    current_release: {
      version: '0.1.5',
      notes: ['Current note.']
    },
    support_uri: 'https://github.com/johnwinstondarby/Code-in-Motion/issues'
  };

  assert.throws(
    () => validateWordPressReleaseInfoData({ ...base, extra: true }),
    /must contain exactly/
  );
  assert.throws(
    () => validateWordPressReleaseInfoData({
      ...base,
      current_release: { ...base.current_release, version: '0.1.4' }
    }),
    /must equal stable_tag/
  );
  assert.throws(
    () => validateWordPressReleaseInfoData({
      ...base,
      current_release: { ...base.current_release, notes: [] }
    }),
    /non-empty array/
  );
  assert.throws(
    () => validateWordPressReleaseInfoData({ ...base, support_uri: 'http://example.invalid' }),
    /must use HTTPS/
  );
});

test('R33 changelog parser rejects missing headings and non-bullet current content', () => {
  assert.throws(
    () => parseCurrentReadmeRelease('== Changelog ==\n= 1.0.0 =\n* Note.\n', '2.0.0'),
    /current changelog heading is missing/
  );
  assert.throws(
    () => parseCurrentReadmeRelease('== Changelog ==\n= 1.0.0 =\nParagraph.\n', '1.0.0'),
    /only bullet lines/
  );
});
