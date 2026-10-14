// Code in Motion authoring compiler: localis.cim/authoring/v1 -> localis.cim/v2.
// Normative source: docs/AUTHORING-TO-RUNTIME-v1.md (cited below as A2R §n).
//
// Compilation is a pure, deterministic, fail-closed build transformation (A2R §2, §13, §14).
// It contains no subject-specific logic: Console data is copied into opaque renderer state.
// Diagnostics use the compiler namespace CIM-COMP-* (A2R §1); authoring diagnostics surface
// unchanged as causes of CIM-COMP-AUTHORING-INVALID.

import { createHash } from 'node:crypto';

import { validateExperience } from '../../src/experience/validate-experience.mjs';
import { SCHEMA_ID as AUTHORING_SCHEMA, validate as validateAuthoring } from './validate-authoring.mjs';

export const COMPILER_ID = 'localis.cim/authoring-compiler';
export const COMPILER_VERSION = '1.0.0';
export const RUNTIME_SCHEMA_TARGET = 'localis.cim/v2';

// Normative compilation constants (A2R §11) and compiler configuration (A2R §7). engineMin is the
// minimum compatible CiM engine version, independent of package/release identity (C2).
export const COMPILATION_CONSTANTS = Object.freeze({
  intraBeatDwellMs: 900,
  finalBeatDwellMs: 1600,
  maxSegmentsPerBeat: 99,
  engineMin: '0.2.0'
});

// Fixed renderer mapping (A2R §12). subject never participates in renderer selection.
// console/v1 is the canonical Console renderer identifier (C3; docs/renderers/CONSOLE-RENDERER-v1.md).
export const RENDERER_BY_LAYOUT = Object.freeze({ 'console-explanation': 'console/v1' });

const GENERATED_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*--s(0[1-9]|[1-9][0-9])$/;
const RESERVED_RUNTIME_IDS = Object.freeze(['initial']);

export const DIAGNOSTICS = Object.freeze({
  'CIM-COMP-UNSUPPORTED-SCHEMA': 'Source is not localis.cim/authoring/v1 (A2R §7, §14).',
  'CIM-COMP-TARGET-UNSUPPORTED': 'Requested runtime schema target is not supported (A2R §14).',
  'CIM-COMP-AUTHORING-INVALID': 'Authoring validation failed; causes carry CIM-AUTH-* diagnostics (A2R §14, §15).',
  'CIM-COMP-RENDERER-MAPPING': 'presentation.layout has no fixed renderer mapping (A2R §12, §14).',
  'CIM-COMP-SEGMENT-LIMIT': 'A beat has more than 99 Explanation segments (A2R §6, §14).',
  'CIM-COMP-ID-COLLISION': 'Generated runtime identifiers collide or use a reserved identifier (A2R §6, §14).',
  'CIM-COMP-RUNTIME-INVALID': 'Compiled output failed production runtime validation (A2R §14, §15).'
});

export class AuthoringCompilationError extends Error {
  constructor(diagnostics) {
    const first = diagnostics[0];
    super(first ? `${first.code} ${first.path}: ${first.message}` : 'Authoring compilation failed.');
    this.name = 'AuthoringCompilationError';
    this.code = first?.code ?? 'CIM-COMP-AUTHORING-INVALID';
    this.diagnostics = Object.freeze(diagnostics.map((d) => Object.freeze({ ...d })));
  }
}

function fail(code, path, message, causes) {
  throw new AuthoringCompilationError([{ code, path, message, ...(causes ? { causes } : {}) }]);
}

// Recursively key-sorted JSON: an environment-invariant digest of the parsed authoring value,
// independent of source formatting, line endings, and object-key order (A2R §13).
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
export function authoringSemanticDigest(parsed) { return sha256(JSON.stringify(canonicalValue(parsed))); }

export function generatedStepId(beatId, segmentOrdinal) {
  return `${beatId}--s${String(segmentOrdinal).padStart(2, '0')}`;
}

export function assertGeneratedIdentifiers(ids) {
  const seen = new Set();
  ids.forEach((id, index) => {
    const path = `$.steps[${index}].id`;
    if (RESERVED_RUNTIME_IDS.includes(id)) fail('CIM-COMP-ID-COLLISION', path, `Generated id "${id}" uses a reserved runtime identifier.`);
    if (!GENERATED_ID_PATTERN.test(id)) fail('CIM-COMP-ID-COLLISION', path, `Generated id "${id}" is not a compiler-owned {beat-id}--sNN identifier.`);
    if (seen.has(id)) fail('CIM-COMP-ID-COLLISION', path, `Generated id "${id}" collides with an earlier generated identifier.`);
    seen.add(id);
  });
}

// ---- Console state (opaque to Core; consumed only by the Console renderer) -------------------
//
// state = { transcript: [entry...], focus: [output-id...] }
// entry = { beat, prompt?, command, copy, typing?, risk?, output?, awaiting_response?, response? }
//   prompt            present only when the beat overrides the experience prompt
//   copy              always the resolved clipboard value (authored copy, else the command)
//   typing            present only when false
//   risk              the beat's risk level, for the historical gutter mark
//   output            present once the beat's output has been revealed
//   awaiting_response true while an interactive prompt waits for its simulated response
//   response          present once the response has been revealed
// focus = the active segment's authored focus ids in authored order; empty when it has none.

const PHASE = { command: 0, output: 1, response: 2 };

function outputLine(line) {
  return line.id === undefined ? { text: line.text, tone: line.tone } : { id: line.id, text: line.text, tone: line.tone };
}

function transcriptEntry(beat, phase) {
  const c = beat.console;
  const entry = { beat: beat.id };
  if (c.prompt !== undefined) entry.prompt = c.prompt;
  entry.command = c.command;
  entry.copy = c.copy ?? c.command;
  if (c.typing === false) entry.typing = false;
  if (beat.risk !== undefined) entry.risk = beat.risk.level;
  if (PHASE[phase] >= PHASE.output && c.output.length > 0) entry.output = c.output.map(outputLine);
  if (c.response !== undefined) {
    if (PHASE[phase] === PHASE.output) entry.awaiting_response = true;
    if (PHASE[phase] === PHASE.response) entry.response = c.response;
  }
  return entry;
}

function lastConsolePhase(beat) {
  const c = beat.console;
  return c.response !== undefined ? 'response' : c.output.length > 0 ? 'output' : 'command';
}

function commentaryFor(beat, segment, isFinal) {
  const commentary = { text: segment.text, anchor: segment.at };
  if (segment.focus !== undefined) commentary.evidence = [...segment.focus];
  if (isFinal && beat.risk !== undefined) {
    commentary.risk = beat.risk.guidance === undefined
      ? { level: beat.risk.level }
      : { level: beat.risk.level, guidance: beat.risk.guidance };
  }
  commentary.links = isFinal
    ? (beat.explanation.references ?? []).map((ref, i) => ({ id: `ref-${String(i + 1).padStart(2, '0')}`, label: ref.label, href: ref.url }))
    : [];
  return commentary;
}

/**
 * Compiles authoring source text. Returns { document, text, provenance, lint } on success and
 * throws AuthoringCompilationError on any failure; no partial document is ever returned.
 * Options exist for conformance testing of defensive failure paths only.
 */
export function compileAuthoringSource(sourceText, options = {}) {
  const target = options.target ?? RUNTIME_SCHEMA_TARGET;
  const engineMin = options.engineMin ?? COMPILATION_CONSTANTS.engineMin;
  const rendererMap = options.rendererMap ?? RENDERER_BY_LAYOUT;
  const runtimeValidator = options.runtimeValidator ?? validateExperience;

  if (typeof sourceText !== 'string') fail('CIM-COMP-AUTHORING-INVALID', '$', 'Authoring source must be provided as text so duplicate keys can be detected before parsing.');
  if (target !== RUNTIME_SCHEMA_TARGET) fail('CIM-COMP-TARGET-UNSUPPORTED', '$', `Runtime target ${JSON.stringify(target)} is unsupported; this compiler emits ${RUNTIME_SCHEMA_TARGET}.`);

  let peek = null;
  try { peek = JSON.parse(sourceText); } catch { /* reported by authoring validation */ }
  if (peek !== null && typeof peek === 'object' && !Array.isArray(peek) && peek.schema !== AUTHORING_SCHEMA) {
    fail('CIM-COMP-UNSUPPORTED-SCHEMA', '$.schema', `Source schema ${JSON.stringify(peek.schema)} is not ${AUTHORING_SCHEMA}.`);
  }

  const authoringDiagnostics = validateAuthoring(sourceText);
  const authoringErrors = authoringDiagnostics.filter((d) => d.severity === 'error');
  if (authoringErrors.length > 0) {
    fail('CIM-COMP-AUTHORING-INVALID', '$', `${authoringErrors.length} authoring validation error(s).`, authoringErrors);
  }
  const source = JSON.parse(sourceText);

  const renderer = rendererMap[source.presentation.layout];
  if (renderer === undefined) fail('CIM-COMP-RENDERER-MAPPING', '$.presentation.layout', `No renderer mapping for layout ${JSON.stringify(source.presentation.layout)}.`);

  source.beats.forEach((beat, bi) => {
    if (beat.explanation.segments.length > COMPILATION_CONSTANTS.maxSegmentsPerBeat) {
      fail('CIM-COMP-SEGMENT-LIMIT', `$.beats[${bi}].explanation.segments`,
        `Beat "${beat.id}" has ${beat.explanation.segments.length} segments; v1 allows at most ${COMPILATION_CONSTANTS.maxSegmentsPerBeat}.`);
    }
  });

  const steps = [];
  const completed = [];
  source.beats.forEach((beat, bi) => {
    const segments = beat.explanation.segments;
    segments.forEach((segment, si) => {
      const isFinal = si === segments.length - 1;
      steps.push({
        id: generatedStepId(beat.id, si + 1),
        label: beat.explanation.heading,
        beat: {
          id: beat.id,
          ordinal: bi + 1,
          heading: beat.explanation.heading,
          segment_ordinal: si + 1,
          segment_count: segments.length,
          final: isFinal
        },
        commentary: commentaryFor(beat, segment, isFinal),
        state: {
          transcript: [...completed, transcriptEntry(beat, segment.at)],
          focus: segment.focus === undefined ? [] : [...segment.focus]
        },
        dwell_ms: isFinal ? (beat.dwell ?? COMPILATION_CONSTANTS.finalBeatDwellMs) : COMPILATION_CONSTANTS.intraBeatDwellMs
      });
    });
    completed.push(transcriptEntry(beat, lastConsolePhase(beat)));
  });
  assertGeneratedIdentifiers(steps.map((step) => step.id));

  const rendererConfig = {};
  if (source.console.title !== undefined) rendererConfig.title = source.console.title;
  if (source.console.prompt !== undefined) rendererConfig.prompt = source.console.prompt;

  const document = {
    schema: RUNTIME_SCHEMA_TARGET,
    engine_min: engineMin,
    experience_version: source.version,
    id: source.id,
    renderer,
    renderer_config: rendererConfig,
    presentation: {
      title: source.title,
      description: source.description,
      subject: source.subject,
      beat_count: source.beats.length,
      default_playback_rate: source.presentation.defaultPlaybackRate ?? 1
    },
    initial_state: { transcript: [], focus: [] },
    steps
  };

  const runtimeErrors = runtimeValidator(document);
  if (runtimeErrors.length > 0) {
    fail('CIM-COMP-RUNTIME-INVALID', '$', `${runtimeErrors.length} runtime validation error(s) in compiled output.`, [...runtimeErrors]);
  }

  // Canonical emission (A2R §13): fixed field order by construction, UTF-8, LF, one terminal newline.
  const text = `${JSON.stringify(document, null, 2)}\n`;
  const provenance = {
    compiler: { id: COMPILER_ID, version: COMPILER_VERSION },
    authoring_schema: AUTHORING_SCHEMA,
    authoring_semantic_sha256: authoringSemanticDigest(source),
    runtime_schema: RUNTIME_SCHEMA_TARGET,
    engine_min: engineMin,
    constants: { intra_beat_dwell_ms: COMPILATION_CONSTANTS.intraBeatDwellMs, final_beat_dwell_ms: COMPILATION_CONSTANTS.finalBeatDwellMs },
    runtime_sha256: sha256(text),
    boundaries: steps.length
  };
  return Object.freeze({
    document: JSON.parse(text),
    text,
    provenance,
    provenanceText: `${JSON.stringify(provenance, null, 2)}\n`,
    lint: Object.freeze(authoringDiagnostics.filter((d) => d.severity === 'warning'))
  });
}
