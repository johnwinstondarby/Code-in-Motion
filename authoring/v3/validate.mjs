import mediaSchema from './media.schema.json' with { type: 'json' };
import {validateMediaMap} from '../../src/multipane/media-map.mjs';
import authoringSchema from './authoring.schema.json' with { type: 'json' };
import captureSchema from './capture.schema.json' with { type: 'json' };
import packSchema from './pack.schema.json' with { type: 'json' };
import { findDuplicateKeys } from '../v2/validate-authoring.mjs';

export const LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, depth: 32, nodes: 100000, evidenceBytes: 2 * 1024 * 1024, archiveBytes: 16 * 1024 * 1024 });
export const SCHEMAS = Object.freeze({ authoring: authoringSchema, capture: captureSchema, pack: packSchema, media: mediaSchema });
export const RULES = Object.freeze({
  'CIM-V3-PARSE': 'Save valid UTF-8 JSON with double quotes and no trailing comma.',
  'CIM-V3-SHAPE': 'Use only the documented fields and types in the matching v3 schema.',
  'CIM-V3-LIMIT': 'Split the lesson or capture archive into smaller documents within the documented limits.',
  'CIM-V3-ID': 'Give each entry a distinct lowercase hyphenated ID; do not use initial as a beat ID.',
  'CIM-V3-PANE-TYPE': 'Use one registered Console, Explanation, Diagram and Motion pane, with distinct IDs.',
  'CIM-V3-INITIAL': 'Declare the documented starting state for this pane, including every artifact for Diagram.',
  'CIM-V3-EXPLANATION': 'Add one non-empty Explanation entry naming the declared Explanation pane.',
  'CIM-V3-ACTION-COUNT': 'Keep at most one CLI action or one GUI action in each beat; split repeated actions into beats.',
  'CIM-V3-SIMULTANEOUS': 'Split CLI and GUI activity into separate beats; their simultaneous behavior is not specified.',
  'CIM-V3-ACTION-TAB': 'Name the sole action pane in action_tab, or omit action_tab when neither pane acts.',
  'CIM-V3-CAPTURE-REFERENCE': 'Use a declared beat, pane, host, service, artifact, record and raw-evidence ID from this bundle.',
  'CIM-V3-DIAGRAM-STATE': 'Apply the referenced capture records in beat order and copy the derived complete Diagram state.',
  'CIM-V3-PLACEHOLDER': 'Set placeholder true throughout placeholder content and use Placeholder GUI · simulated instead of real-capture labels.',
  'CIM-V3-ARCHIVE-PATH': 'Use a relative archive path inside the capture folder, JSON basenames for linked documents, and no escaping symlinks.',
  'CIM-V3-EVIDENCE': 'Include the raw evidence file with its exact SHA-256 digest inside the declared archive.',
  'CIM-V3-PACK-VERSION': 'Declare a minimum of at least 1.1.0, a larger maximum no later than 2.0.0, using canonical release versions.',
  'CIM-V3-MEDIA-DEFERRED': 'Leave media.status deferred and media.assets empty until the media-placement contract is implemented.'
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
const stable = value => JSON.stringify(Array.isArray(value) ? value.map(v => JSON.parse(stable(v))) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(stable(value[k]))])) : value);
export const canonicalJSON = value => stable(value) + '\n';
export const safePath = value => typeof value === 'string' && value.length <= 200 && /^[a-zA-Z0-9_-]+(?:[./-][a-zA-Z0-9_-]+)*$/.test(value) && !value.split('/').some(p => p === '.' || p === '..') && !value.includes('\\');
export const jsonBasename = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+\.json$/.test(value);

function collector() {
  const diagnostics = [];
  function reject(id, condition, path, detail) {
    if (condition) diagnostics.push(Object.freeze({ id, severity: 'error', path, message: `${detail} Fix: ${RULES[id]}`, fix: RULES[id] }));
  }
  return { diagnostics, reject };
}

function read(source, c) {
  let value, text;
  try { text = typeof source === 'string' ? source : JSON.stringify(source); }
  catch { c.reject('CIM-V3-PARSE', true, '$', 'The document must contain only JSON data.'); return; }
  c.reject('CIM-V3-LIMIT', typeof text !== 'string' || Buffer.byteLength(text) > LIMITS.bytes, '$', 'Document exceeds 2 MiB.');
  if (c.diagnostics.length) return;
  try { value = JSON.parse(text); }
  catch { c.reject('CIM-V3-PARSE', true, '$', 'Malformed JSON.'); return; }
  let nodes = 0, bad = false;
  const visit = (v, depth) => {
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) { bad = true; return; }
    if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) {
      if (['__proto__', 'prototype', 'constructor'].includes(k)) c.reject('CIM-V3-SHAPE', true, '$', 'Reserved object key is not allowed.');
      if (bad) break;
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
  c.reject('CIM-V3-LIMIT', bad, '$', 'Document exceeds the nesting or node limit.');
  if (bad) return;
  for (const path of findDuplicateKeys(text)) c.reject('CIM-V3-ID', true, path, 'Duplicate JSON object key.');
  return value;
}

// This bounded evaluator implements exactly the keywords used by the four closed
// schemas. It has no remote references, executable keywords or installed dependencies.
function shape(value, schema, path, c, root = schema) {
  if (root.$id === 'cim.lesson-pack/v2' && path.startsWith('$.media') && !c.fixtureMedia) {
    const original = c;
    c = { ...c, reject: (id, condition, at, message) => original.reject('CIM-V3-MEDIA-DEFERRED', condition, at, message) };
  }
  if(schema.anyOf){
    const alternatives=schema.anyOf.map(branch=>{const errors=[];shape(value,branch,path,{reject:(id,condition,at,message)=>{if(condition)errors.push([id,at,message]);}},root);return errors;});
    if(alternatives.some(errors=>errors.length===0))return;
    const selected=schema.anyOf.findIndex(branch=>branch.properties?.status?.const!==undefined&&branch.properties.status.const===value?.status||branch.properties?.type?.const!==undefined&&branch.properties.type.const===value?.type);
    for(const[id,at,message]of alternatives[selected<0?0:selected])c.reject(id,true,at,message);return;
  }
  if(typeof value==='number')c.reject('CIM-V3-LIMIT',(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum),path,'Number exceeds the documented range.');
  if (schema.$ref) return shape(value, root.$defs[schema.$ref.split('/').at(-1)], path, c, root);
  const types = schema.type ? [schema.type].flat() : [];
  const matches = t => t === 'object' ? object(value) : t === 'array' ? Array.isArray(value) : t === 'null' ? value === null : t === 'integer' ? Number.isInteger(value) : typeof value === t;
  if (types.length && !types.some(matches)) { c.reject('CIM-V3-SHAPE', true, path, `Expected ${types.join(' or ')}.`); return; }
  c.reject('CIM-V3-SHAPE', own(schema, 'const') && value !== schema.const, path, 'Unexpected schema identifier or fixed value.');
  c.reject('CIM-V3-SHAPE', !!schema.enum && !schema.enum.includes(value), path, 'Value is not in the documented enumeration.');
  if (typeof value === 'string') {
    const length = [...value].length; // JSON Schema counts Unicode code points.
    c.reject('CIM-V3-LIMIT', schema.maxLength !== undefined && length > schema.maxLength, path, 'Text exceeds the field length limit.');
    c.reject('CIM-V3-SHAPE', (schema.minLength !== undefined && length < schema.minLength) || (!!schema.pattern && !new RegExp(schema.pattern, 'u').test(value)), path, 'Text does not match the documented form.');
  }
  if (Array.isArray(value)) {
    c.reject('CIM-V3-LIMIT', value.length > (schema.maxItems ?? Infinity), path, 'Array exceeds the entry limit.');
    c.reject('CIM-V3-SHAPE', value.length < (schema.minItems ?? 0), path, 'Required array is empty.');
    if (schema.items) value.slice(0, schema.maxItems ?? value.length).forEach((v, i) => shape(v, schema.items, `${path}[${i}]`, c, root));
  }
  if (object(value)) {
    for (const key of schema.required ?? []) {
      const id = key === 'initial_state' ? 'CIM-V3-INITIAL' : key === 'explanation' ? 'CIM-V3-EXPLANATION' : key === 'placeholder' ? 'CIM-V3-PLACEHOLDER' : 'CIM-V3-SHAPE';
      c.reject(id, !own(value, key), `${path}.${key}`, 'Required field is missing.');
    }
    c.reject('CIM-V3-LIMIT', Object.keys(value).length > (schema.maxProperties ?? Infinity), path, 'Object exceeds its entry limit.');
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && own(schema.properties, key)) shape(child, schema.properties[key], `${path}.${key}`, c, root);
      else if (schema.additionalProperties === false) c.reject('CIM-V3-SHAPE', true, `${path}.${key}`, 'Unknown field.');
      else if (object(schema.additionalProperties)) shape(child, schema.additionalProperties, `${path}.${key}`, c, root);
    }
  }
}

export function validateShape(value, schema) {
  const c = collector();
  shape(value, schema, '$', c);
  return c.diagnostics;
}

function unique(entries, path, c, key = null) {
  const ids = new Set();
  entries.forEach((v, i) => { const id = key ? v[key] : v; c.reject('CIM-V3-ID', ids.has(id), `${path}[${i}]${key ? '.' + key : ''}`, 'Duplicate ID.'); ids.add(id); });
}
function placeholder(doc, entries, path, c) {
  c.reject('CIM-V3-PLACEHOLDER', entries.some(e => e.provenance === 'placeholder') && !doc.placeholder, path, 'Placeholder content is not declared.');
}

function authoring(doc, c) {
  const paneTypes = ['console/v1', 'explanation/v1', 'diagram/v1', 'motion/v1'];
  unique(doc.panes, '$.panes', c, 'id'); unique(doc.beats, '$.beats', c, 'id'); unique(doc.hosts, '$.hosts', c); unique(doc.services, '$.services', c, 'id'); unique(doc.artifacts, '$.artifacts', c); unique(doc.media.asset_ids, '$.media.asset_ids', c);
  c.reject('CIM-V3-PANE-TYPE', paneTypes.some(type => doc.panes.filter(p => p.type === type).length !== 1), '$.panes', 'The initial layout requires one of each of the four pane types.');
  if (doc.panes.some(p => !paneTypes.includes(p.type))) {
    doc.panes.forEach((p, i) => c.reject('CIM-V3-PANE-TYPE', !paneTypes.includes(p.type), `$.panes[${i}].type`, 'Unknown registered pane type.'));
    return;
  }
  const panes = new Map(doc.panes.map(p => [p.id, p]));
  doc.panes.forEach((p, i) => {
    c.reject('CIM-V3-PANE-TYPE', !paneTypes.includes(p.type), `$.panes[${i}].type`, 'Unknown registered pane type.');
    const s = p.initial_state;
    if (!object(s)) return; // The schema reports missing/invalid initial state.
    const keys = { 'console/v1': ['lines'], 'explanation/v1': ['text'], 'motion/v1': ['frame'], 'diagram/v1': ['artifacts'] }[p.type];
    c.reject('CIM-V3-INITIAL', !!keys && (Object.keys(s).some(k => !keys.includes(k)) || keys.some(k => !own(s, k))), `$.panes[${i}].initial_state`, 'Incomplete or unknown starting-state field.');
    c.reject('CIM-V3-INITIAL', p.type === 'console/v1' && (!Array.isArray(s.lines) || s.lines.length > 128 || s.lines.some(l => typeof l !== 'string' || l.length > 16384)), `$.panes[${i}].initial_state`, 'Console starts with a bounded list of lines.');
    c.reject('CIM-V3-INITIAL', p.type === 'explanation/v1' && (typeof s.text !== 'string' || !s.text.trim() || s.text.length > 16384), `$.panes[${i}].initial_state`, 'Explanation needs starting text.');
    c.reject('CIM-V3-INITIAL', p.type === 'motion/v1' && s.frame !== null, `$.panes[${i}].initial_state`, 'Motion starts with a null frame; media placement is deferred.');
    if (p.type === 'diagram/v1') {
      c.reject('CIM-V3-INITIAL', !object(s.artifacts) || stable(Object.keys(s.artifacts).sort()) !== stable([...doc.artifacts].sort()), `$.panes[${i}].initial_state`, 'Declare every artifact in the initial Diagram.');
      if (object(s.artifacts)) for (const [id, value] of Object.entries(s.artifacts)) c.reject('CIM-V3-INITIAL', !object(value) || value.location !== null || value.status !== 'absent' || Object.keys(value).length !== 2, `$.panes[${i}].initial_state.artifacts.${id}`, 'Artifacts start absent at no service.');
    }
  });
  c.reject('CIM-V3-ARCHIVE-PATH', !jsonBasename(doc.capture.file), '$.capture.file', 'Capture reference must be a JSON basename beside the source.');
  doc.services.forEach((s, i) => c.reject('CIM-V3-CAPTURE-REFERENCE', !doc.hosts.includes(s.host), `$.services[${i}].host`, 'Host is not declared.'));
  doc.beats.forEach((b, i) => {
    const path = `$.beats[${i}]`;
    if (!object(b.explanation)) return; // The schema reports the missing entry.
    c.reject('CIM-V3-ID', b.id === 'initial', path + '.id', 'initial is reserved.');
    c.reject('CIM-V3-EXPLANATION', !b.explanation.text.trim() || panes.get(b.explanation.pane)?.type !== 'explanation/v1', path + '.explanation', 'Explanation is empty or names the wrong pane.');
    unique(b.explanation.links, path + '.explanation.links', c, 'id');
    const cli = b.actions.filter(a => a.kind === 'cli'), gui = b.actions.filter(a => a.kind === 'gui');
    c.reject('CIM-V3-ACTION-COUNT', cli.length > 1 || gui.length > 1, path + '.actions', 'An action kind is repeated in the beat.');
    c.reject('CIM-V3-SIMULTANEOUS', !!cli.length && !!gui.length, path + '.actions', 'CLI and GUI act simultaneously.');
    c.reject('CIM-V3-ACTION-TAB', b.actions.length === 0 ? own(b, 'action_tab') : !b.action_tab || b.action_tab !== b.actions[0].pane, path + '.action_tab', 'The action tab does not agree with the beat.');
    c.reject('CIM-V3-CAPTURE-REFERENCE', panes.get(b.engineering.pane)?.type !== 'diagram/v1', path + '.engineering.pane', 'Engineering must reference the Diagram pane.');
    unique(b.engineering.records, path + '.engineering.records', c);
    b.actions.forEach((a, j) => {
      const ap = `${path}.actions[${j}]`;
      c.reject('CIM-V3-CAPTURE-REFERENCE', panes.get(a.pane)?.type !== (a.kind === 'cli' ? 'console/v1' : 'motion/v1'), ap + '.pane', 'Action names an undeclared or mismatched pane.');
      c.reject('CIM-V3-SHAPE', a.kind === 'cli' ? typeof a.command !== 'string' || !Array.isArray(a.output) || ['asset','alt','label'].some(k => own(a, k)) : !a.asset || !a.alt || !a.label || ['command','output'].some(k => own(a, k)), ap, 'Action fields do not match its kind.');
      c.reject('CIM-V3-CAPTURE-REFERENCE', a.kind === 'gui' && !doc.media.asset_ids.includes(a.asset), ap + '.asset', 'GUI asset ID is not declared.');
      c.reject('CIM-V3-PLACEHOLDER', a.kind === 'gui' && (doc.placeholder ? a.label !== 'Placeholder GUI · simulated' : a.label !== 'Recorded in the lab'), ap + '.label', 'The media label misstates its provenance.');
      c.reject('CIM-V3-PLACEHOLDER', !doc.placeholder && /placeholder|simulated/i.test([a.command, a.label, ...(a.output ?? [])].join(' ')), ap, 'Placeholder markers conflict with real-capture mode.');
    });
    placeholder(doc, b.actions, path + '.actions', c);
  });
}

function capture(doc, c) {
  unique(doc.archive.files, '$.archive.files', c, 'id'); unique(doc.archive.files, '$.archive.files', c, 'path'); unique(doc.records, '$.records', c, 'id');
  c.reject('CIM-V3-ARCHIVE-PATH', !safePath(doc.archive.root), '$.archive.root', 'Archive root must be a confined relative path.');
  doc.archive.files.forEach((f, i) => c.reject('CIM-V3-ARCHIVE-PATH', !safePath(f.path), `$.archive.files[${i}].path`, 'Evidence path escapes the declared archive.'));
  const files = new Set(doc.archive.files.map(f => f.id));
  doc.records.forEach((r, i) => {
    c.reject('CIM-V3-CAPTURE-REFERENCE', !files.has(r.evidence), `$.records[${i}].evidence`, 'Raw evidence ID is not in the archive.');
    const file = doc.archive.files.find(f => f.id === r.evidence);
    c.reject('CIM-V3-PLACEHOLDER', !!file && file.provenance !== r.provenance, `$.records[${i}].provenance`, 'Record and raw file provenance disagree.');
  });
  placeholder(doc, [...doc.records, ...doc.archive.files], '$.placeholder', c);
}

function pack(doc, c) {
  unique(doc.lessons, '$.lessons', c, 'id'); unique(doc.lessons, '$.lessons', c, 'file');
  const release = v => /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(v) && v.split('.').every(n => Number.isSafeInteger(Number(n)));
  const compare = (a, b) => { for (let i = 0; i < 3; i++) { const d = Number(a.split('.')[i]) - Number(b.split('.')[i]); if (d) return d; } return 0; };
  c.reject('CIM-V3-PACK-VERSION', !release(doc.cim_min) || !release(doc.cim_max_exclusive) || compare(doc.cim_min, '1.1.0') < 0 || compare(doc.cim_max_exclusive, '2.0.0') > 0 || compare(doc.cim_min, doc.cim_max_exclusive) >= 0, '$.cim_min', 'Pack version interval cannot claim unsupported hosts.');
  doc.lessons.forEach((l, i) => c.reject('CIM-V3-ARCHIVE-PATH', !jsonBasename(l.file) || !jsonBasename(l.capture), `$.lessons[${i}]`, 'Lesson and capture files must be JSON basenames.'));
  if(doc.media.status==='fixture'){c.diagnostics.push(...validateMediaMap(doc.media).map(d=>({...d,path:'$.media'+d.path.slice(1)})));c.reject('CIM-V3-PLACEHOLDER',doc.media.placeholder!==doc.placeholder,'$.media.placeholder','Pack and media provenance disagree.');return;}
  c.reject('CIM-V3-MEDIA-DEFERRED', doc.media.status !== 'deferred' || doc.media.assets.length !== 0, '$.media', 'Media maps are reserved, not implemented.');
}

export function validateDocument(source, kind) {
  const c = collector(), value = read(source, c);c.fixtureMedia=kind==='pack'&&value?.media?.status==='fixture';
  if(value!==undefined&&!c.diagnostics.length&&(kind==='media'||kind==='pack'&&value?.media?.status==='fixture'))c.diagnostics.push(...validateMediaMap(kind==='media'?value:value.media).map(d=>({...d,path:kind==='media'?d.path:'$.media'+d.path.slice(1)})));
  if (value !== undefined && !c.diagnostics.length) shape(value, SCHEMAS[kind], '$', c);
  if (value !== undefined && !c.diagnostics.length) ({ authoring, capture, pack, media:()=>{} })[kind](value, c);
  return { value, diagnostics: c.diagnostics };
}

export function validateBundle(lesson, rawCapture) {
  const a = validateDocument(lesson, 'authoring'), b = validateDocument(rawCapture, 'capture');
  const c = collector(); c.diagnostics.push(...a.diagnostics, ...b.diagnostics.map(d => ({ ...d, path: '$capture' + d.path.slice(1) })));
  if (c.diagnostics.length) return { diagnostics: c.diagnostics };
  const doc = a.value, evidence = b.value;
  c.reject('CIM-V3-CAPTURE-REFERENCE', evidence.id !== doc.capture.id, '$.capture.id', 'Capture identity does not match.');
  c.reject('CIM-V3-PLACEHOLDER', doc.placeholder !== evidence.placeholder, '$capture.placeholder', 'Lesson and capture modes disagree.');
  const beats = new Set(doc.beats.map(b => b.id)), services = new Set(doc.services.map(s => s.id)), artifacts = new Set(doc.artifacts), panes = new Set(doc.panes.map(p => p.id));
  evidence.records.forEach((r, i) => c.reject('CIM-V3-CAPTURE-REFERENCE', !beats.has(r.beat) || !panes.has(r.pane) || !doc.hosts.includes(r.host) || !services.has(r.service) || !artifacts.has(r.artifact) || (r.from !== null && !services.has(r.from)), `$capture.records[${i}]`, 'Capture record names an unknown entity.'));
  const initial = doc.panes.find(p => p.type === 'diagram/v1').initial_state;
  const state = structuredClone(initial), records = new Map(evidence.records.map(r => [r.id, r])), used = new Set(), states = [];
  const status = { pin: 'pinned', fail: 'failed', complete: 'completed', publish: 'published', verify: 'verified', evaluate: 'reproduced' };
  doc.beats.forEach((beat, i) => {
    for (const id of beat.engineering.records) {
      const r = records.get(id), path = `$.beats[${i}].engineering.records`;
      c.reject('CIM-V3-CAPTURE-REFERENCE', !r || used.has(id) || r.beat !== beat.id || r.pane !== beat.engineering.pane, path, 'Capture record is missing, repeated or belongs to a different beat/pane.');
      if (!r || !artifacts.has(r.artifact)) continue;
      used.add(id);
      const prior = state.artifacts[r.artifact];
      c.reject('CIM-V3-DIAGRAM-STATE', r.from !== prior.location || r.result.location !== r.service || r.result.status !== (status[r.action] ?? prior.status) || (r.action === 'observe' && stable(r.result) !== stable(prior)) || (['verify','evaluate'].includes(r.action) && prior.status === 'absent'), path, 'Record result contradicts its source, action or destination.');
      state.artifacts[r.artifact] = structuredClone(r.result);
    }
    c.reject('CIM-V3-DIAGRAM-STATE', stable(state) !== stable(beat.engineering.state), `$.beats[${i}].engineering.state`, 'Claimed Diagram state differs from the capture-derived state.');
    states.push(structuredClone(state));
  });
  c.reject('CIM-V3-CAPTURE-REFERENCE', used.size !== evidence.records.length, '$capture.records', 'A capture record is not used by exactly one beat.');
  return { lesson: doc, capture: evidence, states, diagnostics: c.diagnostics };
}

export class V3ValidationError extends TypeError {
  constructor(diagnostics) { super(`${diagnostics.length} v3 validation error(s).`); this.diagnostics = diagnostics; }
}
export function assertValid(result) { if (result.diagnostics.length) throw new V3ValidationError(result.diagnostics); return result; }
