import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDomSvgRenderEvidence } from '../harness/canonicalize-dom-svg.mjs';
import { createMinimalRoot } from '../harness/minimal-dom.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { createConsoleRenderer } from '../src/renderers/subjects/console/renderer.mjs';
import {
  createRendererAbortCapability,
  createRendererClockCapability
} from '../src/runtime/renderer-capabilities.mjs';
import { createRendererContext } from '../src/runtime/renderer-context.mjs';
import { createPresentationScheduler } from '../src/runtime/presentation-scheduler.mjs';
import { virtualScheduler } from './conformance/console-test-support.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const experience = ingestExperience(JSON.parse(
  readFileSync(resolve(ROOT, 'experiences/git/git-repository-practice.json'), 'utf8')
));
const oracle = JSON.parse(
  readFileSync(resolve(ROOT, 'harness/evidence/console-v1/git-repository-practice.json'), 'utf8')
);
const IDS = ['initial', ...experience.steps.map((step) => step.id)];
const FORWARD = IDS.slice(1).map((to, index) => [IDS[index], to]);
const stateFor = (stepId) => (
  stepId === 'initial'
    ? experience.initial_state
    : experience.steps.find((step) => step.id === stepId).state
);
const configFor = (stepId) => (
  stepId === 'initial'
    ? null
    : experience.steps.find((step) => step.id === stepId).renderer_config ?? null
);
const digest = (root) => createDomSvgRenderEvidence(root).render_digest;

async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function renderContext({ stepId, fromStepId, scheduler, transitionId, animate }) {
  const abort = createRendererAbortCapability();
  const clock = createRendererClockCapability({ transitionId, scheduler });
  const context = createRendererContext({
    animate,
    fromState: fromStepId === null ? null : stateFor(fromStepId),
    fromStepId,
    stepId,
    rendererConfig: experience.renderer_config ?? null,
    stepRendererConfig: configFor(stepId),
    transitionId,
    abortSignal: abort.facade,
    clock: clock.facade,
    reducedMotion: false
  });
  return { context, abort, clock };
}

async function driveRender({ promise, source, root, stepId, frameSequence }) {
  const settlement = { state: 'pending', error: null };
  promise.then(
    () => { settlement.state = 'resolved'; },
    (error) => { settlement.state = 'rejected'; settlement.error = error; }
  );

  frameSequence.push(Object.freeze({ step: stepId, digest: digest(root) }));
  await flush();
  while (settlement.state === 'pending') {
    if (!source.runNext()) {
      await flush();
      if (settlement.state === 'pending' && source.pending() === 0) {
        throw new Error(`${stepId}: render never settled and no source-time work remains.`);
      }
      continue;
    }
    frameSequence.push(Object.freeze({ step: stepId, digest: digest(root) }));
    await flush();
  }

  if (settlement.state === 'rejected') throw settlement.error;
}

async function runGitPlaythrough(rate) {
  const source = virtualScheduler();
  const presentation = createPresentationScheduler({
    sourceScheduler: source,
    initialRate: rate
  });
  const { root } = createMinimalRoot();
  const renderer = createConsoleRenderer();
  renderer.mount({ root, instanceId: `rate-oracle-${rate}` });

  const initial = renderContext({
    stepId: 'initial',
    fromStepId: null,
    scheduler: presentation.scheduler,
    transitionId: `rate-${rate}-initial`,
    animate: false
  });
  await renderer.render(stateFor('initial'), initial.context);
  initial.clock.controller.revoke();
  initial.abort.controller.close();

  const boundarySequence = [Object.freeze({ step: 'initial', render_digest: digest(root) })];
  const frameSequence = [];

  for (const [index, [fromStepId, stepId]] of FORWARD.entries()) {
    const transition = renderContext({
      stepId,
      fromStepId,
      scheduler: presentation.scheduler,
      transitionId: `rate-${rate}-${index + 1}`,
      animate: true
    });
    const promise = renderer.render(stateFor(stepId), transition.context);
    await driveRender({ promise, source, root, stepId, frameSequence });

    boundarySequence.push(Object.freeze({ step: stepId, render_digest: digest(root) }));
    transition.clock.controller.revoke();
    transition.abort.controller.close();
    assert.equal(source.pending(), 0, `${stepId}: no source-time work remains after settlement`);
  }

  const result = Object.freeze({
    rate,
    sourceMs: source.time(),
    schedules: source.counts.schedule,
    frames: Object.freeze(frameSequence),
    boundaries: Object.freeze(boundarySequence)
  });
  renderer.dispose();
  return result;
}

test('Git specimen dilates 0.5x/1x/2x in source time while preserving every frame and protected boundary digest', async () => {
  assert.equal(oracle.boundaries.length, 19, 'the protected Console oracle remains the 19-boundary oracle');

  const one = await runGitPlaythrough(1);
  const half = await runGitPlaythrough(0.5);
  const double = await runGitPlaythrough(2);

  assert.equal(one.sourceMs, 12760, '1x source duration matches the ADR 0047 feasibility baseline');
  assert.equal(half.sourceMs, 25520, '0.5x source duration is exactly double the 1x baseline');
  assert.equal(double.sourceMs, 6380, '2x source duration is exactly half the 1x baseline');

  assert.deepEqual(one.boundaries, oracle.boundaries, '1x converges to all protected oracle boundaries');
  assert.deepEqual(half.boundaries, oracle.boundaries, '0.5x converges to all protected oracle boundaries');
  assert.deepEqual(double.boundaries, oracle.boundaries, '2x converges to all protected oracle boundaries');

  assert.deepEqual(half.frames, one.frames, '0.5x preserves the complete renderer frame sequence');
  assert.deepEqual(double.frames, one.frames, '2x preserves the complete renderer frame sequence');
  assert.equal(half.schedules, one.schedules, '0.5x changes when callbacks fire, not how many fire');
  assert.equal(double.schedules, one.schedules, '2x changes when callbacks fire, not how many fire');
});
