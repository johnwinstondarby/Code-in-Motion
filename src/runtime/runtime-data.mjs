import {
  INITIAL_BOUNDARY_ID
} from '../contracts/session.mjs';
import {
  COMMAND_SOURCE_VALUES
} from '../contracts/events.mjs';

const RUNTIME_OPERATIONAL_KEYS = Object.freeze([
  'playbackIntent',
  'transitionId',
  'transitionProgress',
  'dwellRemainingMs',
  'activeAbortState'
]);

const COMMAND_SOURCE_SET = new Set(COMMAND_SOURCE_VALUES);

export function fail(message) {
  throw new TypeError(message);
}

export function isPlainObject(value) {
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

function readOptionalDataProperty(object, key, label, fallback = undefined) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return fallback;
  if (!descriptor.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property when present.`);
  }
  return descriptor.value;
}

export function readExperienceEnvelope(experience) {
  if (!isPlainObject(experience) || !Object.isFrozen(experience)) {
    fail('CiMInstance experience must be a frozen validated plain object.');
  }

  const schema = readDataProperty(experience, 'schema', 'experience');
  const experienceId = readDataProperty(experience, 'id', 'experience');
  const experienceVersion = readDataProperty(experience, 'experience_version', 'experience');
  const initialState = readDataProperty(experience, 'initial_state', 'experience');
  const steps = readDataProperty(experience, 'steps', 'experience');
  const rendererConfig = readOptionalDataProperty(experience, 'renderer_config', 'experience', null);

  if (schema !== 'localis.cim/v1') fail('CiMInstance requires localis.cim/v1 experience data.');
  if (typeof experienceId !== 'string' || experienceId.length === 0) fail('experience.id must be a non-empty string.');
  if (typeof experienceVersion !== 'string' || experienceVersion.length === 0) fail('experience.experience_version must be a non-empty string.');
  if (initialState === null) fail('experience.initial_state must be non-null.');
  if (!Array.isArray(steps) || !Object.isFrozen(steps) || steps.length === 0) {
    fail('experience.steps must be a frozen non-empty array.');
  }

  const stepIds = [];
  const boundaries = new Map();
  boundaries.set(INITIAL_BOUNDARY_ID, Object.freeze({
    state: initialState,
    stepRendererConfig: null
  }));

  for (let index = 0; index < steps.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(steps, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`experience.steps[${index}] must be an enumerable data property.`);
    }
    const step = descriptor.value;
    if (!isPlainObject(step) || !Object.isFrozen(step)) {
      fail(`experience.steps[${index}] must be a frozen validated plain object.`);
    }

    const label = `experience.steps[${index}]`;
    const stepId = readDataProperty(step, 'id', label);
    const state = readDataProperty(step, 'state', label);
    const stepRendererConfig = readOptionalDataProperty(step, 'renderer_config', label, null);

    if (typeof stepId !== 'string' || stepId.length === 0) {
      fail(`${label}.id must be a non-empty string.`);
    }
    if (state === null) fail(`${label}.state must be non-null.`);

    stepIds.push(stepId);
    boundaries.set(stepId, Object.freeze({ state, stepRendererConfig }));
  }

  return {
    experienceId,
    experienceVersion,
    rendererConfig,
    stepIds: Object.freeze(stepIds),
    boundaries
  };
}

export function assertClock(clock) {
  if (!clock || typeof clock !== 'object' || typeof clock.now !== 'function') {
    fail('CiMInstance clock must expose now().');
  }
}

export function assertScheduler(scheduler) {
  if (!scheduler || typeof scheduler !== 'object') {
    fail('CiMInstance scheduler must be an object.');
  }
  for (const method of ['now', 'schedule', 'cancel', 'onFrame']) {
    if (typeof scheduler[method] !== 'function') {
      fail(`CiMInstance scheduler.${method} must be a function.`);
    }
  }
}

export function assertRenderer(renderer) {
  if (!renderer || typeof renderer !== 'object') {
    fail('CiMInstance renderer must be an object.');
  }
  for (const method of ['mount', 'render', 'dispose']) {
    if (typeof renderer[method] !== 'function') {
      fail(`CiMInstance renderer.${method} must be a function.`);
    }
  }
}

export function assertRendererRoot(rendererRoot) {
  if (!rendererRoot || typeof rendererRoot !== 'object') {
    fail('CiMInstance rendererRoot must be an object.');
  }
}

export function assertSource(source) {
  if (!COMMAND_SOURCE_SET.has(source)) {
    fail(`command source must be one of: ${COMMAND_SOURCE_VALUES.join(', ')}.`);
  }
  return source;
}

export function createOperationalState() {
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

export function commandOutcome({
  commandId,
  command,
  result,
  fromStepId,
  toStepId,
  reason = null,
  transitionId = null
}) {
  return Object.freeze({
    commandId,
    command,
    result,
    fromStepId,
    toStepId,
    reason,
    transitionId
  });
}

export function detailsForCommand(command, source, reason = null) {
  const details = { command, source };
  if (reason !== null) details.reason = reason;
  return details;
}
