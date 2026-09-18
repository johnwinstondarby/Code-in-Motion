import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import {
  createWordPressDeepLinkResolver,
  parseCiMDeepLinkFragment,
  resolveWordPressDeepLink
} from '../src/host/wordpress-deep-link.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'git-basic-cycle',
    renderer: 'git/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [{
      id: 'step-01',
      label: 'Status',
      commentary: { text: 'Status', links: [] },
      state: { node: 'A' }
    }]
  });
}

test('R27 WordPress deep-link parser accepts the canonical grammar', () => {
  assert.deepEqual(
    parseCiMDeepLinkFragment('#cim/git-basic-cycle/step-01'),
    { experienceId: 'git-basic-cycle', stepId: 'step-01' }
  );
  assert.deepEqual(
    parseCiMDeepLinkFragment('#cim/git-basic-cycle/initial'),
    { experienceId: 'git-basic-cycle', stepId: 'initial' }
  );
});

test('R27 WordPress deep-link parser ignores non-CiM fragments and rejects malformed CiM fragments', () => {
  assert.equal(parseCiMDeepLinkFragment(''), null);
  assert.equal(parseCiMDeepLinkFragment('#reference'), null);
  assert.throws(
    () => parseCiMDeepLinkFragment('#cim/git-basic-cycle'),
    /#cim\/\{experience-id\}\/\{step-id\}/
  );
});

test('R27 WordPress deep-link resolver isolates experience identity and validates semantic boundaries', () => {
  const experience = experienceFixture();

  assert.equal(
    resolveWordPressDeepLink('#cim/other/step-01', 'git-basic-cycle', experience),
    null
  );
  assert.deepEqual(
    resolveWordPressDeepLink('#cim/git-basic-cycle/step-01', 'git-basic-cycle', experience),
    { stepId: 'step-01', source: 'deep_link' }
  );
  assert.throws(
    () => resolveWordPressDeepLink('#cim/git-basic-cycle/missing', 'git-basic-cycle', experience),
    /known semantic boundary/
  );
});

test('R27 WordPress deep-link resolver reads the live fragment at resolution time', () => {
  const experience = experienceFixture();
  let fragment = '#cim/git-basic-cycle/step-01';
  const resolver = createWordPressDeepLinkResolver({ readFragment: () => fragment });

  assert.deepEqual(resolver.resolve('git-basic-cycle', experience), {
    stepId: 'step-01',
    source: 'deep_link'
  });

  fragment = '#reference';
  assert.equal(resolver.resolve('git-basic-cycle', experience), null);
});
