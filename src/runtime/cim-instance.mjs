import { createRuntimeCoreSession } from './core-session.mjs';
import { createRuntimeCorrelation } from './correlation.mjs';
import { createRuntimeEventStream } from './event-stream.mjs';

const RUNTIME_OPERATIONAL_KEYS = Object.freeze([
  'playbackIntent',
  'transitionId',
  'transitionProgress',
  'dwellRemainingMs',
  'activeAbortState'
]);

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readDataProperty(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property.`);
  }
  return descriptor.value;
}

function readExperienceEnvelope(experience) {
  if (!isPlainObject(experience) || !Object.isFrozen(experience)) {
    fail('CiMInstance experience must be a frozen validated plain object.');
  }

  const schema = readDataProperty(experience, 'schema', 'experience');
  const experienceId = readDataProperty(experience, 'id', 'experience');
  const experienceVersion = readDataProperty(experience, 'experience_version', 'experience');
  const steps = readDataProperty(experience, 'steps', 'experience');

  if (schema !== 'localis.cim/v1') fail('CiMInstance requires localis.cim/v1 experience data.');
  if (typeof experienceId !== 'string' || experienceId.length === 0) fail('experience.id must be a non-empty string.');
  if (typeof experienceVersion !== 'string' || experienceVersion.length === 0) fail('experience.experience_version must be a non-empty string.');
  if (!Array.isArray(steps) || !Object.isFrozen(steps) || steps.length === 0) {
    fail('experience.steps must be a frozen non-empty array.');
  }

  const stepIds = [];
  for (let index = 0; index < steps.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(steps, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`experience.steps[${index}] must be an enumerable data property.`);
    }
    const step = descriptor.value;
    if (!isPlainObject(step) || !Object.isFrozen(step)) {
      fail(`experience.steps[${index}] must be a frozen validated plain object.`);
    }
    const stepId = readDataProperty(step, 'id', `experience.steps[${index}]`);
    if (typeof stepId !== 'string' || stepId.length === 0) {
      fail(`experience.steps[${index}].id must be a non-empty string.`);
    }
    stepIds.push(stepId);
  }

  return Object.freeze({
    experienceId,
    experienceVersion,
    stepIds: Object.freeze(stepIds)
  });
}

function assertClock(clock) {
  if (!clock || typeof clock !== 'object' || typeof clock.now !== 'function') {
    fail('CiMInstance clock must expose now().');
  }
}

function createOperationalState() {
  const state = {
    playbackIntent: false,
    transitionId: null,
    transitionProgress: 0,
    dwellRemainingMs: 0,
    activeAbortState: null
  };

  const read = Object.freeze({
    snapshot() {
      const snapshot = {};
      for (const key of RUNTIME_OPERATIONAL_KEYS) snapshot[key] = state[key];
      return Object.freeze(snapshot);
    }
  });

  return { state, read };
}

class CiMInstance {
  #controls;
  #session;
  #experience;
  #correlation;
  #eventControl;
  #operational;

  constructor({ instanceId, experience, clock }) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      fail('CiMInstance instanceId must be a non-empty string.');
    }
    assertClock(clock);

    const envelope = readExperienceEnvelope(experience);
    const core = createRuntimeCoreSession({
      instanceId,
      experienceId: envelope.experienceId,
      experienceVersion: envelope.experienceVersion,
      stepIds: envelope.stepIds
    });
    const operational = createOperationalState();
    const correlation = createRuntimeCorrelation();
    const eventStream = createRuntimeEventStream({ instanceId, clock });

    this.#controls = core.controls;
    this.#session = core.session;
    this.#experience = experience;
    this.#correlation = correlation;
    this.#eventControl = eventStream.control;
    this.#operational = operational.state;

    this.identity = Object.freeze({
      instanceId,
      experienceId: envelope.experienceId,
      experienceVersion: envelope.experienceVersion
    });

    this.read = Object.freeze({
      snapshot: () => Object.freeze({
        canonical: this.#session.read.snapshot(),
        operational: operational.read.snapshot()
      }),
      boundaryIds: () => this.#session.read.boundaryIds()
    });

    this.events = eventStream.observe;

    Object.freeze(this);
  }
}

export function createCiMInstance(options) {
  if (!isPlainObject(options)) fail('createCiMInstance options must be a plain object.');

  const descriptors = Object.getOwnPropertyDescriptors(options);
  for (const key of ['instanceId', 'experience', 'clock']) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`createCiMInstance options.${key} must be an enumerable data property.`);
    }
  }

  return new CiMInstance({
    instanceId: descriptors.instanceId.value,
    experience: descriptors.experience.value,
    clock: descriptors.clock.value
  });
}
