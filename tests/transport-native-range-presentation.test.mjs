import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRANSPORT_INITIAL_ANCHOR_LABEL_KEYS,
  TRANSPORT_MARKER_LABEL_KEYS,
  TRANSPORT_NATIVE_RANGE_KEYS,
  TRANSPORT_RANGE_PRESENTATION_KEYS,
  TRANSPORT_RANGE_STATE_KEYS,
  createTransportNativeRangePresentation
} from '../src/transport/native-range-presentation.mjs';

function frozenStep(stepId, label, marker = null) {
  return Object.freeze({ stepId, label, marker });
}

function makeHarness({
  displayStepId = 'initial',
  displayIndex = 0,
  displayRatio = 0,
  active = false,
  ariaLabel = 'Experience position',
  steps = Object.freeze([
    frozenStep('step-01', 'Change to B', 'B'),
    frozenStep('step-02', 'Observe B'),
    frozenStep('step-03', 'Change to C', 'C')
  ])
} = {}) {
  const boundaryIds = Object.freeze(['initial', 'step-01', 'step-02', 'step-03']);
  let state = Object.freeze({ active, displayStepId, displayIndex, displayRatio });
  const scrubObservation = Object.freeze({
    read() {
      return state;
    }
  });
  const presentation = createTransportNativeRangePresentation({
    boundaryIds,
    scrubObservation,
    steps,
    ariaLabel
  });
  return {
    boundaryIds,
    steps,
    scrubObservation,
    presentation,
    setState(next) {
      state = Object.freeze(next);
    }
  };
}

test('native range presentation surface and projected records are exact and frozen', () => {
  const { presentation } = makeHarness();
  const state = presentation.read();

  assert.deepEqual(Object.keys(presentation), TRANSPORT_RANGE_PRESENTATION_KEYS);
  assert.equal(Object.isFrozen(presentation), true);
  assert.deepEqual(Object.keys(state), TRANSPORT_RANGE_STATE_KEYS);
  assert.equal(Object.isFrozen(state), true);
  assert.deepEqual(Object.keys(state.range), TRANSPORT_NATIVE_RANGE_KEYS);
  assert.equal(Object.isFrozen(state.range), true);
  assert.deepEqual(Object.keys(state.initialAnchor), TRANSPORT_INITIAL_ANCHOR_LABEL_KEYS);
  assert.equal(Object.isFrozen(state.initialAnchor), true);
  assert.equal(Object.isFrozen(state.markers), true);
  for (const marker of state.markers) {
    assert.deepEqual(Object.keys(marker), TRANSPORT_MARKER_LABEL_KEYS);
    assert.equal(Object.isFrozen(marker), true);
  }
});

test('native range geometry uses the one canonical boundary ordinal', () => {
  const { presentation } = makeHarness({ displayStepId: 'step-02', displayIndex: 2, displayRatio: 2 / 3 });
  const { range } = presentation.read();

  assert.deepEqual(range, {
    min: 0,
    max: 3,
    step: 1,
    value: 2,
    ariaLabel: 'Experience position',
    ariaValueText: 'Observe B, position 3 of 4'
  });
});

test('initial remains a separate Start anchor and is never emitted as an authored marker', () => {
  const { presentation } = makeHarness();
  const state = presentation.read();

  assert.deepEqual(state.initialAnchor, {
    stepId: 'initial',
    index: 0,
    visualLabel: 'Start',
    accessibleLabel: 'Start'
  });
  assert.equal(state.markers.some((marker) => marker.stepId === 'initial'), false);
  assert.equal(state.range.value, 0);
  assert.equal(state.range.ariaValueText, 'Start, position 1 of 4');
});

test('marker uses authored marker text visually and required label accessibly', () => {
  const { presentation } = makeHarness();
  const state = presentation.read();

  assert.deepEqual(state.markers[0], {
    stepId: 'step-01',
    index: 1,
    visualLabel: 'B',
    accessibleLabel: 'Change to B'
  });
});

test('missing authored marker falls back to the required learner-facing label', () => {
  const { presentation } = makeHarness();
  const state = presentation.read();

  assert.deepEqual(state.markers[1], {
    stepId: 'step-02',
    index: 2,
    visualLabel: 'Observe B',
    accessibleLabel: 'Observe B'
  });
});

test('range presentation follows fresh scrub display state including local preview', () => {
  const harness = makeHarness();

  assert.equal(harness.presentation.read().range.value, 0);

  harness.setState(Object.freeze({
    active: true,
    displayStepId: 'step-03',
    displayIndex: 3,
    displayRatio: 1
  }));

  const preview = harness.presentation.read();
  assert.equal(preview.range.value, 3);
  assert.equal(preview.range.ariaValueText, 'Change to C, position 4 of 4');

  harness.setState(Object.freeze({
    active: false,
    displayStepId: 'step-01',
    displayIndex: 1,
    displayRatio: 1 / 3
  }));

  const canonical = harness.presentation.read();
  assert.equal(canonical.range.value, 1);
  assert.equal(canonical.range.ariaValueText, 'Change to B, position 2 of 4');
});

test('range output carries native range properties rather than a custom ARIA slider role or redundant ARIA limits', () => {
  const { range } = makeHarness().presentation.read();

  assert.equal('role' in range, false);
  assert.equal('tabIndex' in range, false);
  assert.equal('ariaValueMin' in range, false);
  assert.equal('ariaValueMax' in range, false);
  assert.equal('ariaValueNow' in range, false);
});

test('authored metadata must align exactly with canonical boundary order', async (t) => {
  const boundaryIds = Object.freeze(['initial', 'step-01', 'step-02']);
  const scrubObservation = Object.freeze({
    read() {
      return Object.freeze({ active: false, displayStepId: 'initial', displayIndex: 0, displayRatio: 0 });
    }
  });

  await t.test('wrong count', () => {
    assert.throws(
      () => createTransportNativeRangePresentation({
        boundaryIds,
        scrubObservation,
        steps: Object.freeze([frozenStep('step-01', 'One')]),
        ariaLabel: 'Position'
      }),
      /exactly one record per authored boundary/
    );
  });

  await t.test('wrong order', () => {
    assert.throws(
      () => createTransportNativeRangePresentation({
        boundaryIds,
        scrubObservation,
        steps: Object.freeze([
          frozenStep('step-02', 'Two'),
          frozenStep('step-01', 'One')
        ]),
        ariaLabel: 'Position'
      }),
      /must match canonical boundary order/
    );
  });
});

test('step metadata is exact frozen data with required label and nullable marker', async (t) => {
  const boundaryIds = Object.freeze(['initial', 'step-01']);
  const scrubObservation = Object.freeze({
    read() {
      return Object.freeze({ active: false, displayStepId: 'initial', displayIndex: 0, displayRatio: 0 });
    }
  });

  const cases = [
    ['mutable record', Object.freeze([{ stepId: 'step-01', label: 'One', marker: null }]), /must be frozen/],
    ['extra field', Object.freeze([Object.freeze({ stepId: 'step-01', label: 'One', marker: null, extra: true })]), /must contain exactly/],
    ['blank label', Object.freeze([frozenStep('step-01', '   ')]), /label must be a non-empty string/],
    ['blank marker', Object.freeze([frozenStep('step-01', 'One', '  ')]), /marker must be a non-empty string/]
  ];

  for (const [name, steps, expected] of cases) {
    await t.test(name, () => {
      assert.throws(
        () => createTransportNativeRangePresentation({ boundaryIds, scrubObservation, steps, ariaLabel: 'Position' }),
        expected
      );
    });
  }
});

test('scrub observation is narrowed to exact frozen read capability', () => {
  const boundaryIds = Object.freeze(['initial', 'step-01']);
  const steps = Object.freeze([frozenStep('step-01', 'One')]);
  const state = Object.freeze({ active: false, displayStepId: 'initial', displayIndex: 0, displayRatio: 0 });

  assert.throws(
    () => createTransportNativeRangePresentation({
      boundaryIds,
      scrubObservation: Object.freeze({ read: () => state, commit: () => null }),
      steps,
      ariaLabel: 'Position'
    }),
    /must contain exactly: read/
  );

  assert.throws(
    () => createTransportNativeRangePresentation({
      boundaryIds,
      scrubObservation: { read: () => state },
      steps,
      ariaLabel: 'Position'
    }),
    /must be frozen/
  );
});

test('malformed scrub display identity or ordinal fails closed', async (t) => {
  const harness = makeHarness();

  const cases = [
    [
      'unknown identity',
      Object.freeze({ active: false, displayStepId: 'step-99', displayIndex: 1, displayRatio: 1 / 3 }),
      /identity must match/
    ],
    [
      'negative ordinal',
      Object.freeze({ active: false, displayStepId: 'initial', displayIndex: -1, displayRatio: 0 }),
      /valid boundary ordinal/
    ],
    [
      'out of range ordinal',
      Object.freeze({ active: false, displayStepId: 'step-03', displayIndex: 4, displayRatio: 1 }),
      /valid boundary ordinal/
    ]
  ];

  for (const [name, state, expected] of cases) {
    await t.test(name, () => {
      harness.setState(state);
      assert.throws(() => harness.presentation.read(), expected);
    });
  }
});

test('accessible rail label is required and preserved without deriving it from technical IDs', () => {
  const presentation = makeHarness({ ariaLabel: 'Git history position' }).presentation;
  assert.equal(presentation.read().range.ariaLabel, 'Git history position');

  assert.throws(() => makeHarness({ ariaLabel: '   ' }), /ariaLabel must be a non-empty string/);
});
