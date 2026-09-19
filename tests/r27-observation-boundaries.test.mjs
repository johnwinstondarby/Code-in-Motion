import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createCommentaryPresentation } from '../src/commentary/presentation.mjs';
import { createCommentaryRevealProjection } from '../src/commentary/reveal-projection.mjs';
import { createCommentarySelectionController } from '../src/commentary/selection-controller.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';
import { createTransportTimeline } from '../src/transport/timeline-projection.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function scheduler() {
  let handle = 0;
  return Object.freeze({
    now: () => 0,
    schedule() {
      handle += 1;
      return handle;
    },
    cancel() {
      return true;
    },
    onFrame() {
      handle += 1;
      return handle;
    }
  });
}

function recordingRenderer() {
  const renders = [];
  return {
    renders,
    renderer: Object.freeze({
      mount() {},
      render(state, context) {
        renders.push(Object.freeze({
          stepId: context.stepId,
          stateDigest: digest(state)
        }));
        return Promise.resolve();
      },
      dispose() {}
    })
  };
}

function commentaryEntries(experience) {
  return Object.freeze(experience.steps.map((step) => Object.freeze({
    stepId: step.id,
    text: step.commentary.text,
    links: step.commentary.links
  })));
}

function commentaryObservation(instance) {
  return Object.freeze({ snapshot: instance.read.snapshot });
}

test('R27 production observation boundaries advance semantics across unchanged Git state', async () => {
  const [experienceSource, factsSource] = await Promise.all([
    readFile(resolve(ROOT, 'experiences/git/git-basic-cycle.json'), 'utf8'),
    readFile(resolve(ROOT, 'authoring/git/git-subject-facts.json'), 'utf8')
  ]);
  const experience = freezeValidatedExperience(JSON.parse(experienceSource));
  const facts = JSON.parse(factsSource);
  const factByCommand = new Map(facts.facts.map((fact) => [fact.command, fact]));
  const recording = recordingRenderer();

  const instance = createCiMInstance({
    instanceId: 'r27-observation-boundaries',
    experience,
    clock: scheduler(),
    renderer: recording.renderer,
    rendererRoot: {}
  });

  const timeline = createTransportTimeline(instance.read);
  const reveal = createCommentaryRevealProjection({
    boundaryIds: instance.read.boundaryIds(),
    observation: commentaryObservation(instance),
    entries: commentaryEntries(experience)
  });
  const selection = createCommentarySelectionController({ reveal });
  const commentary = createCommentaryPresentation({
    selection,
    observation: commentaryObservation(instance),
    entryCount: experience.steps.length
  });

  await instance.initialize();
  assert.equal(instance.read.snapshot().canonical.currentStepId, 'initial');

  let previousState = experience.initial_state;
  let expectedRenderCount = 1;

  for (const step of experience.steps) {
    const fact = factByCommand.get(step.label);
    assert.ok(fact, 'expected canonical fact for ' + step.label);

    const previousDigest = digest(previousState);
    const destinationDigest = digest(step.state);

    if (fact.stateEffect === 'observe') {
      assert.equal(
        destinationDigest,
        previousDigest,
        step.id + ' observation boundary must preserve the Git state digest'
      );
    }

    const outcome = await instance.next();
    assert.equal(outcome.result, 'success');
    assert.equal(outcome.toStepId, step.id);

    expectedRenderCount += 1;
    assert.equal(
      recording.renders.length,
      expectedRenderCount,
      step.id + ' must render even when the subject-state digest is unchanged'
    );
    assert.equal(recording.renders.at(-1).stepId, step.id);

    const canonical = instance.read.snapshot().canonical;
    assert.equal(canonical.currentStepId, step.id);

    const presentation = commentary.read();
    assert.equal(presentation.currentStepId, step.id);
    assert.equal(
      presentation.entries.find((entry) => entry.stepId === step.id)?.active,
      true,
      step.id + ' commentary must advance with canonical position'
    );

    const projected = timeline.project();
    const marker = projected.markers.find((entry) => entry.stepId === step.id);
    assert.ok(marker, 'expected transport marker for ' + step.id);
    assert.equal(marker.current, true, step.id + ' marker must advance with canonical position');

    if (fact.stateEffect === 'observe') {
      assert.equal(
        recording.renders.at(-1).stateDigest,
        previousDigest,
        step.id + ' renderer receives unchanged state while semantic position advances'
      );
    }

    previousState = step.state;
  }

  assert.deepEqual(
    facts.facts.filter((fact) => fact.stateEffect === 'observe').map((fact) => fact.command),
    ['git status', 'git diff', 'git rev-parse HEAD', 'git reflog']
  );

  await instance.dispose();
});
