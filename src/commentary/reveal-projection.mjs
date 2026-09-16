export const COMMENTARY_OBSERVATION_KEYS = Object.freeze(['snapshot']);
export const COMMENTARY_REVEAL_PROJECTION_KEYS = Object.freeze(['read']);
export const COMMENTARY_REVEAL_STATE_KEYS = Object.freeze(['revealFrontier', 'entries']);
export const COMMENTARY_ENTRY_KEYS = Object.freeze(['stepId', 'index', 'text', 'links']);
export const COMMENTARY_LINK_KEYS = Object.freeze(['id', 'label', 'href']);
export const COMMENTARY_REVEAL_OPTIONS_KEYS = Object.freeze([
  'boundaryIds',
  'observation',
  'entries'
]);

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertFrozenPlainObject(value, label) {
  assertPlainObject(value, label);
  if (!Object.isFrozen(value)) fail(`${label} must be frozen.`);
}

function assertExactKeys(value, expected, label) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) fail(`${label} must not contain symbol keys.`);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    fail(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function dataValue(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property.`);
  }
  return descriptor.value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string.`);
  return value;
}

function validateBoundaryIds(boundaryIds) {
  if (!Array.isArray(boundaryIds) || !Object.isFrozen(boundaryIds) || boundaryIds.length < 2) {
    fail('Commentary boundaryIds must be a frozen array containing initial and at least one authored boundary.');
  }
  const seen = new Set();
  for (let index = 0; index < boundaryIds.length; index += 1) {
    const stepId = requireNonEmptyString(boundaryIds[index], `Commentary boundaryIds[${index}]`);
    if (seen.has(stepId)) fail(`Commentary boundaryIds contains duplicate ${stepId}.`);
    seen.add(stepId);
  }
  if (boundaryIds[0] !== 'initial') fail('Commentary boundaryIds must begin with initial.');
  return boundaryIds;
}

function validateObservation(observation) {
  assertFrozenPlainObject(observation, 'Commentary observation');
  assertExactKeys(observation, COMMENTARY_OBSERVATION_KEYS, 'Commentary observation');
  const snapshot = dataValue(observation, 'snapshot', 'Commentary observation');
  if (typeof snapshot !== 'function') fail('Commentary observation.snapshot must be a function.');
  return observation;
}

function validateLink(link, entryIndex, linkIndex) {
  const label = `Commentary entries[${entryIndex}].links[${linkIndex}]`;
  assertFrozenPlainObject(link, label);
  assertExactKeys(link, COMMENTARY_LINK_KEYS, label);
  return Object.freeze({
    id: requireNonEmptyString(dataValue(link, 'id', label), `${label}.id`),
    label: requireNonEmptyString(dataValue(link, 'label', label), `${label}.label`),
    href: requireNonEmptyString(dataValue(link, 'href', label), `${label}.href`)
  });
}

function validateEntries(entries, boundaryIds) {
  if (!Array.isArray(entries) || !Object.isFrozen(entries)) {
    fail('Commentary entries must be a frozen array.');
  }
  if (entries.length !== boundaryIds.length - 1) {
    fail('Commentary entries must align one-for-one with authored semantic boundaries.');
  }

  return Object.freeze(entries.map((entry, entryIndex) => {
    const label = `Commentary entries[${entryIndex}]`;
    assertFrozenPlainObject(entry, label);
    assertExactKeys(entry, ['stepId', 'text', 'links'], label);
    const stepId = requireNonEmptyString(dataValue(entry, 'stepId', label), `${label}.stepId`);
    if (stepId !== boundaryIds[entryIndex + 1]) {
      fail(`${label}.stepId must align with canonical boundary order.`);
    }
    const text = dataValue(entry, 'text', label);
    if (typeof text !== 'string') fail(`${label}.text must be a string.`);
    const links = dataValue(entry, 'links', label);
    if (!Array.isArray(links) || !Object.isFrozen(links)) fail(`${label}.links must be a frozen array.`);
    const projectedLinks = Object.freeze(links.map((link, linkIndex) => validateLink(link, entryIndex, linkIndex)));
    return Object.freeze({ stepId, text, links: projectedLinks });
  }));
}

function readRevealFrontier(observation, indexById) {
  const snapshot = observation.snapshot();
  assertFrozenPlainObject(snapshot, 'Commentary Runtime snapshot');
  const canonical = dataValue(snapshot, 'canonical', 'Commentary Runtime snapshot');
  assertFrozenPlainObject(canonical, 'Commentary canonical snapshot');
  const revealFrontier = requireNonEmptyString(
    dataValue(canonical, 'revealFrontier', 'Commentary canonical snapshot'),
    'Commentary canonical snapshot.revealFrontier'
  );
  if (!indexById.has(revealFrontier)) {
    fail(`Commentary reveal frontier ${revealFrontier} is not a known semantic boundary.`);
  }
  return revealFrontier;
}

export function createCommentaryRevealProjection(optionsInput) {
  assertPlainObject(optionsInput, 'Commentary reveal projection options');
  assertExactKeys(optionsInput, COMMENTARY_REVEAL_OPTIONS_KEYS, 'Commentary reveal projection options');

  const boundaryIds = validateBoundaryIds(
    dataValue(optionsInput, 'boundaryIds', 'Commentary reveal projection options')
  );
  const observation = validateObservation(
    dataValue(optionsInput, 'observation', 'Commentary reveal projection options')
  );
  const sourceEntries = validateEntries(
    dataValue(optionsInput, 'entries', 'Commentary reveal projection options'),
    boundaryIds
  );
  const indexById = new Map(boundaryIds.map((stepId, index) => [stepId, index]));

  const projectedEntries = Object.freeze(sourceEntries.map((entry, index) => Object.freeze({
    stepId: entry.stepId,
    index: index + 1,
    text: entry.text,
    links: entry.links
  })));

  const projection = {
    read() {
      const revealFrontier = readRevealFrontier(observation, indexById);
      const frontierIndex = indexById.get(revealFrontier);
      return Object.freeze({
        revealFrontier,
        entries: Object.freeze(projectedEntries.slice(0, frontierIndex))
      });
    }
  };

  assertExactKeys(projection, COMMENTARY_REVEAL_PROJECTION_KEYS, 'Commentary reveal projection');
  return Object.freeze(projection);
}
