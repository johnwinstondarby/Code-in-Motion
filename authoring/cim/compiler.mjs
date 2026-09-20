import {
  LineCounter,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseAllDocuments
} from 'yaml';

import {
  ExperienceValidationError,
  ingestExperience
} from '../../src/experience/ingest-experience.mjs';

const AUTHORING_VERSION = 1;
const RUNTIME_SCHEMA = 'localis.cim/v1';
const DIRECTIVE_PATTERN = /^(?:\uFEFF)?%(?:YAML|TAG)\b/m;
const SIMPLE_PATH_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function fail(message) {
  throw new TypeError(message);
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function childPath(parent, key) {
  return SIMPLE_PATH_KEY.test(key)
    ? parent + '.' + key
    : parent + '[' + JSON.stringify(key) + ']';
}

function freezeDiagnostic(diagnostic) {
  return Object.freeze({ ...diagnostic });
}

function freezeLocation(location) {
  return Object.freeze({ ...location });
}

function offsetFor(node) {
  if (node && Array.isArray(node.range) && Number.isInteger(node.range[0])) {
    return node.range[0];
  }
  return 0;
}

function endOffsetFor(node) {
  if (!node || !Array.isArray(node.range)) return offsetFor(node);
  const end = node.range[2] ?? node.range[1] ?? node.range[0];
  return Number.isInteger(end) ? end : offsetFor(node);
}

function locationAt(lineCounter, nodeOrOffset) {
  const startOffset = Number.isInteger(nodeOrOffset)
    ? nodeOrOffset
    : offsetFor(nodeOrOffset);
  const endOffset = Number.isInteger(nodeOrOffset)
    ? nodeOrOffset
    : endOffsetFor(nodeOrOffset);
  const start = lineCounter.linePos(Math.max(0, startOffset));
  const end = lineCounter.linePos(Math.max(0, endOffset));

  return freezeLocation({
    line: start.line,
    column: start.col,
    endLine: end.line,
    endColumn: end.col
  });
}

function diagnosticAt({
  lineCounter,
  node,
  offset,
  sourceId,
  code,
  path = '$',
  message,
  phase
}) {
  const location = locationAt(
    lineCounter,
    Number.isInteger(offset) ? offset : node
  );
  return freezeDiagnostic({
    code,
    path,
    line: location.line,
    column: location.column,
    endLine: location.endLine,
    endColumn: location.endColumn,
    message,
    phase,
    sourceId
  });
}

export class CimAuthoringError extends TypeError {
  constructor(diagnostics) {
    const frozenDiagnostics = Object.freeze(
      diagnostics.map((diagnostic) => freezeDiagnostic(diagnostic))
    );
    const first = frozenDiagnostics[0];
    super(
      first
        ? first.code + ' ' + first.sourceId + ':' + first.line + ':' +
          first.column + ' ' + first.path + ': ' + first.message
        : 'CiM authoring failed.'
    );
    this.name = 'CimAuthoringError';
    this.code = first?.code ?? 'CIM-AUTH-001';
    this.diagnostics = frozenDiagnostics;
  }
}

function throwDiagnostic(input) {
  throw new CimAuthoringError([diagnosticAt(input)]);
}

function recordLocation(locations, path, lineCounter, node) {
  if (!node || locations.has(path)) return;
  locations.set(path, locationAt(lineCounter, node));
}

function rebuildNode(node, path, context, fallbackNode = null) {
  const {
    lineCounter,
    locations,
    sourceId
  } = context;

  const locationNode = node ?? fallbackNode;
  recordLocation(locations, path, lineCounter, locationNode);

  if (node === null || node === undefined) return null;

  if (isAlias(node)) {
    throwDiagnostic({
      lineCounter,
      node,
      sourceId,
      code: 'CIM-AUTH-002',
      path,
      message: 'YAML aliases are not allowed in .cim source.',
      phase: 'authoring'
    });
  }

  if (node.anchor) {
    throwDiagnostic({
      lineCounter,
      node,
      sourceId,
      code: 'CIM-AUTH-002',
      path,
      message: 'YAML anchors are not allowed in .cim source.',
      phase: 'authoring'
    });
  }

  if (node.tag) {
    throwDiagnostic({
      lineCounter,
      node,
      sourceId,
      code: 'CIM-AUTH-002',
      path,
      message: 'Explicit or custom YAML tags are not allowed in .cim source.',
      phase: 'authoring'
    });
  }

  if (isScalar(node)) {
    const value = node.value;
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'boolean' &&
      typeof value !== 'number'
    ) {
      throwDiagnostic({
        lineCounter,
        node,
        sourceId,
        code: 'CIM-AUTH-002',
        path,
        message: 'Scalar value is not JSON-safe.',
        phase: 'authoring'
      });
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      throwDiagnostic({
        lineCounter,
        node,
        sourceId,
        code: 'CIM-AUTH-002',
        path,
        message: 'Non-finite numbers are not allowed in .cim source.',
        phase: 'authoring'
      });
    }

    return value;
  }

  if (isSeq(node)) {
    return node.items.map((item, index) =>
      rebuildNode(item, path + '[' + index + ']', context, node)
    );
  }

  if (isMap(node)) {
    const result = {};
    const seen = new Set();

    for (const pair of node.items) {
      const keyNode = pair?.key;
      if (!isScalar(keyNode) || typeof keyNode.value !== 'string') {
        throwDiagnostic({
          lineCounter,
          node: keyNode ?? pair ?? node,
          sourceId,
          code: 'CIM-AUTH-002',
          path,
          message: 'Mapping keys must be strings.',
          phase: 'authoring'
        });
      }

      const key = keyNode.value;
      const valuePath = childPath(path, key);

      if (key === '<<') {
        throwDiagnostic({
          lineCounter,
          node: keyNode,
          sourceId,
          code: 'CIM-AUTH-002',
          path: valuePath,
          message: 'YAML merge keys are not allowed in .cim source.',
          phase: 'authoring'
        });
      }

      if (seen.has(key)) {
        throwDiagnostic({
          lineCounter,
          node: keyNode,
          sourceId,
          code: 'CIM-AUTH-002',
          path: valuePath,
          message: 'Duplicate mapping key: ' + key,
          phase: 'authoring'
        });
      }
      seen.add(key);

      result[key] = rebuildNode(
        pair.value,
        valuePath,
        context,
        keyNode
      );
    }

    return result;
  }

  throwDiagnostic({
    lineCounter,
    node,
    sourceId,
    code: 'CIM-AUTH-002',
    path,
    message: 'YAML node type is outside the restricted .cim grammar.',
    phase: 'authoring'
  });
}

function parseErrorDiagnostic(error, lineCounter, sourceId) {
  const offset = Array.isArray(error?.pos) && Number.isInteger(error.pos[0])
    ? error.pos[0]
    : 0;
  return diagnosticAt({
    lineCounter,
    offset,
    sourceId,
    code: 'CIM-AUTH-001',
    path: '$',
    message: error?.message ?? 'Malformed .cim source.',
    phase: 'parse'
  });
}

function nearestLocation(locations, path) {
  let candidate = path;

  while (candidate.length > 0) {
    if (locations.has(candidate)) return locations.get(candidate);
    if (candidate === '$') break;

    const bracket = candidate.match(/^(.*)\[[^\]]+\]$/);
    if (bracket) {
      candidate = bracket[1];
      continue;
    }

    const dot = candidate.lastIndexOf('.');
    if (dot > 0) {
      candidate = candidate.slice(0, dot);
      continue;
    }

    candidate = '$';
  }

  return locations.get('$') ?? freezeLocation({
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1
  });
}

function frozenLocationRecord(locations) {
  const result = {};
  for (const [path, location] of locations) {
    result[path] = location;
  }
  return Object.freeze(result);
}

function validationDiagnostics(error, locations, sourceId) {
  return error.errors.map((validationError) => {
    const location = nearestLocation(locations, validationError.path);
    return freezeDiagnostic({
      code: validationError.code,
      path: validationError.path,
      line: location.line,
      column: location.column,
      endLine: location.endLine,
      endColumn: location.endColumn,
      message: validationError.message,
      phase: 'validation',
      sourceId
    });
  });
}

function directiveOffset(source) {
  const match = DIRECTIVE_PATTERN.exec(source);
  return match ? match.index : -1;
}

export function compileCimSource(
  source,
  { sourceId = '<memory>' } = {}
) {
  if (typeof source !== 'string') {
    fail('CiM source must be a string.');
  }
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    fail('CiM sourceId must be a non-empty string.');
  }

  const lineCounter = new LineCounter();

  let documents;
  try {
    documents = parseAllDocuments(source, {
      lineCounter,
      keepSourceTokens: true,
      prettyErrors: false,
      schema: 'core',
      version: '1.2',
      merge: false,
      uniqueKeys: false
    });
  } catch (error) {
    throw new CimAuthoringError([
      parseErrorDiagnostic(error, lineCounter, sourceId)
    ]);
  }

  const directive = directiveOffset(source);
  if (directive >= 0) {
    throwDiagnostic({
      lineCounter,
      offset: directive,
      sourceId,
      code: 'CIM-AUTH-002',
      path: '$',
      message: 'YAML directives are not allowed in .cim source.',
      phase: 'authoring'
    });
  }

  if (documents.length !== 1) {
    const second = documents[1];
    throwDiagnostic({
      lineCounter,
      node: second?.contents,
      offset: second?.range?.[0],
      sourceId,
      code: 'CIM-AUTH-002',
      path: '$',
      message: 'A .cim source must contain exactly one YAML document.',
      phase: 'authoring'
    });
  }

  const document = documents[0];
  if (document.errors.length > 0) {
    throw new CimAuthoringError(
      document.errors.map((error) =>
        parseErrorDiagnostic(error, lineCounter, sourceId)
      )
    );
  }

  const locations = new Map();
  const authored = rebuildNode(
    document.contents,
    '$',
    { lineCounter, locations, sourceId }
  );

  if (
    authored === null ||
    typeof authored !== 'object' ||
    Array.isArray(authored)
  ) {
    throwDiagnostic({
      lineCounter,
      node: document.contents,
      sourceId,
      code: 'CIM-AUTH-003',
      path: '$',
      message: 'A .cim source must be a top-level mapping.',
      phase: 'authoring'
    });
  }

  if (!own(authored, 'cim') || authored.cim !== AUTHORING_VERSION) {
    const location = locations.get('$.cim') ?? locations.get('$');
    throw new CimAuthoringError([
      freezeDiagnostic({
        code: 'CIM-AUTH-003',
        path: '$.cim',
        line: location?.line ?? 1,
        column: location?.column ?? 1,
        endLine: location?.endLine ?? location?.line ?? 1,
        endColumn: location?.endColumn ?? location?.column ?? 1,
        message: 'cim must equal supported authoring version 1.',
        phase: 'authoring',
        sourceId
      })
    ]);
  }

  if (own(authored, 'schema')) {
    const location = locations.get('$.schema') ?? locations.get('$');
    throw new CimAuthoringError([
      freezeDiagnostic({
        code: 'CIM-AUTH-002',
        path: '$.schema',
        line: location?.line ?? 1,
        column: location?.column ?? 1,
        endLine: location?.endLine ?? location?.line ?? 1,
        endColumn: location?.endColumn ?? location?.column ?? 1,
        message: 'schema is compiler-owned; authoring uses cim: 1.',
        phase: 'authoring',
        sourceId
      })
    ]);
  }

  const candidate = { schema: RUNTIME_SCHEMA };
  for (const key of Object.keys(authored)) {
    if (key === 'cim') continue;
    candidate[key] = authored[key];
  }

  if (locations.has('$.cim')) {
    locations.set('$.schema', locations.get('$.cim'));
  }

  let experience;
  try {
    experience = ingestExperience(candidate);
  } catch (error) {
    if (error instanceof ExperienceValidationError) {
      throw new CimAuthoringError(
        validationDiagnostics(error, locations, sourceId)
      );
    }
    throw error;
  }

  return Object.freeze({
    experience,
    locations: frozenLocationRecord(locations),
    sourceId
  });
}
