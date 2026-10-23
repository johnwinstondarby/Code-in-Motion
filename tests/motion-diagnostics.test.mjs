import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {instrumentMotionSource} from './helpers/motion-diagnostics.mjs';

test('Motion diagnostic injection refuses changed anchors instead of silently losing evidence', async () => {
  const source = await readFile(new URL('../src/multipane/motion.mjs',import.meta.url),'utf8');
  const instrumented = instrumentMotionSource(source);
  assert.match(instrumented, /debug\('final-resolved'\)/);
  assert.match(instrumented, /debug\('finish'/);
  assert.match(instrumented, /debug\('pinPause'/);
  assert.throws(() => instrumentMotionSource(source.replace('async function finalStill(){','async function renamed(){')), /anchor changed/);
  assert.throws(() => instrumentMotionSource(source+source), /anchor changed/);
});
