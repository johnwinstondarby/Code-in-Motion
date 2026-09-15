import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTransportScrubSnap } from '../src/transport/scrub-gesture.mjs';

test('scrub midpoint and clamp behavior are stable at subpixel precision', () => {
  const ids = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);
  const railWidthPx = 600;
  const midpointPx = railWidthPx / 6;
  const subpixel = 0.001;

  assert.equal(resolveTransportScrubSnap(ids, (midpointPx - subpixel) / railWidthPx).stepId, 'initial');
  assert.equal(resolveTransportScrubSnap(ids, midpointPx / railWidthPx).stepId, 'initial');
  assert.equal(resolveTransportScrubSnap(ids, (midpointPx + subpixel) / railWidthPx).stepId, 'step-01');
  assert.equal(resolveTransportScrubSnap(ids, -1 / railWidthPx).stepId, 'initial');
  assert.equal(resolveTransportScrubSnap(ids, (railWidthPx + 1) / railWidthPx).stepId, 'step-03');
});
