import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS,
  TRANSPORT_VISUAL_MARKER_KEYS,
  TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS,
  TRANSPORT_VISUAL_RAIL_STATE_KEYS,
  createTransportVisualRailPresentation
} from '../src/transport/visual-rail-presentation.mjs';

const BOUNDARY_IDS = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);

function makeTimelineState({ current = 'step-02', target = 'step-03', frontier = 'step-02' } = {}) {
  const currentIndex = BOUNDARY_IDS.indexOf(current);
  const targetIndex = target === null ? -1 : BOUNDARY_IDS.indexOf(target);
  const revealIndex = BOUNDARY_IDS.indexOf(frontier);
  return Object.freeze({
    currentStepId: current,
    targetStepId: target,
    revealFrontier: frontier,
    initialAnchor: Object.freeze({
      stepId: 'initial',
      index: 0,
      current: currentIndex === 0,
      target: targetIndex === 0
    }),
    markers: Object.freeze(BOUNDARY_IDS.slice(1).map((stepId, offset) => {
      const index = offset + 1;
      return Object.freeze({
        stepId,
        index,
        current: currentIndex === index,
        target: targetIndex === index,
        revealed: index <= revealIndex
      });
    }))
  });
}

function makeRangeState(value = 2, overrides = {}) {
  const labels = [
    ['step-01', 'One', 'Step one'],
    ['step-02', 'Two', 'Step two'],
    ['step-03', 'Three', 'Step three']
  ];
  const base = {
    range: Object.freeze({
      min: 0,
      max: 3,
      step: 1,
      value,
      ariaLabel: 'Progress',
      ariaValueText: `Position ${value + 1} of 4`
    }),
    initialAnchor: Object.freeze({
      stepId: 'initial',
      index: 0,
      visualLabel: 'Start',
      accessibleLabel: 'Start'
    }),
    markers: Object.freeze(labels.map(([stepId, visualLabel, accessibleLabel], offset) => Object.freeze({
      stepId,
      index: offset + 1,
      visualLabel,
      accessibleLabel
    })))
  };
  return Object.freeze({ ...base, ...overrides });
}

function makeDependencies() {
  let timelineState = makeTimelineState();
  let rangeValue = 2;
  let rangeFactory = () => makeRangeState(rangeValue);

  const timeline = Object.freeze({
    boundaryIds() {
      return BOUNDARY_IDS;
    },
    project() {
      return timelineState;
    }
  });
  const rangePresentation = Object.freeze({
    read() {
      return rangeFactory();
    }
  });

  return {
    timeline,
    rangePresentation,
    setTimelineState(value) {
      timelineState = value;
    },
    setRangeValue(value) {
      rangeValue = value;
    },
    setRangeFactory(value) {
      rangeFactory = value;
    }
  };
}

test('visual rail presentation and returned records are exact and frozen', () => {
  const deps = makeDependencies();
  const presentation = createTransportVisualRailPresentation(deps);
  assert.deepEqual(Object.keys(presentation), TRANSPORT_VISUAL_RAIL_PRESENTATION_KEYS);
  assert.ok(Object.isFrozen(presentation));

  const state = presentation.read();
  assert.deepEqual(Object.keys(state), TRANSPORT_VISUAL_RAIL_STATE_KEYS);
  assert.ok(Object.isFrozen(state));
  assert.deepEqual(Object.keys(state.initialAnchor), TRANSPORT_VISUAL_INITIAL_ANCHOR_KEYS);
  assert.ok(Object.isFrozen(state.initialAnchor));
  assert.ok(Object.isFrozen(state.markers));
  for (const marker of state.markers) {
    assert.deepEqual(Object.keys(marker), TRANSPORT_VISUAL_MARKER_KEYS);
    assert.ok(Object.isFrozen(marker));
  }
});

test('visual rail keeps current target reveal and preview as separate presentation facts', () => {
  const deps = makeDependencies();
  const state = createTransportVisualRailPresentation(deps).read();

  assert.deepEqual(state.initialAnchor, {
    stepId: 'initial', index: 0, visualLabel: 'Start', accessibleLabel: 'Start',
    current: false, target: false, preview: false
  });
  assert.equal(state.markers[0].revealed, true);
  assert.equal(state.markers[1].current, true);
  assert.equal(state.markers[1].revealed, true);
  assert.equal(state.markers[1].preview, true);
  assert.equal(state.markers[2].target, true);
  assert.equal(state.markers[2].revealed, false);
  assert.equal(state.markers[2].preview, false);
});

test('local scrub preview may move without claiming canonical current state', () => {
  const deps = makeDependencies();
  deps.setRangeValue(3);
  deps.setTimelineState(makeTimelineState({ current: 'step-02', target: null, frontier: 'step-02' }));
  const state = createTransportVisualRailPresentation(deps).read();

  assert.equal(state.markers[1].current, true);
  assert.equal(state.markers[1].preview, false);
  assert.equal(state.markers[2].current, false);
  assert.equal(state.markers[2].preview, true);
  assert.equal(state.markers[2].revealed, false);
});

test('initial remains a separate visual anchor and may carry scrub preview', () => {
  const deps = makeDependencies();
  deps.setRangeValue(0);
  const state = createTransportVisualRailPresentation(deps).read();
  assert.equal(state.initialAnchor.preview, true);
  assert.equal(state.markers.some((marker) => marker.preview), false);
});

test('each visual read follows fresh semantic and scrub presentation state', () => {
  const deps = makeDependencies();
  const presentation = createTransportVisualRailPresentation(deps);
  const first = presentation.read();
  assert.equal(first.markers[1].current, true);
  assert.equal(first.markers[1].preview, true);

  deps.setTimelineState(makeTimelineState({ current: 'step-03', target: null, frontier: 'step-03' }));
  deps.setRangeValue(3);
  const second = presentation.read();
  assert.equal(second.markers[2].current, true);
  assert.equal(second.markers[2].preview, true);
  assert.equal(second.markers[2].revealed, true);
});

test('range labels and ordinals must align with canonical timeline order', () => {
  const deps = makeDependencies();
  deps.setRangeFactory(() => {
    const state = makeRangeState(2);
    const badMarkers = Object.freeze([
      Object.freeze({ stepId: 'step-02', index: 1, visualLabel: 'Two', accessibleLabel: 'Step two' }),
      state.markers[1],
      state.markers[2]
    ]);
    return Object.freeze({ ...state, markers: badMarkers });
  });
  const presentation = createTransportVisualRailPresentation(deps);
  assert.throws(() => presentation.read(), /canonical boundary order/);
});

test('construction rejects widened mutable or accessor-backed capability surfaces', () => {
  const deps = makeDependencies();
  assert.throws(() => createTransportVisualRailPresentation({
    timeline: { ...deps.timeline },
    rangePresentation: deps.rangePresentation
  }), /timeline must be frozen/);

  assert.throws(() => createTransportVisualRailPresentation({
    timeline: deps.timeline,
    rangePresentation: Object.freeze({ read: deps.rangePresentation.read, extra: () => null })
  }), /exactly/);

  let invoked = false;
  const accessorTimeline = {};
  Object.defineProperty(accessorTimeline, 'boundaryIds', {
    enumerable: true,
    get() {
      invoked = true;
      return () => BOUNDARY_IDS;
    }
  });
  Object.defineProperty(accessorTimeline, 'project', {
    enumerable: true,
    value: deps.timeline.project
  });
  Object.freeze(accessorTimeline);
  assert.throws(() => createTransportVisualRailPresentation({
    timeline: accessorTimeline,
    rangePresentation: deps.rangePresentation
  }), /enumerable data property/);
  assert.equal(invoked, false);
});

test('malformed timeline flags and native range geometry fail closed', () => {
  const deps = makeDependencies();
  const badTimeline = makeTimelineState();
  const badMarker = Object.freeze({ ...badTimeline.markers[0], current: 'yes' });
  deps.setTimelineState(Object.freeze({
    ...badTimeline,
    markers: Object.freeze([badMarker, ...badTimeline.markers.slice(1)])
  }));
  const presentation = createTransportVisualRailPresentation(deps);
  assert.throws(() => presentation.read(), /must be a boolean/);

  deps.setTimelineState(makeTimelineState());
  deps.setRangeFactory(() => {
    const state = makeRangeState(2);
    return Object.freeze({ ...state, range: Object.freeze({ ...state.range, max: 4 }) });
  });
  assert.throws(() => presentation.read(), /geometry/);
});

test('visual rail projection exposes presentation only and no command or Runtime authority', () => {
  const deps = makeDependencies();
  const presentation = createTransportVisualRailPresentation(deps);
  assert.equal('seek' in presentation, false);
  assert.equal('marker' in presentation, false);
  assert.equal('events' in presentation, false);
  assert.equal('dispose' in presentation, false);
  assert.equal('runtime' in presentation, false);
});
