import {
  INITIAL_BOUNDARY_ID,
  SESSION_STATUS,
  SESSION_STATUS_VALUES
} from '../contracts/session.mjs';
import { createBoundaryModel } from './boundary-model.mjs';

const STATUS_SET = new Set(SESSION_STATUS_VALUES);

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

  function assertMutable() {
    if (state.status === SESSION_STATUS.DISPOSED) {
      throw new CoreStateTransitionError('disposed Core state is terminal.');
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
      assertMutable();
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
      assertMutable();
      const target = requirePendingTarget(expectedStepId, 'commitTarget');
      state.currentStepId = target;
      state.targetStepId = null;
      advanceRevealFrontier(target);
      return snapshot(state);
    },

    abandonTarget(expectedStepId) {
      assertMutable();
      requirePendingTarget(expectedStepId, 'abandonTarget');
      state.targetStepId = null;
      return snapshot(state);
    },

    commitRestart() {
      assertMutable();
      if (state.targetStepId !== null) {
        requirePendingTarget(INITIAL_BOUNDARY_ID, 'commitRestart');
      } else if (state.currentStepId !== INITIAL_BOUNDARY_ID) {
        throw new CoreStateTransitionError(
          'commitRestart requires initial to be the committed boundary or the active pending target.'
        );
      }
      state.currentStepId = INITIAL_BOUNDARY_ID;
      state.targetStepId = null;
      state.revealFrontier = INITIAL_BOUNDARY_ID;
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
      state.status = nextStatus;
      return snapshot(state);
    }
  });

  return Object.freeze({ read, navigation, semanticControl, statusControl });
}
