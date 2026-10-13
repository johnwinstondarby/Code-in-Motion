import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsoleFollowController } from '../wordpress/assets/console-follow-controller.mjs';

test('Console progress includes partial output and keeps held and suspended policy distinct', () => {
  let content = 'git sta';
  const follow = createConsoleFollowController({readContent:() => content});
  follow.hold('pointer');
  follow.hold('selection');
  content = 'git status\nOn branch main';
  assert.equal(follow.read().following, true);
  assert.equal(follow.read().newerStepsAvailable, true);
  follow.release('pointer');
  assert.equal(follow.read().held, true);
  follow.suspend();
  follow.release('selection');
  assert.equal(follow.read().following, false);
  assert.equal(follow.read().newerStepsAvailable, true);
  follow.resume();
  assert.equal(follow.read().newerStepsAvailable, false);
  content += '\nmodified: file';
  assert.equal(follow.read().newerStepsAvailable, false);
});

test('Console replacement with identical text is inert and contraction rebases ownership', () => {
  let content = 'git status\nOn branch main';
  const follow = createConsoleFollowController({readContent:() => content});
  const original = follow.read();
  assert.equal(follow.read().latestVisibleStepId, original.latestVisibleStepId);
  follow.suspend();
  content += '\nnew output';
  assert.equal(follow.read().newerStepsAvailable, true);
  content = '';
  assert.equal(follow.read().following, false);
  assert.equal(follow.read().newerStepsAvailable, false);
  content = 'new command';
  assert.equal(follow.read().newerStepsAvailable, true);
});

test('Console validation happens before holds or ownership change', () => {
  let content = 'git status';
  const follow = createConsoleFollowController({readContent:() => content});
  follow.hold('focus');
  content = null;
  assert.throws(() => follow.release('focus'), /must be a string/);
  assert.throws(() => follow.suspend(), /must be a string/);
  content = 'git status';
  assert.equal(follow.read().held, true);
  assert.equal(follow.read().following, true);
  assert.throws(() => follow.hold('click'), /Unknown/);
});
