import {
  COMMAND_RESULT,
  INITIAL_BOUNDARY_ID,
  NAVIGATION_COMMAND,
  NAVIGATION_COMMAND_VALUES,
  NAVIGATION_REASON
} from '../contracts/session.mjs';

const COMMAND_SET = new Set(NAVIGATION_COMMAND_VALUES);
const LIFECYCLE_REJECTION_REASONS = new Set([
  NAVIGATION_REASON.FAULTED,
  NAVIGATION_REASON.DISPOSED
]);

function requireStepIds(stepIds) {
  if (!Array.isArray(stepIds) || stepIds.length === 0) {
    throw new TypeError('stepIds must be a non-empty array.');
  }

  const seen = new Set();
  const copy = [];

  for (let index = 0; index < stepIds.length; index += 1) {
    const stepId = stepIds[index];
    if (typeof stepId !== 'string' || stepId.length === 0) {
      throw new TypeError(`stepIds[${index}] must be a non-empty string.`);
    }
    if (stepId === INITIAL_BOUNDARY_ID) {
      throw new TypeError(`stepIds[${index}] cannot use reserved boundary id ${INITIAL_BOUNDARY_ID}.`);
    }
    if (seen.has(stepId)) {
      throw new TypeError(`stepIds contains duplicate boundary id ${stepId}.`);
    }
    seen.add(stepId);
    copy.push(stepId);
  }

  return Object.freeze(copy);
}

function requireRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('navigation request must be a plain object.');
  }

  const prototype = Object.getPrototypeOf(request);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('navigation request must be a plain object.');
  }

  const descriptors = Object.getOwnPropertyDescriptors(request);
  const keys = Reflect.ownKeys(request);
  if (keys.some((key) => typeof key !== 'string')) {
    throw new TypeError('navigation request cannot contain symbol keys.');
  }

  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError(`navigation request property ${key} must be an enumerable data property.`);
    }
  }

  const command = descriptors.command?.value;
  if (!COMMAND_SET.has(command)) {
    throw new TypeError(`navigation command must be one of: ${NAVIGATION_COMMAND_VALUES.join(', ')}.`);
  }

  const expectedKeys = command === NAVIGATION_COMMAND.SEEK
    ? ['command', 'stepId']
    : ['command'];
  const actualKeys = Object.keys(request).sort();
  const expectedSorted = [...expectedKeys].sort();
  if (
    actualKeys.length !== expectedSorted.length ||
    actualKeys.some((key, index) => key !== expectedSorted[index])
  ) {
    throw new TypeError(`navigation request for ${command} must expose exactly: ${expectedKeys.join(', ')}.`);
  }

  if (command === NAVIGATION_COMMAND.SEEK) {
    const stepId = descriptors.stepId?.value;
    if (typeof stepId !== 'string' || stepId.length === 0) {
      throw new TypeError('seek stepId must be a non-empty string.');
    }
    return Object.freeze({ command, stepId });
  }

  return Object.freeze({ command });
}

function resolution(command, result, fromStepId, toStepId, reason = null) {
  return Object.freeze({ command, result, fromStepId, toStepId, reason });
}

function sameBoundaryResolution(command, stepId) {
  return resolution(
    command,
    COMMAND_RESULT.NO_CHANGE,
    stepId,
    stepId,
    NAVIGATION_REASON.ALREADY_AT_BOUNDARY
  );
}

export function createBoundaryModel(stepIds) {
  const authoredStepIds = requireStepIds(stepIds);
  const boundaryIds = Object.freeze([INITIAL_BOUNDARY_ID, ...authoredStepIds]);
  const indexById = new Map(boundaryIds.map((stepId, index) => [stepId, index]));
  const finalStepId = authoredStepIds[authoredStepIds.length - 1];

  function requireKnownBoundary(stepId, name) {
    if (!indexById.has(stepId)) {
      throw new TypeError(`${name} must name a known semantic boundary; received ${String(stepId)}.`);
    }
    return stepId;
  }

  function resolve(currentStepId, pendingTargetStepId, requestInput, lifecycleRejectionReason = null) {
    const fromStepId = requireKnownBoundary(currentStepId, 'currentStepId');
    if (pendingTargetStepId !== null) {
      requireKnownBoundary(pendingTargetStepId, 'pendingTargetStepId');
    }
    const request = requireRequest(requestInput);

    if (lifecycleRejectionReason !== null) {
      if (!LIFECYCLE_REJECTION_REASONS.has(lifecycleRejectionReason)) {
        throw new TypeError('lifecycleRejectionReason must be faulted, disposed, or null.');
      }
      return resolution(
        request.command,
        COMMAND_RESULT.REJECTED,
        fromStepId,
        null,
        lifecycleRejectionReason
      );
    }

    const currentIndex = indexById.get(fromStepId);

    switch (request.command) {
      case NAVIGATION_COMMAND.NEXT:
        if (currentIndex === boundaryIds.length - 1) {
          return resolution(request.command, COMMAND_RESULT.NO_CHANGE, fromStepId, fromStepId, NAVIGATION_REASON.AT_END);
        }
        return resolution(request.command, COMMAND_RESULT.SUCCESS, fromStepId, boundaryIds[currentIndex + 1]);

      case NAVIGATION_COMMAND.PREVIOUS:
        if (pendingTargetStepId !== null) {
          return resolution(request.command, COMMAND_RESULT.NO_CHANGE, fromStepId, fromStepId);
        }
        if (currentIndex === 0) {
          return resolution(request.command, COMMAND_RESULT.NO_CHANGE, fromStepId, fromStepId, NAVIGATION_REASON.AT_START);
        }
        return resolution(request.command, COMMAND_RESULT.SUCCESS, fromStepId, boundaryIds[currentIndex - 1]);

      case NAVIGATION_COMMAND.SEEK:
        if (!indexById.has(request.stepId)) {
          return resolution(request.command, COMMAND_RESULT.REJECTED, fromStepId, null, NAVIGATION_REASON.UNKNOWN_STEP);
        }
        if (request.stepId === fromStepId) {
          return sameBoundaryResolution(request.command, fromStepId);
        }
        return resolution(request.command, COMMAND_RESULT.SUCCESS, fromStepId, request.stepId);

      case NAVIGATION_COMMAND.HOME:
        if (fromStepId === INITIAL_BOUNDARY_ID) {
          return sameBoundaryResolution(request.command, fromStepId);
        }
        return resolution(request.command, COMMAND_RESULT.SUCCESS, fromStepId, INITIAL_BOUNDARY_ID);

      case NAVIGATION_COMMAND.RESTART:
        return resolution(request.command, COMMAND_RESULT.SUCCESS, fromStepId, INITIAL_BOUNDARY_ID);

      case NAVIGATION_COMMAND.END:
        if (fromStepId === finalStepId) {
          return sameBoundaryResolution(request.command, fromStepId);
        }
        return resolution(request.command, COMMAND_RESULT.SUCCESS, fromStepId, finalStepId);

      default:
        throw new TypeError(`unsupported navigation command ${request.command}.`);
    }
  }

  return Object.freeze({
    boundaryIds() {
      return boundaryIds;
    },
    has(stepId) {
      return indexById.has(stepId);
    },
    resolve
  });
}
