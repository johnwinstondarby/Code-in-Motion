const EXPERIENCE_SCHEMA_V1 = 'localis.cim/v1';
const EXPERIENCE_SCHEMA_V2 = 'localis.cim/v2';
const SUPPORTED_SCHEMAS = new Set([EXPERIENCE_SCHEMA_V1, EXPERIENCE_SCHEMA_V2]);
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const V2_STEP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--s[0-9]{2})?$/;
const GENERATED_STEP_ID_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)--s([0-9]{2})$/;
const RENDERER_PATTERN = /^[a-z0-9][a-z0-9-]*\/v[1-9][0-9]*$/;
const LINK_PREFIX_PATTERN = /^(?:https?:\/\/|mailto:|\/|#)/i;
const ASCII_SPACE_OR_CONTROL = /[\u0000-\u0020\u007f]/g;

const V1_EXPERIENCE_KEYS = new Set(['schema','engine_min','experience_version','id','renderer','renderer_config','initial_state','steps']);
const V2_EXPERIENCE_KEYS = new Set([...V1_EXPERIENCE_KEYS, 'presentation']);
const V1_REQUIRED = Object.freeze(['schema','engine_min','experience_version','id','renderer','initial_state','steps']);
const V2_REQUIRED = Object.freeze([...V1_REQUIRED.slice(0, 5), 'presentation', ...V1_REQUIRED.slice(5)]);
const V1_STEP_KEYS = new Set(['id','label','marker','commentary','state','renderer_config','dwell_ms']);
const V2_STEP_KEYS = new Set([...V1_STEP_KEYS, 'beat']);
const V1_STEP_REQUIRED = Object.freeze(['id','label','commentary','state']);
const V2_STEP_REQUIRED = Object.freeze(['id','label','beat','commentary','state']);
const PRESENTATION_KEYS = new Set(['title','description','subject','beat_count','default_playback_rate']);
const PRESENTATION_REQUIRED = Object.freeze([...PRESENTATION_KEYS]);
const BEAT_KEYS = new Set(['id','ordinal','heading','segment_ordinal','segment_count','final']);
const BEAT_REQUIRED = Object.freeze([...BEAT_KEYS]);
const COMMENTARY_KEYS = new Set(['text','links']);
const COMMENTARY_REQUIRED = Object.freeze(['text','links']);
const LINK_KEYS = new Set(['id','label','href']);
const LINK_REQUIRED = Object.freeze(['id','label','href']);

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function own(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
function addError(errors, code, path, message, source = 'schema') { errors.push(Object.freeze({ code, path, message, source })); }
function requireKeys(value, keys, path, errors, code = 'CIM-EXP-002') { for (const key of keys) if (!own(value, key)) addError(errors, code, `${path}.${key}`, 'required property is missing.'); }
function rejectAdditionalKeys(value, keys, path, errors, code = 'CIM-EXP-002') { for (const key of Object.keys(value)) if (!keys.has(key)) addError(errors, code, `${path}.${key}`, 'additional property is not allowed.'); }
function requireNonEmptyString(value, path, errors, code = 'CIM-EXP-002') { if (typeof value !== 'string' || value.length === 0) { addError(errors, code, path, 'must be a non-empty string.'); return false; } return true; }
function validateRendererConfig(value, path, errors) { if (!isObject(value)) addError(errors, 'CIM-EXP-002', path, 'must be an object.'); }
function isPositiveInteger(value, max = Number.MAX_SAFE_INTEGER) { return Number.isInteger(value) && value >= 1 && value <= max; }

function validatePresentation(value, errors) {
  const path = '$.presentation';
  if (!isObject(value)) { addError(errors, 'CIM-EXP-007', path, 'must be an object.'); return; }
  requireKeys(value, PRESENTATION_REQUIRED, path, errors, 'CIM-EXP-007');
  rejectAdditionalKeys(value, PRESENTATION_KEYS, path, errors, 'CIM-EXP-007');
  for (const key of ['title','description','subject']) if (own(value, key)) requireNonEmptyString(value[key], `${path}.${key}`, errors, 'CIM-EXP-007');
  if (own(value, 'beat_count') && !isPositiveInteger(value.beat_count)) addError(errors, 'CIM-EXP-007', `${path}.beat_count`, 'must be a positive integer.');
  if (own(value, 'default_playback_rate') && (typeof value.default_playback_rate !== 'number' || !Number.isFinite(value.default_playback_rate) || value.default_playback_rate < 0.5 || value.default_playback_rate > 2)) addError(errors, 'CIM-EXP-007', `${path}.default_playback_rate`, 'must be a finite number from 0.5 through 2.0.');
}

function validateBeat(value, stepIndex, errors) {
  const path = `$.steps[${stepIndex}].beat`;
  if (!isObject(value)) { addError(errors, 'CIM-EXP-008', path, 'must be an object.'); return; }
  requireKeys(value, BEAT_REQUIRED, path, errors, 'CIM-EXP-008');
  rejectAdditionalKeys(value, BEAT_KEYS, path, errors, 'CIM-EXP-008');
  if (own(value, 'id') && (typeof value.id !== 'string' || !IDENTIFIER_PATTERN.test(value.id))) addError(errors, 'CIM-EXP-008', `${path}.id`, 'must be a canonical identifier.');
  if (own(value, 'ordinal') && !isPositiveInteger(value.ordinal)) addError(errors, 'CIM-EXP-008', `${path}.ordinal`, 'must be a positive integer.');
  if (own(value, 'heading')) requireNonEmptyString(value.heading, `${path}.heading`, errors, 'CIM-EXP-008');
  if (own(value, 'segment_ordinal') && !isPositiveInteger(value.segment_ordinal, 99)) addError(errors, 'CIM-EXP-008', `${path}.segment_ordinal`, 'must be an integer from 1 through 99.');
  if (own(value, 'segment_count') && !isPositiveInteger(value.segment_count, 99)) addError(errors, 'CIM-EXP-008', `${path}.segment_count`, 'must be an integer from 1 through 99.');
  if (own(value, 'final') && typeof value.final !== 'boolean') addError(errors, 'CIM-EXP-008', `${path}.final`, 'must be boolean.');
}

function validateCommentaryLink(link, stepIndex, linkIndex, errors) {
  const path = `$.steps[${stepIndex}].commentary.links[${linkIndex}]`;
  if (!isObject(link)) { addError(errors, 'CIM-EXP-006', path, 'must be an object.'); return; }
  requireKeys(link, LINK_REQUIRED, path, errors, 'CIM-EXP-006'); rejectAdditionalKeys(link, LINK_KEYS, path, errors, 'CIM-EXP-006');
  if (own(link, 'id') && requireNonEmptyString(link.id, `${path}.id`, errors, 'CIM-EXP-006') && !IDENTIFIER_PATTERN.test(link.id)) addError(errors, 'CIM-EXP-006', `${path}.id`, 'must be a canonical identifier.');
  if (own(link, 'label')) requireNonEmptyString(link.label, `${path}.label`, errors, 'CIM-EXP-006');
  if (own(link, 'href') && requireNonEmptyString(link.href, `${path}.href`, errors, 'CIM-EXP-006') && !LINK_PREFIX_PATTERN.test(link.href)) addError(errors, 'CIM-EXP-006', `${path}.href`, 'must use an allowed link prefix.');
}
function validateCommentary(value, stepIndex, errors) {
  const path = `$.steps[${stepIndex}].commentary`;
  if (!isObject(value)) { addError(errors, 'CIM-EXP-002', path, 'must be an object.'); return; }
  requireKeys(value, COMMENTARY_REQUIRED, path, errors); rejectAdditionalKeys(value, COMMENTARY_KEYS, path, errors);
  if (own(value, 'text')) requireNonEmptyString(value.text, `${path}.text`, errors);
  if (own(value, 'links')) { if (!Array.isArray(value.links)) addError(errors, 'CIM-EXP-002', `${path}.links`, 'must be an array.'); else value.links.forEach((link, i) => validateCommentaryLink(link, stepIndex, i, errors)); }
}

function validateStep(step, stepIndex, schema, errors) {
  const v2 = schema === EXPERIENCE_SCHEMA_V2; const path = `$.steps[${stepIndex}]`;
  if (!isObject(step)) { addError(errors, 'CIM-EXP-002', path, 'must be an object.'); return; }
  requireKeys(step, v2 ? V2_STEP_REQUIRED : V1_STEP_REQUIRED, path, errors); rejectAdditionalKeys(step, v2 ? V2_STEP_KEYS : V1_STEP_KEYS, path, errors);
  if (own(step, 'id')) {
    const pattern = v2 ? V2_STEP_ID_PATTERN : IDENTIFIER_PATTERN;
    if (typeof step.id !== 'string' || !pattern.test(step.id)) addError(errors, 'CIM-EXP-002', `${path}.id`, 'must be a canonical step identifier.');
    else if (step.id === 'initial') addError(errors, 'CIM-EXP-004', `${path}.id`, 'initial is reserved and cannot be an authored step id.');
  }
  if (own(step, 'label')) requireNonEmptyString(step.label, `${path}.label`, errors);
  if (own(step, 'marker')) requireNonEmptyString(step.marker, `${path}.marker`, errors);
  if (v2 && own(step, 'beat')) validateBeat(step.beat, stepIndex, errors);
  if (own(step, 'commentary')) validateCommentary(step.commentary, stepIndex, errors);
  if (own(step, 'state') && step.state === null) addError(errors, 'CIM-EXP-002', `${path}.state`, 'must not be null.');
  if (own(step, 'renderer_config')) validateRendererConfig(step.renderer_config, `${path}.renderer_config`, errors);
  if (own(step, 'dwell_ms') && (!Number.isInteger(step.dwell_ms) || step.dwell_ms < 0)) addError(errors, 'CIM-EXP-005', `${path}.dwell_ms`, 'must be a non-negative integer.');
}

function structuralErrorsFor(experience) {
  const errors = [];
  if (!isObject(experience)) { addError(errors, 'CIM-EXP-002', '$', 'experience must be an object.'); return errors; }
  const schema = experience.schema; const v2 = schema === EXPERIENCE_SCHEMA_V2;
  requireKeys(experience, v2 ? V2_REQUIRED : V1_REQUIRED, '$', errors); rejectAdditionalKeys(experience, v2 ? V2_EXPERIENCE_KEYS : V1_EXPERIENCE_KEYS, '$', errors);
  if (own(experience, 'schema') && !SUPPORTED_SCHEMAS.has(schema)) addError(errors, 'CIM-EXP-001', '$.schema', `must equal ${EXPERIENCE_SCHEMA_V1} or ${EXPERIENCE_SCHEMA_V2}.`);
  for (const key of ['engine_min','experience_version']) if (own(experience, key) && (typeof experience[key] !== 'string' || !SEMVER_PATTERN.test(experience[key]))) addError(errors, 'CIM-EXP-002', `$.${key}`, 'must be semantic version text.');
  if (own(experience, 'id') && (typeof experience.id !== 'string' || !IDENTIFIER_PATTERN.test(experience.id))) addError(errors, 'CIM-EXP-002', '$.id', 'must be a canonical experience identifier.');
  if (own(experience, 'renderer') && (typeof experience.renderer !== 'string' || !RENDERER_PATTERN.test(experience.renderer))) addError(errors, 'CIM-EXP-002', '$.renderer', 'must be a canonical renderer identifier.');
  if (own(experience, 'renderer_config')) validateRendererConfig(experience.renderer_config, '$.renderer_config', errors);
  if (v2 && own(experience, 'presentation')) validatePresentation(experience.presentation, errors);
  if (own(experience, 'initial_state') && experience.initial_state === null) addError(errors, 'CIM-EXP-002', '$.initial_state', 'must not be null.');
  if (own(experience, 'steps')) { if (!Array.isArray(experience.steps) || experience.steps.length === 0) addError(errors, 'CIM-EXP-002', '$.steps', 'must be a non-empty array.'); else experience.steps.forEach((step, i) => validateStep(step, i, schema, errors)); }
  return errors;
}

function normalizedHref(value) { return value.replace(ASCII_SPACE_OR_CONTROL, ''); }
function commonSemanticErrors(experience, errors) {
  const seenStepIds = new Set();
  experience.steps.forEach((step, stepIndex) => {
    if (!isObject(step)) return; const stepPath = `$.steps[${stepIndex}]`;
    if (typeof step.id === 'string') { if (seenStepIds.has(step.id)) addError(errors, 'CIM-EXP-003', `${stepPath}.id`, `Duplicate step id: ${step.id}`, 'semantic'); else seenStepIds.add(step.id); }
    const links = step.commentary?.links; if (!Array.isArray(links)) return; const seenLinkIds = new Set();
    links.forEach((link, linkIndex) => { if (!isObject(link)) return; const path = `${stepPath}.commentary.links[${linkIndex}]`;
      if (typeof link.id === 'string') { if (seenLinkIds.has(link.id)) addError(errors, 'CIM-EXP-006', `${path}.id`, 'Link ids must be unique within one commentary entry.', 'semantic'); else seenLinkIds.add(link.id); }
      if (typeof link.href === 'string' && !LINK_PREFIX_PATTERN.test(normalizedHref(link.href))) addError(errors, 'CIM-EXP-006', `${path}.href`, 'Link href must resolve to http, https, mailto, root-relative, or fragment navigation.', 'semantic');
    });
  });
}

function v2SemanticErrors(experience, errors) {
  const steps = experience.steps; if (!isObject(experience.presentation)) return;
  const groups = []; const byId = new Map(); let previousBeatId = null; const closed = new Set();
  steps.forEach((step, index) => {
    if (!isObject(step) || !isObject(step.beat)) return; const beat = step.beat; const path = `$.steps[${index}]`;
    if (previousBeatId !== null && beat.id !== previousBeatId) closed.add(previousBeatId);
    if (closed.has(beat.id) && beat.id !== previousBeatId) addError(errors, 'CIM-EXP-009', `${path}.beat.id`, 'steps for one beat must be contiguous.', 'semantic');
    previousBeatId = beat.id;
    let group = byId.get(beat.id); if (!group) { group = { id: beat.id, ordinal: beat.ordinal, heading: beat.heading, segmentCount: beat.segment_count, steps: [] }; byId.set(beat.id, group); groups.push(group); }
    else {
      if (group.ordinal !== beat.ordinal) addError(errors, 'CIM-EXP-009', `${path}.beat.ordinal`, 'one beat id must map to one ordinal.', 'semantic');
      if (group.heading !== beat.heading) addError(errors, 'CIM-EXP-009', `${path}.beat.heading`, 'one beat id must map to one heading.', 'semantic');
      if (group.segmentCount !== beat.segment_count) addError(errors, 'CIM-EXP-009', `${path}.beat.segment_count`, 'segment_count must be consistent within a beat.', 'semantic');
    }
    group.steps.push({ step, index });
    const generated = typeof step.id === 'string' ? step.id.match(GENERATED_STEP_ID_PATTERN) : null;
    if (generated) { const suffix = Number(generated[2]); if (suffix === 0 || suffix !== beat.segment_ordinal || generated[1] !== beat.id) addError(errors, 'CIM-EXP-010', `${path}.id`, 'generated step id must use its beat id and match segment_ordinal 01 through 99.', 'semantic'); }
  });
  groups.forEach((group, groupIndex) => {
    const expectedOrdinal = groupIndex + 1;
    if (group.ordinal !== expectedOrdinal) addError(errors, 'CIM-EXP-009', `$.steps[${group.steps[0].index}].beat.ordinal`, `beat ordinal must be contiguous; expected ${expectedOrdinal}.`, 'semantic');
    const finals = group.steps.filter(({ step }) => step.beat.final === true);
    if (finals.length !== 1) addError(errors, 'CIM-EXP-011', `$.steps[${group.steps[0].index}].beat.final`, 'exactly one final boundary is required per beat.', 'semantic');
    group.steps.forEach(({ step, index }, segmentIndex) => { const expected = segmentIndex + 1; if (step.beat.segment_ordinal !== expected) addError(errors, 'CIM-EXP-009', `$.steps[${index}].beat.segment_ordinal`, `segment ordinal must be contiguous; expected ${expected}.`, 'semantic'); });
    if (group.segmentCount !== group.steps.length) addError(errors, 'CIM-EXP-009', `$.steps[${group.steps[0].index}].beat.segment_count`, 'segment_count must equal the number of boundaries in the beat.', 'semantic');
    if (finals.length === 1) { const { step, index } = finals[0]; if (step.beat.segment_ordinal !== step.beat.segment_count) addError(errors, 'CIM-EXP-011', `$.steps[${index}].beat.final`, 'final boundary must have segment_ordinal equal to segment_count.', 'semantic'); }
  });
  if (Number.isInteger(experience.presentation.beat_count) && experience.presentation.beat_count !== groups.length) addError(errors, 'CIM-EXP-012', '$.presentation.beat_count', 'must equal the number of distinct beats.', 'semantic');
}

function semanticErrorsFor(experience) {
  const errors = []; if (!isObject(experience) || !Array.isArray(experience.steps)) return errors;
  commonSemanticErrors(experience, errors); if (experience.schema === EXPERIENCE_SCHEMA_V2) v2SemanticErrors(experience, errors); return errors;
}
export function validateExperience(experience) { return Object.freeze([...structuralErrorsFor(experience), ...semanticErrorsFor(experience)]); }
