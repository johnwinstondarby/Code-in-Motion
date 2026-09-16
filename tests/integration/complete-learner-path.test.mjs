import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_SOURCE, EVENT_NAME } from '../../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../../src/experience/freeze-validated-experience.mjs';
import { RendererCancelledError } from '../../src/renderers/interface.mjs';
import { createCiMInstance } from '../../src/runtime/cim-instance.mjs';
import { createTransportController } from '../../src/transport/transport-controller.mjs';
import { createTransportTimeline } from '../../src/transport/timeline-projection.mjs';
import { createTransportScrubGesture } from '../../src/transport/scrub-gesture.mjs';
import { createCommentaryRevealProjection } from '../../src/commentary/reveal-projection.mjs';
import { createCommentarySelectionController } from '../../src/commentary/selection-controller.mjs';
import { createCommentaryPresentation } from '../../src/commentary/presentation.mjs';
import { createCommentaryNavigation } from '../../src/commentary/navigation.mjs';

function experienceFixture({ steps = 3 } = {}) {
  const authored = [
    {
      id: 'step-01',
      label: 'One',
      commentary: { text: 'First commentary entry', links: [] },
      state: { node: 'B' }
    },
    {
      id: 'step-02',
      label: 'Two',
      commentary: { text: 'Second commentary entry', links: [] },
      state: { node: 'C' }
    },
    {
      id: 'step-03',
      label: 'Three',
      commentary: { text: 'Third commentary entry', links: [] },
      state: { node: 'D' }
    }
  ].slice(0, steps);

  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: `complete-learner-path-${steps}`,
    renderer: 'synthetic/v1',
    initial_state: { node: 'A' },
    steps: authored
  });
}

function virtualScheduler(start = 0) {
  let now = start;
  let nextHandle = 0;
  const timers = new Map();

  const scheduler = Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      timers.set(handle, { at: now + ms, fn });
      return handle;
    },
    cancel(handle) {
      return timers.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      timers.set(handle, { at: Number.POSITIVE_INFINITY, fn });
      return handle;
    }
  });

  return { scheduler };
}

function immediateRenderer() {
  const renders = [];
  let disposeCount = 0;
  return {
    renderer: Object.freeze({
      mount() {},
      render(state, context) {
        renders.push({ state, context });
        return Promise.resolve();
      },
      dispose() {
        disposeCount += 1;
      }
    }),
    renders,
    disposeCount: () => disposeCount
  };
}

function controlledRenderer() {
  const pending = [];
  let disposeCount = 0;

  return {
    renderer: Object.freeze({
      mount() {},
      render(state, context) {
        if (!context.animate) return Promise.resolve();
        return new Promise((resolve, reject) => {
          let settled = false;
          const unsubscribe = context.abortSignal.onAbort((reason) => {
            if (settled) return;
            settled = true;
            unsubscribe();
            reject(new RendererCancelledError(reason));
          });
          pending.push({
            context,
            resolve() {
              if (settled) return false;
              settled = true;
              unsubscribe();
              resolve();
              return true;
            }
          });
        });
      },
      dispose() {
        disposeCount += 1;
      }
    }),
    pending,
    disposeCount: () => disposeCount
  };
}

function commandPort(instance) {
  return Object.freeze({
    play: (source) => instance.play(source),
    pause: (source) => instance.pause(source),
    next: (source) => instance.next(source),
    previous: (source) => instance.previous(source),
    seek: (stepId, source) => instance.seek(stepId, source),
    home: (source) => instance.home(source),
    end: (source) => instance.end(source),
    restart: (source) => instance.restart(source)
  });
}

function commentaryObservation(instance) {
  return Object.freeze({ snapshot: instance.read.snapshot });
}

function commentaryEntries(experience) {
  return Object.freeze(experience.steps.map((step) => Object.freeze({
    stepId: step.id,
    text: step.commentary.text,
    links: step.commentary.links
  })));
}

function createComposition({ steps = 3, renderer = immediateRenderer() } = {}) {
  const experience = experienceFixture({ steps });
  const time = virtualScheduler();
  const events = [];
  const instance = createCiMInstance({
    instanceId: `complete-path-${steps}`,
    experience,
    clock: time.scheduler,
    renderer: renderer.renderer,
    rendererRoot: {}
  });
  instance.events.subscribe((event) => events.push(event));

  const transport = createTransportController(commandPort(instance));
  const timeline = createTransportTimeline(instance.read);
  const scrub = createTransportScrubGesture(timeline, transport.scrubCommit);

  const reveal = createCommentaryRevealProjection({
    boundaryIds: instance.read.boundaryIds(),
    observation: commentaryObservation(instance),
    entries: commentaryEntries(experience)
  });
  const selection = createCommentarySelectionController({ reveal });
  const presentation = createCommentaryPresentation({
    selection,
    observation: commentaryObservation(instance),
    entryCount: experience.steps.length
  });
  const commentaryNavigation = createCommentaryNavigation(Object.freeze({
    seek: (stepId, source) => instance.seek(stepId, source)
  }));

  return {
    experience,
    instance,
    events,
    renderer,
    transport,
    timeline,
    scrub,
    reveal,
    selection,
    presentation,
    commentaryNavigation
  };
}

function commandEvent(events, outcome) {
  return events.find((event) =>
    event.command_id === outcome.commandId &&
    (event.event === EVENT_NAME.COMMAND_ACCEPTED || event.event === EVENT_NAME.COMMAND_REJECTED)
  );
}

function assertSource(events, outcome, source) {
  const event = commandEvent(events, outcome);
  assert.ok(event, `expected command evidence for ${outcome.command}`);
  assert.equal(event.details.source, source);
  return event;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test('complete learner path composes Transport, Commentary, Runtime, restart, and disposal without authority leakage', async () => {
  const c = createComposition();
  await c.instance.initialize();

  assert.equal(c.timeline.project().currentStepId, 'initial');
  assert.deepEqual(c.reveal.read().entries, []);
  assert.equal(c.presentation.read().selectedStepId, null);

  const next = await c.transport.next();
  assert.equal(next.result, 'success');
  assert.equal(next.toStepId, 'step-01');
  assertSource(c.events, next, COMMAND_SOURCE.TRANSPORT);
  assert.deepEqual(c.reveal.read().entries.map((entry) => entry.stepId), ['step-01']);

  const marker = await c.transport.marker('step-02');
  assert.equal(marker.result, 'success');
  assert.equal(marker.toStepId, 'step-02');
  assertSource(c.events, marker, COMMAND_SOURCE.MARKER);
  assert.deepEqual(c.reveal.read().entries.map((entry) => entry.stepId), ['step-01', 'step-02']);

  const preview = c.scrub.begin(1);
  assert.equal(preview.active, true);
  assert.equal(preview.displayStepId, 'step-03');
  assert.equal(c.timeline.project().currentStepId, 'step-02');
  assert.equal(c.timeline.project().revealFrontier, 'step-02');

  const scrub = await c.scrub.commit();
  assert.equal(scrub.result, 'success');
  assert.equal(scrub.toStepId, 'step-03');
  assertSource(c.events, scrub, COMMAND_SOURCE.SCRUB);
  assert.equal(c.timeline.project().revealFrontier, 'step-03');
  assert.deepEqual(c.timeline.project().markers.map((entry) => entry.revealed), [true, true, true]);

  const previous = await c.transport.previous();
  assert.equal(previous.toStepId, 'step-02');
  assertSource(c.events, previous, COMMAND_SOURCE.TRANSPORT);
  assert.equal(c.timeline.project().currentStepId, 'step-02');
  assert.equal(c.timeline.project().revealFrontier, 'step-03');

  c.selection.select('step-01');
  let commentary = c.presentation.read();
  assert.equal(commentary.selectedStepId, 'step-01');
  assert.equal(commentary.currentStepId, 'step-02');
  assert.equal(commentary.entries.find((entry) => entry.stepId === 'step-01').selected, true);
  assert.equal(commentary.entries.find((entry) => entry.stepId === 'step-02').active, true);

  const commentarySeek = await c.commentaryNavigation.seek('step-01');
  assert.equal(commentarySeek.result, 'success');
  assert.equal(commentarySeek.toStepId, 'step-01');
  assertSource(c.events, commentarySeek, COMMAND_SOURCE.COMMENTARY);
  commentary = c.presentation.read();
  assert.equal(commentary.selectedStepId, 'step-01');
  assert.equal(commentary.currentStepId, 'step-01');
  assert.equal(commentary.revealFrontier, 'step-03');
  assert.equal(commentary.entries.find((entry) => entry.stepId === 'step-01').active, true);

  const renderCount = c.renderer.renders.length;
  const sameBoundary = await c.commentaryNavigation.seek('step-01');
  assert.equal(sameBoundary.result, 'no_change');
  assert.equal(sameBoundary.reason, 'already_at_boundary');
  assertSource(c.events, sameBoundary, COMMAND_SOURCE.COMMENTARY);
  assert.equal(c.renderer.renders.length, renderCount);

  const restart = await c.transport.restart();
  assert.equal(restart.result, 'success');
  assert.equal(restart.toStepId, 'initial');
  assertSource(c.events, restart, COMMAND_SOURCE.TRANSPORT);
  assert.equal(c.timeline.project().currentStepId, 'initial');
  assert.equal(c.timeline.project().revealFrontier, 'initial');
  assert.deepEqual(c.reveal.read().entries, []);
  assert.equal(c.selection.read().selectedStepId, null);
  assert.deepEqual(c.presentation.read().entries, []);

  const disposed = await c.instance.dispose();
  assert.equal(disposed.canonical.status, 'disposed');
  assert.equal(c.renderer.disposeCount(), 1);

  const afterDispose = await c.transport.next();
  assert.equal(afterDispose.result, 'rejected');
  assertSource(c.events, afterDispose, COMMAND_SOURCE.TRANSPORT);
  assert.equal(c.instance.read.snapshot().canonical.status, 'disposed');
});

test('play pause and resume compose through the same Transport command-only port', async () => {
  const renderer = controlledRenderer();
  const c = createComposition({ steps: 1, renderer });
  await c.instance.initialize();

  const play = await c.transport.play();
  assert.equal(play.result, 'success');
  assertSource(c.events, play, COMMAND_SOURCE.TRANSPORT);
  assert.equal(renderer.pending.length, 1);
  let snapshot = c.instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'initial');
  assert.equal(snapshot.canonical.targetStepId, 'step-01');
  assert.equal(snapshot.canonical.status, 'transitioning');
  assert.equal(snapshot.operational.playbackIntent, true);

  const pause = await c.transport.pause();
  assert.equal(pause.result, 'success');
  assertSource(c.events, pause, COMMAND_SOURCE.TRANSPORT);
  snapshot = c.instance.read.snapshot();
  assert.equal(snapshot.canonical.status, 'paused');

  const resume = await c.transport.play();
  assert.equal(resume.result, 'success');
  assertSource(c.events, resume, COMMAND_SOURCE.TRANSPORT);
  assert.equal(renderer.pending.length, 1);

  assert.equal(renderer.pending[0].resolve(), true);
  await flush();

  snapshot = c.instance.read.snapshot();
  assert.equal(snapshot.canonical.currentStepId, 'step-01');
  assert.equal(snapshot.canonical.targetStepId, null);
  assert.equal(snapshot.canonical.revealFrontier, 'step-01');
  assert.equal(snapshot.canonical.status, 'idle');
  assert.equal(snapshot.operational.playbackIntent, false);
  assert.deepEqual(c.reveal.read().entries.map((entry) => entry.stepId), ['step-01']);

  const disposed = await c.instance.dispose();
  assert.equal(disposed.canonical.status, 'disposed');
  assert.equal(renderer.disposeCount(), 1);
});
