import test from 'node:test';
import assert from 'node:assert/strict';

import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';
import {
  TRANSPORT_MARKER_KEYS,
  TRANSPORT_OBSERVATION_PORT_KEYS,
  TRANSPORT_TIMELINE_KEYS,
  TRANSPORT_TIMELINE_PROJECTION_KEYS,
  assertTransportObservationPort,
  createTransportTimeline
} from '../src/transport/timeline-projection.mjs';

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'transport-timeline-fixture',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      { id: 'step-01', label: 'One', commentary: { text: 'One', links: [] }, state: { node: 'B' } },
      { id: 'step-02', label: 'Two', commentary: { text: 'Two', links: [] }, state: { node: 'C' } },
      { id: 'step-03', label: 'Three', commentary: { text: 'Three', links: [] }, state: { node: 'D' } }
    ]
  });
}

function frozenSnapshot(currentStepId = 'initial', targetStepId = null, revealFrontier = 'initial') {
  return Object.freeze({
    canonical: Object.freeze({
      currentStepId,
      targetStepId,
      revealFrontier
    })
  });
}

function makeObservationPort({
  boundaryIds = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']),
  snapshot = frozenSnapshot()
} = {}) {
  let currentSnapshot = snapshot;
  return {
    port: Object.freeze({
      snapshot() {
        return currentSnapshot;
      },
      boundaryIds() {
        return boundaryIds;
      }
    }),
    setSnapshot(next) {
      currentSnapshot = next;
    }
  };
}

function assertMarker(marker, expected) {
  assert.deepEqual(Object.keys(marker), TRANSPORT_MARKER_KEYS);
  assert.equal(Object.isFrozen(marker), true);
  assert.deepEqual(marker, expected);
}

test('Transport observation port is the exact frozen Runtime read capability surface', () => {
  const instance = createCiMInstance({
    instanceId: 'transport-timeline-instance',
    experience: experienceFixture(),
    clock: Object.freeze({ now: () => 0 })
  });

  assert.deepEqual(Object.keys(instance.read), TRANSPORT_OBSERVATION_PORT_KEYS);
  assert.equal(assertTransportObservationPort(instance.read), instance.read);
  assert.throws(() => assertTransportObservationPort(instance), /Transport observation port/);

  const timeline = createTransportTimeline(instance.read);
  assert.deepEqual(Object.keys(timeline), TRANSPORT_TIMELINE_KEYS);
  assert.equal(Object.isFrozen(timeline), true);
  assert.equal(timeline.boundaryIds(), instance.read.boundaryIds());
});

test('observation port rejects extra, symbol, accessor, mutable, non-function, and non-plain authority shapes', async (t) => {
  const { port } = makeObservationPort();

  await t.test('extra key', () => {
    const candidate = Object.freeze({ ...port, events() {} });
    assert.throws(() => assertTransportObservationPort(candidate), /exactly/);
  });

  await t.test('symbol key', () => {
    const candidate = { snapshot: port.snapshot, boundaryIds: port.boundaryIds };
    candidate[Symbol('hidden')] = () => {};
    Object.freeze(candidate);
    assert.throws(() => assertTransportObservationPort(candidate), /symbol/);
  });

  await t.test('accessor', () => {
    const candidate = { boundaryIds: port.boundaryIds };
    Object.defineProperty(candidate, 'snapshot', { enumerable: true, get: () => port.snapshot });
    Object.freeze(candidate);
    assert.throws(() => assertTransportObservationPort(candidate), /enumerable data property/);
  });

  await t.test('mutable', () => {
    assert.throws(() => assertTransportObservationPort({ snapshot: port.snapshot, boundaryIds: port.boundaryIds }), /frozen/);
  });

  await t.test('non-function', () => {
    const candidate = Object.freeze({ snapshot: null, boundaryIds: port.boundaryIds });
    assert.throws(() => assertTransportObservationPort(candidate), /must be a function/);
  });

  await t.test('non-plain', () => {
    class ObservationPort {
      snapshot() {}
      boundaryIds() {}
    }
    assert.throws(() => assertTransportObservationPort(Object.freeze(new ObservationPort())), /plain object/);
  });
});

test('initial semantic projection is frozen, exact, ordinal, and geometry-free', () => {
  const { port } = makeObservationPort();
  const timeline = createTransportTimeline(port);
  const projection = timeline.project();

  assert.deepEqual(Object.keys(projection), TRANSPORT_TIMELINE_PROJECTION_KEYS);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.markers), true);
  assert.equal(projection.currentStepId, 'initial');
  assert.equal(projection.targetStepId, null);
  assert.equal(projection.revealFrontier, 'initial');

  assertMarker(projection.markers[0], {
    stepId: 'initial', index: 0, current: true, target: false, revealed: true
  });
  assertMarker(projection.markers[1], {
    stepId: 'step-01', index: 1, current: false, target: false, revealed: false
  });
  assert.equal('position' in projection.markers[0], false);
  assert.equal('ratio' in projection.markers[0], false);
  assert.equal('label' in projection.markers[0], false);
});

test('projection reflects current target and reveal frontier without caching canonical state', () => {
  const observation = makeObservationPort();
  const timeline = createTransportTimeline(observation.port);

  observation.setSnapshot(frozenSnapshot('step-01', 'step-02', 'step-01'));
  let projection = timeline.project();
  assert.equal(projection.currentStepId, 'step-01');
  assert.equal(projection.targetStepId, 'step-02');
  assert.equal(projection.markers[1].current, true);
  assert.equal(projection.markers[2].target, true);
  assert.equal(projection.markers[2].revealed, false);

  observation.setSnapshot(frozenSnapshot('step-02', null, 'step-02'));
  projection = timeline.project();
  assert.equal(projection.markers[1].current, false);
  assert.equal(projection.markers[2].current, true);
  assert.equal(projection.markers[2].target, false);
  assert.equal(projection.markers[2].revealed, true);
});

test('backward position preserves high-water reveal state in the timeline projection', () => {
  const { port } = makeObservationPort({ snapshot: frozenSnapshot('step-01', null, 'step-03') });
  const projection = createTransportTimeline(port).project();

  assert.equal(projection.currentStepId, 'step-01');
  assert.equal(projection.revealFrontier, 'step-03');
  assert.deepEqual(projection.markers.map((marker) => marker.revealed), [true, true, true, true]);
  assert.deepEqual(projection.markers.map((marker) => marker.current), [false, true, false, false]);
});

test('restart-shaped observation returns the projection to initial frontier without changing boundary order', () => {
  const observation = makeObservationPort({ snapshot: frozenSnapshot('step-03', null, 'step-03') });
  const timeline = createTransportTimeline(observation.port);
  const boundaryIds = timeline.boundaryIds();

  observation.setSnapshot(frozenSnapshot('initial', null, 'initial'));
  const projection = timeline.project();
  assert.equal(timeline.boundaryIds(), boundaryIds);
  assert.deepEqual(boundaryIds, ['initial', 'step-01', 'step-02', 'step-03']);
  assert.deepEqual(projection.markers.map((marker) => marker.revealed), [true, false, false, false]);
});

test('timeline fails closed on malformed boundary order and unknown canonical boundary identities', async (t) => {
  await t.test('initial is required first', () => {
    const { port } = makeObservationPort({ boundaryIds: Object.freeze(['step-01']) });
    assert.throws(() => createTransportTimeline(port), /begin with initial/);
  });

  await t.test('duplicate IDs fail', () => {
    const { port } = makeObservationPort({ boundaryIds: Object.freeze(['initial', 'step-01', 'step-01']) });
    assert.throws(() => createTransportTimeline(port), /duplicated/);
  });

  for (const [label, snapshot] of [
    ['current', frozenSnapshot('missing', null, 'initial')],
    ['target', frozenSnapshot('initial', 'missing', 'initial')],
    ['frontier', frozenSnapshot('initial', null, 'missing')]
  ]) {
    await t.test(`unknown ${label}`, () => {
      const { port } = makeObservationPort({ snapshot });
      const timeline = createTransportTimeline(port);
      assert.throws(() => timeline.project(), /known semantic boundary/);
    });
  }
});

test('timeline exposes observation only and carries no command, event, disposal, or raw Runtime surface', () => {
  const { port } = makeObservationPort();
  const timeline = createTransportTimeline(port);

  assert.deepEqual(Object.keys(timeline), TRANSPORT_TIMELINE_KEYS);
  for (const forbidden of ['play', 'pause', 'seek', 'restart', 'events', 'dispose', 'snapshot', 'read']) {
    assert.equal(forbidden in timeline, false);
  }
});
