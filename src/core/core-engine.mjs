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

  const read = Object.freeze({
    snapshot() {
      return snapshot(state);
    },
    boundaryIds() {
      return boundaries.boundaryIds();
    }
  });

  const navigation = Object.freeze({
    resolve(request) {
      return boundaries.resolve(state.currentStepId, request);
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

  return Object.freeze({ read, navigation, statusControl });
}
