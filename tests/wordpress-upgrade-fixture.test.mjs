import test from 'node:test';
import assert from 'node:assert/strict';

import { selectPriorReleaseCandidate } from '../tools/build-wordpress-upgrade-fixture.mjs';

test('upgrade-pair selection chooses the first first-parent candidate with a different version', () => {
  const prior = selectPriorReleaseCandidate([
    { sha: 'current-head', version: '0.1.2' },
    { sha: 'same-version-parent', version: '0.1.2' },
    { sha: 'prior-release', version: '0.1.1' },
    { sha: 'older-release', version: '0.1.0' }
  ], '0.1.2');
  assert.deepEqual(prior, { sha: 'prior-release', version: '0.1.1' });
  assert.equal(Object.isFrozen(prior), true);
});

test('upgrade-pair selection fails when history contains no earlier release version', () => {
  assert.throws(
    () => selectPriorReleaseCandidate([
      { sha: 'head', version: '0.1.2' },
      { sha: 'parent', version: '0.1.2' }
    ], '0.1.2'),
    /no prior release version/
  );
});
