import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRANSPORT_NATIVE_RANGE_BINDING_KEYS,
  createTransportNativeRangeBinding
} from '../src/transport/native-range-binding.mjs';

function frozenRange({
  min = 0,
  max = 3,
  step = 1,
  value = 0,
  ariaLabel = 'Experience position',
  ariaValueText = 'Start, position 1 of 4'
} = {}) {
  return Object.freeze({ min, max, step, value, ariaLabel, ariaValueText });
}

function frozenState(range = frozenRange()) {
  return Object.freeze({
    range,
    initialAnchor: Object.freeze({
      stepId: 'initial',
      index: 0,
      visualLabel: 'Start',
      accessibleLabel: 'Start'
    }),
    markers: Object.freeze([])
  });
}

function makePresentation(initialState = frozenState()) {
  let state = initialState;
  return {
    presentation: Object.freeze({
      read() {
        return state;
      }
    }),
    setState(next) {
      state = next;
    }
  };
}

function makeControl({
  tagName = 'INPUT',
  type = 'range',
  min = '9',
  max = '99',
  step = '9',
  value = '9',
  attributes = {}
} = {}) {
  const attrs = new Map(Object.entries(attributes));
  const listenerCalls = [];
  const attributeWrites = [];
  let failAttribute = null;

  const control = {
    tagName,
    type,
    min,
    max,
    step,
    value,
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, nextValue) {
      attributeWrites.push(['set', name, String(nextValue)]);
      if (name === failAttribute) {
        failAttribute = null;
        throw new Error(`blocked attribute ${name}`);
      }
      attrs.set(name, String(nextValue));
    },
    removeAttribute(name) {
      attributeWrites.push(['remove', name]);
      attrs.delete(name);
    },
    addEventListener(...args) {
      listenerCalls.push(['add', ...args]);
    },
    removeEventListener(...args) {
      listenerCalls.push(['remove', ...args]);
    }
  };

  return {
    control,
    listenerCalls,
    attributeWrites,
    attribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setFailAttribute(name) {
      failAttribute = name;
    }
  };
}

test('native range binding surface is exact frozen and construction applies the current projection', () => {
  const { presentation } = makePresentation(frozenState(frozenRange({
    value: 2,
    ariaValueText: 'Observe B, position 3 of 4'
  })));
  const harness = makeControl();

  const binding = createTransportNativeRangeBinding({ control: harness.control, presentation });

  assert.deepEqual(Object.keys(binding), TRANSPORT_NATIVE_RANGE_BINDING_KEYS);
  assert.equal(Object.isFrozen(binding), true);
  assert.deepEqual(
    [harness.control.min, harness.control.max, harness.control.step, harness.control.value],
    ['0', '3', '1', '2']
  );
  assert.equal(harness.attribute('aria-label'), 'Experience position');
  assert.equal(harness.attribute('aria-valuetext'), 'Observe B, position 3 of 4');
});

test('refresh follows fresh checkpoint 7 range projection without caching prior state', () => {
  const source = makePresentation();
  const harness = makeControl();
  const binding = createTransportNativeRangeBinding({ control: harness.control, presentation: source.presentation });

  source.setState(frozenState(frozenRange({
    value: 3,
    ariaValueText: 'Change to C, position 4 of 4'
  })));
  binding.refresh();

  assert.equal(harness.control.value, '3');
  assert.equal(harness.attribute('aria-valuetext'), 'Change to C, position 4 of 4');
});

test('binding mutates only native range properties and semantic naming attributes', () => {
  const { presentation } = makePresentation();
  const harness = makeControl({
    attributes: {
      role: 'presentation',
      tabindex: '7',
      'aria-valuemin': 'old-min',
      'aria-valuemax': 'old-max',
      'aria-valuenow': 'old-now',
      'data-owner': 'host'
    }
  });

  createTransportNativeRangeBinding({ control: harness.control, presentation });

  assert.equal(harness.attribute('role'), 'presentation');
  assert.equal(harness.attribute('tabindex'), '7');
  assert.equal(harness.attribute('aria-valuemin'), 'old-min');
  assert.equal(harness.attribute('aria-valuemax'), 'old-max');
  assert.equal(harness.attribute('aria-valuenow'), 'old-now');
  assert.equal(harness.attribute('data-owner'), 'host');
});

test('checkpoint 8 installs no interaction listeners and therefore acquires no gesture authority', () => {
  const { presentation } = makePresentation();
  const harness = makeControl();

  createTransportNativeRangeBinding({ control: harness.control, presentation });

  assert.deepEqual(harness.listenerCalls, []);
});

test('native control identity is restricted to input type range', async (t) => {
  const { presentation } = makePresentation();

  await t.test('non-input element', () => {
    const { control } = makeControl({ tagName: 'DIV' });
    assert.throws(
      () => createTransportNativeRangeBinding({ control, presentation }),
      /must identify an input with type range/
    );
  });

  await t.test('input with wrong type', () => {
    const { control } = makeControl({ type: 'text' });
    assert.throws(
      () => createTransportNativeRangeBinding({ control, presentation }),
      /must identify an input with type range/
    );
  });

  await t.test('missing attribute capability', () => {
    const { control } = makeControl();
    control.removeAttribute = null;
    assert.throws(
      () => createTransportNativeRangeBinding({ control, presentation }),
      /removeAttribute must be a function/
    );
  });
});

test('presentation capability remains the exact frozen checkpoint 7 read surface', () => {
  const harness = makeControl();
  const state = frozenState();

  assert.throws(
    () => createTransportNativeRangeBinding({
      control: harness.control,
      presentation: Object.freeze({ read: () => state, commit: () => null })
    }),
    /must contain exactly: read/
  );

  assert.throws(
    () => createTransportNativeRangeBinding({
      control: harness.control,
      presentation: { read: () => state }
    }),
    /must be frozen/
  );
});

test('malformed or widened presentation state fails before any DOM write', async (t) => {
  const cases = [
    [
      'mutable state',
      { range: frozenRange(), initialAnchor: Object.freeze({}), markers: Object.freeze([]) },
      /state must be frozen/
    ],
    [
      'extra state field',
      Object.freeze({ ...frozenState(), extra: true }),
      /state must contain exactly/
    ],
    [
      'extra range field',
      Object.freeze({
        ...frozenState(),
        range: Object.freeze({ ...frozenRange(), role: 'slider' })
      }),
      /range state must contain exactly/
    ],
    [
      'invalid ordinal',
      frozenState(frozenRange({ value: 4 })),
      /valid semantic boundary ordinal/
    ],
    [
      'invalid step',
      frozenState(frozenRange({ step: 0.5 })),
      /state.step must be 1/
    ]
  ];

  for (const [name, state, expected] of cases) {
    await t.test(name, () => {
      const harness = makeControl();
      const before = {
        min: harness.control.min,
        max: harness.control.max,
        step: harness.control.step,
        value: harness.control.value,
        writes: harness.attributeWrites.length
      };
      const presentation = Object.freeze({ read: () => state });

      assert.throws(
        () => createTransportNativeRangeBinding({ control: harness.control, presentation }),
        expected
      );
      assert.deepEqual(
        {
          min: harness.control.min,
          max: harness.control.max,
          step: harness.control.step,
          value: harness.control.value,
          writes: harness.attributeWrites.length
        },
        before
      );
    });
  }
});

test('presentation read failure propagates without mutating the native control', () => {
  const harness = makeControl();
  const presentation = Object.freeze({
    read() {
      throw new Error('projection unavailable');
    }
  });

  const before = [harness.control.min, harness.control.max, harness.control.step, harness.control.value];
  assert.throws(
    () => createTransportNativeRangeBinding({ control: harness.control, presentation }),
    /projection unavailable/
  );
  assert.deepEqual(
    [harness.control.min, harness.control.max, harness.control.step, harness.control.value],
    before
  );
  assert.equal(harness.attributeWrites.length, 0);
});

test('a failed DOM write rolls back all checkpoint 8 owned fields', () => {
  const source = makePresentation();
  const harness = makeControl({
    min: '0',
    max: '3',
    step: '1',
    value: '0',
    attributes: {
      'aria-label': 'Experience position',
      'aria-valuetext': 'Start, position 1 of 4'
    }
  });
  const binding = createTransportNativeRangeBinding({ control: harness.control, presentation: source.presentation });

  source.setState(frozenState(frozenRange({
    value: 2,
    ariaValueText: 'Observe B, position 3 of 4'
  })));
  harness.setFailAttribute('aria-label');

  assert.throws(() => binding.refresh(), /blocked attribute aria-label/);
  assert.deepEqual(
    [harness.control.min, harness.control.max, harness.control.step, harness.control.value],
    ['0', '3', '1', '0']
  );
  assert.equal(harness.attribute('aria-label'), 'Experience position');
  assert.equal(harness.attribute('aria-valuetext'), 'Start, position 1 of 4');
});

test('binding option shape rejects extra keys and accessor-backed capabilities without invocation', () => {
  const { presentation } = makePresentation();
  const harness = makeControl();

  assert.throws(
    () => createTransportNativeRangeBinding({
      control: harness.control,
      presentation,
      gesture: Object.freeze({})
    }),
    /must contain exactly: control, presentation/
  );

  let invoked = false;
  const options = { presentation };
  Object.defineProperty(options, 'control', {
    enumerable: true,
    get() {
      invoked = true;
      return harness.control;
    }
  });

  assert.throws(
    () => createTransportNativeRangeBinding(options),
    /options.control must be an enumerable data property/
  );
  assert.equal(invoked, false);
});
