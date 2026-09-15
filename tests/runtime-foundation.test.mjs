import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_COMPONENT,
  EVENT_NAME,
  EVENT_RESULT,
  EVENT_SCHEMA
} from '../src/contracts/events.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';
import { createRuntimeCorrelation } from '../src/runtime/correlation.mjs';
import { createRuntimeEventStream } from '../src/runtime/event-stream.mjs';

function experienceFixture(id = 'runtime-fixture') {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id,
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
      },
      {
        id: 'step-02',
        label: 'Two',
        commentary: { text: 'Two', links: [] },
        state: { node: 'B' }
      }
    ]
  });
}

function controllableClock(start = 0) {
  let now = start;
  return {
    clock: Object.freeze({ now: () => now }),
    set(value) {
      now = value;
    }
  };
}

test('CiMInstance composes frozen public identity, read, and event observation surfaces', () => {
  const { clock } = controllableClock();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture(),
    clock
  });

  assert.equal(Object.isFrozen(instance), true);
  assert.deepEqual(Object.keys(instance), ['identity', 'read', 'events']);
  assert.deepEqual(instance.identity, {
    instanceId: 'instance-01',
    experienceId: 'runtime-fixture',
    experienceVersion: '1.0.0'
  });
  assert.equal(Object.isFrozen(instance.identity), true);
  assert.equal(Object.isFrozen(instance.read), true);
  assert.equal(Object.isFrozen(instance.events), true);
  assert.equal('controls' in instance, false);
  assert.equal('semanticControl' in instance, false);
  assert.equal('faultControl' in instance, false);
  assert.equal('statusControl' in instance, false);
});

test('CiMInstance initial snapshot separates Core canonical state from Runtime operational state', () => {
  const { clock } = controllableClock();
  const instance = createCiMInstance({
    instanceId: 'instance-01',
    experience: experienceFixture(),
    clock
  });

  const snapshot = instance.read.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.canonical), true);
  assert.equal(Object.isFrozen(snapshot.operational), true);
  assert.deepEqual(snapshot.canonical, {
    instanceId: 'instance-01',
    experienceId: 'runtime-fixture',
    experienceVersion: '1.0.0',
    status: 'idle',
    currentStepId: 'initial',
    targetStepId: null,
    revealFrontier: 'initial',
    error: null
  });
  assert.deepEqual(snapshot.operational, {
    playbackIntent: false,
    transitionId: null,
    transitionPhase: 'idle',
    dwellRemainingMs: 0,
    activeAbortState: null
  });

  const boundaryIds = instance.read.boundaryIds();
  assert.deepEqual(boundaryIds, ['initial', 'step-01', 'step-02']);
  assert.equal(Object.isFrozen(boundaryIds), true);
  assert.equal(instance.read.boundaryIds(), boundaryIds);
});

test('CiMInstance requires inert validated experience data and does not invoke accessors', () => {
  const { clock } = controllableClock();
  let invoked = 0;
  const experience = {
    id: 'bad',
    experience_version: '1.0.0',
    steps: []
  };
  Object.defineProperty(experience, 'schema', {
    enumerable: true,
    get() {
      invoked += 1;
      return 'localis.cim/v1';
    }
  });
  Object.freeze(experience);

  assert.throws(() => createCiMInstance({
    instanceId: 'instance-01',
    experience,
    clock
  }), /enumerable data property/);
  assert.equal(invoked, 0);
});

test('createCiMInstance option accessors are rejected without invocation', () => {
  const { clock } = controllableClock();
  let invoked = 0;
  const options = {
    experience: experienceFixture(),
    clock
  };
  Object.defineProperty(options, 'instanceId', {
    enumerable: true,
    get() {
      invoked += 1;
      return 'instance-01';
    }
  });

  assert.throws(() => createCiMInstance(options), /enumerable data property/);
  assert.equal(invoked, 0);
});

test('Runtime correlation identities are deterministic, independent, and instance-scoped by construction', () => {
  const first = createRuntimeCorrelation();
  const second = createRuntimeCorrelation();

  assert.equal(first.nextCommandId(), 'cmd-1');
  assert.equal(first.nextCommandId(), 'cmd-2');
  assert.equal(first.nextTransitionId(), 'txn-1');
  assert.deepEqual(first.snapshot(), { commandSequence: 2, transitionSequence: 1 });
  assert.equal(Object.isFrozen(first.snapshot()), true);

  assert.equal(second.nextCommandId(), 'cmd-1');
  assert.equal(second.nextTransitionId(), 'txn-1');
});

test('Runtime event stream supplies monotonic per-instance sequence and virtual-clock timestamps', () => {
  const time = controllableClock(10);
  const stream = createRuntimeEventStream({ instanceId: 'instance-01', clock: time.clock });
  const seen = [];
  stream.observe.subscribe((event) => seen.push(event));

  const first = stream.control.emit({
    component: EVENT_COMPONENT.RUNTIME,
    event: EVENT_NAME.COMMAND_ACCEPTED,
    result: EVENT_RESULT.SUCCESS,
    command_id: 'cmd-1',
    details: { command: 'next', source: 'transport' }
  });

  time.set(10);
  const second = stream.control.emit({
    component: EVENT_COMPONENT.RUNTIME,
    event: EVENT_NAME.TRANSITION_STARTED,
    result: EVENT_RESULT.SUCCESS,
    command_id: 'cmd-1',
    transition_id: 'txn-1',
    from_step: 'initial',
    to_step: 'step-01'
  });

  assert.equal(first.schema, EVENT_SCHEMA);
  assert.equal(first.instance_id, 'instance-01');
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(first.timestamp_ms, 10);
  assert.equal(second.timestamp_ms, 10);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.details), true);
  assert.deepEqual(seen, [first, second]);
});

test('Runtime event subscribers cannot break production emission and unsubscribe is scoped', () => {
  const { clock } = controllableClock();
  const stream = createRuntimeEventStream({ instanceId: 'instance-01', clock });
  const seen = [];

  stream.observe.subscribe(() => {
    throw new Error('observer failed');
  });
  const unsubscribe = stream.observe.subscribe((event) => seen.push(event));

  assert.doesNotThrow(() => stream.control.emit({
    component: EVENT_COMPONENT.RUNTIME,
    event: EVENT_NAME.COMMAND_RECEIVED,
    result: EVENT_RESULT.SUCCESS
  }));
  assert.equal(seen.length, 1);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);

  stream.control.emit({
    component: EVENT_COMPONENT.RUNTIME,
    event: EVENT_NAME.COMMAND_RECEIVED,
    result: EVENT_RESULT.SUCCESS
  });
  assert.equal(seen.length, 1);
});

test('Runtime event input is descriptor-safe and event details are copied before publication', () => {
  const { clock } = controllableClock();
  const stream = createRuntimeEventStream({ instanceId: 'instance-01', clock });
  let invoked = 0;
  const bad = {
    component: EVENT_COMPONENT.RUNTIME,
    result: EVENT_RESULT.SUCCESS
  };
  Object.defineProperty(bad, 'event', {
    enumerable: true,
    get() {
      invoked += 1;
      return EVENT_NAME.COMMAND_ACCEPTED;
    }
  });

  assert.throws(() => stream.control.emit(bad), /enumerable data property/);
  assert.equal(invoked, 0);

  const details = { command: 'next', nested: { source: 'transport' } };
  const record = stream.control.emit({
    component: EVENT_COMPONENT.RUNTIME,
    event: EVENT_NAME.COMMAND_ACCEPTED,
    result: EVENT_RESULT.SUCCESS,
    details
  });
  details.command = 'previous';
  details.nested.source = 'host';

  assert.deepEqual(record.details, {
    command: 'next',
    nested: { source: 'transport' }
  });
  assert.equal(Object.isFrozen(record.details.nested), true);
});
