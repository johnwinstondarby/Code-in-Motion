import {
  INITIAL_BOUNDARY_ID,
  SESSION_STATUS,
  SESSION_STATUS_VALUES
} from '../contracts/session.mjs';
import {
  FAULT_COMPONENT_VALUES,
  FAULT_RECOVERY_CLASS,
  FAULT_RECOVERY_CLASS_VALUES
} from '../contracts/faults.mjs';
import { createBoundaryModel } from './boundary-model.mjs';

const STATUS_SET = new Set(SESSION_STATUS_VALUES);
const FAULT_COMPONENT_SET = new Set(FAULT_COMPONENT_VALUES);
const FAULT_RECOVERY_SET = new Set(FAULT_RECOVERY_CLASS_VALUES);
const FAULT_CODE_PATTERN = /^CIM-(HST|EXP|CORE|RT|RND|COM|TRN|TEL)-\d{3}$/;
const FAULT_CODE_COMPONENT = Object.freeze({
  HST: 'host',
  EXP: 'experience',
  CORE: 'core',
  RT: 'runtime',
  RND: 'renderer',
  COM: 'commentary',
  TRN: 'transport',
  TEL: 'telemetry'
});

export class CoreStateTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CoreStateTransitionError';
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value;
}

function requireExactDataObject(input, expectedKeys, name) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${name} must be a plain object.`);
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${name} must be a plain object.`);
  }

  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key !== 'string')) {
    throw new TypeError(`${name} cannot contain symbol keys.`);
  }

  const actual = [...keys].sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${name} must expose exactly: ${expectedKeys.join(', ')}.`);
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError(`${name} property ${key} must be an enumerable data property.`);
    }
  }

  return descriptors;
}

function normalizeFaultRecord(input) {
  const descriptors = requireExactDataObject(
    input,
    ['code', 'component', 'recoveryClass'],
    'fault'
  );
  const code = requireNonEmptyString(descriptors.code.value, 'fault.code');
  const component = requireNonEmptyString(descriptors.component.value, 'fault.component');
  const recoveryClass = requireNonEmptyString(descriptors.recoveryClass.value, 'fault.recoveryClass');

  const codeMatch = FAULT_CODE_PATTERN.exec(code);
  if (!codeMatch) {
    throw new TypeError('fault.code must use a documented CIM component namespace and three-digit code.');
  }
  if (!FAULT_COMPONENT_SET.has(component)) {
    throw new TypeError(`fault.component must be one of: ${FAULT_COMPONENT_VALUES.join(', ')}.`);
  }
  const expectedComponent = FAULT_CODE_COMPONENT[codeMatch[1]];
  if (component !== expectedComponent) {
    throw new TypeError(`fault.component ${component} does not match code namespace ${codeMatch[1]}.`);
  }
  if (!FAULT_RECOVERY_SET.has(recoveryClass)) {
    throw new TypeError(`fault.recoveryClass must be one of: ${FAULT_RECOVERY_CLASS_VALUES.join(', ')}.`);
  }

  return Object.freeze({ code, component, recoveryClass });
}

function snapshot(state) {
  return Object.freeze({
    instanceId: state.instanceId,
    experienceId: state.experienceId,
    experienceVersion: state.experienceVersion,
    status: state.status,
    currentStepId: state.currentStepId,
    targetStepId: state.targetStepId,
    revealFrontier: state.revealFrontier,
    error: state.error
  });
}

export function createCoreEngine({ instanceId, experienceId, experienceVersion, stepIds } = {}) {
  const state = {
    instanceId: requireNonEmptyString(instanceId, 'instanceId'),
    experienceId: requireNonEmptyString(experienceId, 'experienceId'),
    experienceVersion: requireNonEmptyString(experienceVersion, 'experienceVersion'),
    status: SESSION_STATUS.IDLE,
    currentStepId: INITIAL_BOUNDARY_ID,
    targetStepId: null,
    revealFrontier: INITIAL_BOUNDARY_ID,
    error: null
  };
  const boundaries = createBoundaryModel(stepIds);
  const boundaryIds = boundaries.boundaryIds();
  const boundaryIndex = new Map(boundaryIds.map((stepId, index) => [stepId, index]));

  function assertNotDisposed() {
    if (state.status === SESSION_STATUS.DISPOSED) {
      throw new CoreStateTransitionError('disposed Core state is terminal.');
    }
  }

  function assertSemanticMutable() {
    assertNotDisposed();
    if (state.status === SESSION_STATUS.FAULTED) {
      throw new CoreStateTransitionError('faulted Core state cannot mutate semantic position.');
    }
  }

  function requireKnownBoundary(stepId, name) {
    requireNonEmptyString(stepId, name);
    if (!boundaries.has(stepId)) {
      throw new TypeError(`${name} must name a known semantic boundary; received ${stepId}.`);
    }
    return stepId;
  }

  function requirePendingTarget(expectedStepId, operation) {
    const expected = requireKnownBoundary(expectedStepId, 'expectedStepId');
    if (state.targetStepId === null) {
      throw new CoreStateTransitionError(`${operation} requires a pending semantic target.`);
    }
    if (state.targetStepId !== expected) {
      throw new CoreStateTransitionError(
        `${operation} expected pending target ${expected}, but active target is ${state.targetStepId}.`
      );
    }
    return expected;
  }

  function advanceRevealFrontier(stepId) {
    const target = requireKnownBoundary(stepId, 'stepId');
    if (boundaryIndex.get(target) > boundaryIndex.get(state.revealFrontier)) {
      state.revealFrontier = target;
    }
  }

  const read = Object.freeze({
    snapshot() {
      return snapshot(state);
    },
    boundaryIds() {
      return boundaryIds;
    }
  });

  const navigation = Object.freeze({
    resolve(request) {
      return boundaries.resolve(state.currentStepId, state.targetStepId, request);
    }
  });

  const semanticControl = Object.freeze({
    beginTarget(stepId) {
      assertSemanticMutable();
      const target = requireKnownBoundary(stepId, 'stepId');
      if (state.targetStepId !== null) {
        throw new CoreStateTransitionError(
          `cannot begin target ${target} while pending target ${state.targetStepId} is active.`
        );
      }
      state.targetStepId = target;
      return snapshot(state);
    },

    commitTarget(expectedStepId) {
      assertSemanticMutable();
      const target = requirePendingTarget(expectedStepId, 'commitTarget');
      state.currentStepId = target;
      state.targetStepId = null;
      advanceRevealFrontier(target);
      return snapshot(state);
    },

    abandonTarget(expectedStepId) {
      assertSemanticMutable();
      requirePendingTarget(expectedStepId, 'abandonTarget');
      state.targetStepId = null;
      return snapshot(state);
    },

    commitRestart() {
      assertSemanticMutable();
      if (state.targetStepId !== null) {
        requirePendingTarget(INITIAL_BOUNDARY_ID, 'commitRestart');
      } else if (state.currentStepId !== INITIAL_BOUNDARY_ID) {
        throw new CoreStateTransitionError(
          'commitRestart requires initial to be the committed boundary or the active pending target.'
        );
      }
      if (state.error !== null && state.error.recoveryClass !== FAULT_RECOVERY_CLASS.RECOVER) {
        throw new CoreStateTransitionError('commitRestart cannot clear a fallback-class canonical fault.');
      }
      state.currentStepId = INITIAL_BOUNDARY_ID;
      state.targetStepId = null;
      state.revealFrontier = INITIAL_BOUNDARY_ID;
      state.error = null;
      return snapshot(state);
    }
  });

  const faultControl = Object.freeze({
    recordFault(faultInput) {
      assertNotDisposed();
      const fault = normalizeFaultRecord(faultInput);
      if (state.targetStepId !== null) {
        throw new CoreStateTransitionError(
          'recordFault requires pending semantic target to be abandoned before canonical fault storage.'
        );
      }
      if (state.status === SESSION_STATUS.FAULTED) {
        throw new CoreStateTransitionError('faulted Core state already has terminal canonical fault state.');
      }
      if (state.error !== null) {
        const canEscalate = state.error.recoveryClass === FAULT_RECOVERY_CLASS.RECOVER &&
          fault.recoveryClass === FAULT_RECOVERY_CLASS.FALLBACK;
        if (!canEscalate) {
          throw new CoreStateTransitionError(
            `canonical fault ${state.error.code} must be cleared before recording ${fault.code}.`
          );
        }
      }

      state.error = fault;
      if (fault.recoveryClass === FAULT_RECOVERY_CLASS.FALLBACK) {
        state.status = SESSION_STATUS.FAULTED;
      }
      return snapshot(state);
    },

    clearRecoverableFault(expectedCode) {
      assertNotDisposed();
      requireNonEmptyString(expectedCode, 'expectedCode');
      if (state.error === null) {
        throw new CoreStateTransitionError('clearRecoverableFault requires an active canonical fault.');
      }
      if (state.error.recoveryClass !== FAULT_RECOVERY_CLASS.RECOVER) {
        throw new CoreStateTransitionError('fallback-class canonical fault cannot be cleared as recovered.');
      }
      if (state.error.code !== expectedCode) {
        throw new CoreStateTransitionError(
          `clearRecoverableFault expected ${expectedCode}, but active fault is ${state.error.code}.`
        );
      }
      state.error = null;
      return snapshot(state);
    }
  });

  const statusControl = Object.freeze({
    setStatus(nextStatus) {
      if (!STATUS_SET.has(nextStatus)) {
        throw new TypeError(`nextStatus must be one of: ${SESSION_STATUS_VALUES.join(', ')}.`);
      }
      if (state.status === SESSION_STATUS.DISPOSED && nextStatus !== SESSION_STATUS.DISPOSED) {
        throw new CoreStateTransitionError('disposed Core state is terminal.');
      }
      if (nextStatus === SESSION_STATUS.FAULTED) {
        throw new CoreStateTransitionError(
          'faulted status must be entered through faultControl.recordFault with recoveryClass fallback.'
        );
      }
      if (state.status === SESSION_STATUS.FAULTED && nextStatus !== SESSION_STATUS.DISPOSED) {
        throw new CoreStateTransitionError('faulted Core state may only transition to disposed.');
      }
      state.status = nextStatus;
      return snapshot(state);
    }
  });

  return Object.freeze({ read, navigation, semanticControl, faultControl, statusControl });
}
