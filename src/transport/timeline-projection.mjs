export const TRANSPORT_OBSERVATION_PORT_KEYS = Object.freeze([
  'snapshot',
  'boundaryIds'
]);

export const TRANSPORT_TIMELINE_KEYS = Object.freeze([
  'boundaryIds',
  'project'
]);

export const TRANSPORT_TIMELINE_PROJECTION_KEYS = Object.freeze([
  'currentStepId',
  'targetStepId',
  'revealFrontier',
  'markers'
]);

export const TRANSPORT_MARKER_KEYS = Object.freeze([
  'stepId',
  'index',
  'current',
  'target',
  'revealed'
]);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainFrozenObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
  if (!Object.isFrozen(value)) fail(`${label} must be frozen.`);
}

function assertExactOwnKeys(value, expectedKeys, label) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) {
    fail(`${label} must not contain symbol keys.`);
  }
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !keys.includes(key))) {
    fail(`${label} must contain exactly: ${expectedKeys.join(', ')}.`);
  }
}

function assertEnumerableDataFunction(descriptor, label) {
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label} must be an enumerable data property.`);
  }
  if (typeof descriptor.value !== 'function') {
    fail(`${label} must be a function.`);
  }
}

export function assertTransportObservationPort(port) {
  assertPlainFrozenObject(port, 'Transport observation port');
  assertExactOwnKeys(port, TRANSPORT_OBSERVATION_PORT_KEYS, 'Transport observation port');

  const descriptors = Object.getOwnPropertyDescriptors(port);
  for (const key of TRANSPORT_OBSERVATION_PORT_KEYS) {
    assertEnumerableDataFunction(descriptors[key], `Transport observation port.${key}`);
  }

  return port;
}

function readBoundaryIds(port) {
  const boundaryIds = port.boundaryIds();
  if (!Array.isArray(boundaryIds) || !Object.isFrozen(boundaryIds)) {
    fail('Transport observation boundaryIds() must return a frozen array.');
  }
  if (boundaryIds.length === 0 || boundaryIds[0] !== 'initial') {
    fail('Transport observation boundaryIds() must begin with initial.');
  }

  const seen = new Set();
  for (const stepId of boundaryIds) {
    if (typeof stepId !== 'string' || stepId.length === 0) {
      fail('Transport observation boundary IDs must be non-empty strings.');
    }
    if (seen.has(stepId)) {
      fail(`Transport observation boundary ID ${stepId} is duplicated.`);
    }
    seen.add(stepId);
  }
  return boundaryIds;
}

function readCanonicalSnapshot(port, boundaryIndex) {
  const snapshot = port.snapshot();
  assertPlainFrozenObject(snapshot, 'Transport observation snapshot');

  const snapshotDescriptor = Object.getOwnPropertyDescriptor(snapshot, 'canonical');
  if (!snapshotDescriptor?.enumerable || !('value' in snapshotDescriptor)) {
    fail('Transport observation snapshot.canonical must be an enumerable data property.');
  }

  const canonical = snapshotDescriptor.value;
  assertPlainFrozenObject(canonical, 'Transport observation canonical snapshot');

  const descriptors = Object.getOwnPropertyDescriptors(canonical);
  const readId = (key, nullable) => {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(`Transport observation canonical.${key} must be an enumerable data property.`);
    }
    const value = descriptor.value;
    if (nullable && value === null) return null;
    if (typeof value !== 'string' || !boundaryIndex.has(value)) {
      fail(`Transport observation canonical.${key} must identify a known semantic boundary${nullable ? ' or be null' : ''}.`);
    }
    return value;
  };

  return Object.freeze({
    currentStepId: readId('currentStepId', false),
    targetStepId: readId('targetStepId', true),
    revealFrontier: readId('revealFrontier', false)
  });
}

export function createTransportTimeline(observationPortInput) {
  const observationPort = assertTransportObservationPort(observationPortInput);
  const boundaryIds = readBoundaryIds(observationPort);
  const boundaryIndex = new Map(boundaryIds.map((stepId, index) => [stepId, index]));

  const timeline = {
    boundaryIds() {
      return boundaryIds;
    },

    project() {
      const canonical = readCanonicalSnapshot(observationPort, boundaryIndex);
      const revealIndex = boundaryIndex.get(canonical.revealFrontier);
      const markers = Object.freeze(boundaryIds.map((stepId, index) => Object.freeze({
        stepId,
        index,
        current: stepId === canonical.currentStepId,
        target: stepId === canonical.targetStepId,
        revealed: index <= revealIndex
      })));

      const projection = {
        currentStepId: canonical.currentStepId,
        targetStepId: canonical.targetStepId,
        revealFrontier: canonical.revealFrontier,
        markers
      };
      assertExactOwnKeys(projection, TRANSPORT_TIMELINE_PROJECTION_KEYS, 'Transport timeline projection');
      return Object.freeze(projection);
    }
  };

  assertExactOwnKeys(timeline, TRANSPORT_TIMELINE_KEYS, 'Transport timeline');
  return Object.freeze(timeline);
}
