// Code in Motion authoring validator for localis.cim/authoring/v1 (Authoring JSON v1.0 candidate),
// including the compilation-driven corrections required by AUTHORING-TO-RUNTIME-v1 §17.5.
//
// Diagnostics use the authoring namespace (AUTHORING-TO-RUNTIME-v1 §1): CIM-AUTH-<RULE> errors and
// CIM-AUTH-LINT-<RULE> warnings. Named rule codes are disjoint from the numeric phase codes
// (CIM-AUTH-001..003) used by the .cim front-end. DIAGNOSTICS is the complete inventory, and the
// authoring fixture suite asserts that every entry is exercised.

export const SCHEMA_ID = 'localis.cim/authoring/v1';
export const TONES = ['normal', 'dim', 'accent', 'added', 'removed', 'warning'];
export const ANCHORS = ['command', 'output', 'response'];
export const RISK_LEVELS = ['free-to-undo', 'leaves-a-trace', 'cannot-be-undone']; // §18: no-risk beats omit risk
export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;                              // §3
export const LAYOUTS = ['console-explanation'];
export const RESERVED_BEAT_IDS = ['initial'];                                     // A2R §6
export const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export const PLAYBACK_RATE_RANGE = Object.freeze([0.5, 2.0]);                       // A2R §11
export const GENERIC_LABELS = ['click here', 'here', 'link', 'this link', 'this', 'more', 'read more', 'learn more'];
const ANCHOR_ORDER = { command: 0, output: 1, response: 2 };

// Complete diagnostic inventory: id -> [severity, specification section, summary]
export const DIAGNOSTICS = {
  'CIM-AUTH-PARSE':                           ['error', '§22', 'Malformed JSON'],
  'CIM-AUTH-DUPLICATE-KEY':                   ['error', '§1, §22', 'Object contains the same key more than once (JSON.parse would silently drop a value)'],
  'CIM-AUTH-SCHEMA-ID':                       ['error', '§2, §22', 'Incorrect schema identifier'],
  'CIM-AUTH-MISSING-FIELD':                   ['error', '§2, §6, §7, §8, §10, §11, §15, §18', 'Required field missing'],
  'CIM-AUTH-UNKNOWN-FIELD':                   ['error', '§1, §22', 'Property not defined by the closed v1 schema'],
  'CIM-AUTH-TYPE':                            ['error', '§2-§18', 'Field has the wrong type or range'],
  'CIM-AUTH-EMPTY-BEATS':                     ['error', '§2', 'beats is empty'],
  'CIM-AUTH-RESERVED-ID':                     ['error', 'A2R §6', 'Beat id "initial" is reserved'],
  'CIM-AUTH-VERSION':                         ['error', 'A2R §7', 'version is not Semantic Versioning text'],
  'CIM-AUTH-PLAYBACK-RATE':                   ['error', 'A2R §11', 'defaultPlaybackRate outside 0.5 through 2.0'],
  'CIM-AUTH-FINAL-ANCHOR':                    ['error', 'A2R §3', "Final segment anchor is not the beat's last Console phase"],
  'CIM-AUTH-INVALID-ID':                      ['error', '§3', 'Identifier is not lowercase kebab case'],
  'CIM-AUTH-DUPLICATE-BEAT-ID':               ['error', '§3', 'Beat id not unique'],
  'CIM-AUTH-DUPLICATE-OUTPUT-ID':             ['error', '§3', 'Output id not unique within the experience'],
  'CIM-AUTH-MISSING-PROMPT':                  ['error', '§4', 'No experience prompt and no beat override'],
  'CIM-AUTH-UNKNOWN-LAYOUT':                  ['error', '§5', 'Unrecognized presentation layout'],
  'CIM-AUTH-INVALID-COPY':                    ['error', '§7, §17', 'copy is not a non-empty string'],
  'CIM-AUTH-UNKNOWN-TONE':                    ['error', '§8', 'Unrecognized output tone'],
  'CIM-AUTH-TAB-CHARACTER':                   ['error', '§9', 'Tab character in Console text (output, command, prompt, response, copy)'],
  'CIM-AUTH-LINE-BREAK':                      ['error', '§9', 'Line break in Console text (output, command, prompt, response, copy)'],
  'CIM-AUTH-NO-SEGMENTS':                     ['error', '§10', 'Explanation has no segments'],
  'CIM-AUTH-UNKNOWN-ANCHOR':                  ['error', '§11', 'Unrecognized segment anchor'],
  'CIM-AUTH-SEGMENT-ORDER':                   ['error', '§11', 'Segments not in command → output → response order'],
  'CIM-AUTH-OUTPUT-ANCHOR-WITHOUT-OUTPUT':    ['error', '§11', 'Output segment in a beat with no output'],
  'CIM-AUTH-RESPONSE-ANCHOR-WITHOUT-RESPONSE':['error', '§11', 'Response segment in a beat with no response'],
  'CIM-AUTH-RESPONSE-WITHOUT-PROMPT':         ['error', '§12', 'Response with no preceding output'],
  'CIM-AUTH-FOCUS-UNKNOWN-TARGET':            ['error', '§13', 'Focus target matches no output id'],
  'CIM-AUTH-FOCUS-CROSS-BEAT':                ['error', '§13', 'Focus target belongs to another beat'],
  'CIM-AUTH-FOCUS-FUTURE-OUTPUT':             ['error', '§13', 'Focus on output not yet revealed (includes command-segment focus)'],
  'CIM-AUTH-REFERENCE-URL':                   ['error', '§15', 'Reference URL is not absolute HTTPS'],
  'CIM-AUTH-REFERENCE-LABEL':                 ['error', '§15', 'Generic reference label'],
  'CIM-AUTH-UNKNOWN-RISK-LEVEL':              ['error', '§18', 'Unrecognized authored risk level (including "none")'],
  'CIM-AUTH-LINT-FOCUS-BREADTH':                   ['warning', '§13', 'Segment focuses more than three targets'],
  'CIM-AUTH-LINT-TONE-DENSITY':                    ['warning', '§20', 'More than 25% of non-blank output lines use emphasis tones'],
};


const FIELDS = {
  root: ['schema', 'id', 'title', 'description', 'subject', 'version', 'console', 'presentation', 'beats'],
  consoleDefaults: ['title', 'prompt'],
  presentation: ['layout', 'defaultPlaybackRate'],                                  // C1: Player preferences removed
  beat: ['id', 'dwell', 'console', 'explanation', 'risk'],
  console: ['prompt', 'command', 'copy', 'typing', 'output', 'response'],
  output: ['id', 'text', 'tone'],
  explanation: ['heading', 'segments', 'references'],
  segment: ['at', 'text', 'focus'],
  reference: ['label', 'url'],
  risk: ['level', 'guidance'],                                                      // §18: label removed in v1
};


// Detects duplicate object keys, which JSON.parse silently resolves last-wins.
// Runs only on text that JSON.parse has already accepted, so the scan can assume valid JSON.
export function findDuplicateKeys(text) {
  const dups = [];
  const stack = []; // per object: { keys:Set, path, expectKey:boolean } ; arrays: { arr:true, path, index }
  let i = 0, lastKey = null;
  const pathOf = () => stack.map((f) => (f.arr ? `[${f.index}]` : f.key !== undefined ? `.${f.key}` : '')).join('');
  const readString = () => { let j = i + 1, out = ''; while (text[j] !== '"') { if (text[j] === '\\') { out += text.slice(j, j + 2); j += 2; } else out += text[j++]; } i = j + 1; return JSON.parse('"' + out + '"'); };
  while (i < text.length) {
    const c = text[i];
    if (c === '{') { stack.push({ keys: new Set(), expectKey: true }); i++; }
    else if (c === '[') { stack.push({ arr: true, index: 0 }); i++; }
    else if (c === '}' || c === ']') { stack.pop(); i++; }
    else if (c === ',') { const top = stack[stack.length - 1]; if (top.arr) top.index++; else top.expectKey = true; i++; }
    else if (c === ':') { stack[stack.length - 1].expectKey = false; i++; }
    else if (c === '"') {
      const top = stack[stack.length - 1];
      const str = readString();
      if (top && !top.arr && top.expectKey) {
        if (top.keys.has(str)) dups.push(`$${stack.slice(0, -1).map((f) => (f.arr ? `[${f.index}]` : `.${f.key}`)).join('')}.${str}`.replace('$.', '$.'));
        top.keys.add(str); top.key = str;
      }
    } else i++;
  }
  return dups;
}

export function validate(source) {
  const diags = [];
  const err = (id, path, message) => diags.push({ id, severity: 'error', path, message });
  const warn = (id, path, message) => diags.push({ id, severity: 'warning', path, message });

  let doc;
  try {
    doc = typeof source === 'string' ? JSON.parse(source) : source;
  } catch (e) {
    err('CIM-AUTH-PARSE', '$', `Document is not valid JSON: ${e.message}`);
    return diags;
  }
  if (typeof source === 'string') {
    for (const path of findDuplicateKeys(source)) err('CIM-AUTH-DUPLICATE-KEY', path, 'Duplicate key; JSON parsing would silently discard all but the last value.');
  }

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isStr = (v) => typeof v === 'string';
  const nonEmpty = (v) => isStr(v) && v.trim() !== '';

  // §9: Console text fields are single-line and tab-free
  const LINE_BREAK = /[\r\n\u2028\u2029]/;
  function checkConsoleText(value, path) {
    if (!isStr(value)) return;
    if (value.includes('\t')) err('CIM-AUTH-TAB-CHARACTER', path, 'Tab characters are prohibited in v1 Console text; use spaces.');
    if (LINE_BREAK.test(value)) err('CIM-AUTH-LINE-BREAK', path, 'Line breaks are prohibited in v1 Console text; each output entry is exactly one line.');
  }
  function checkId(value, path) {
    if (isStr(value) && value !== '' && !ID_PATTERN.test(value))
      err('CIM-AUTH-INVALID-ID', path, `Identifier "${value}" must be lowercase kebab case (${ID_PATTERN.source}).`);
  }
  function fields(obj, kind, path) {
    for (const k of Object.keys(obj)) {
      if (!FIELDS[kind].includes(k)) err('CIM-AUTH-UNKNOWN-FIELD', `${path}.${k}`, `Unrecognized field "${k}"; the v1 schema is closed.`);
    }
  }
  function need(obj, key, path, check, what) {
    if (!(key in obj)) { err('CIM-AUTH-MISSING-FIELD', `${path}.${key}`, `Required field "${key}" is missing.`); return false; }
    if (!check(obj[key])) { err('CIM-AUTH-TYPE', `${path}.${key}`, `"${key}" must be ${what}.`); return false; }
    return true;
  }
  function opt(obj, key, path, check, what) {
    if (key in obj && !check(obj[key])) { err('CIM-AUTH-TYPE', `${path}.${key}`, `"${key}" must be ${what}.`); return false; }
    return key in obj;
  }

  if (!isObj(doc)) { err('CIM-AUTH-TYPE', '$', 'Document root must be an object.'); return diags; }
  fields(doc, 'root', '$');

  // 1. schema identifier
  if (!('schema' in doc)) err('CIM-AUTH-MISSING-FIELD', '$.schema', 'Required field "schema" is missing.');
  else if (doc.schema !== SCHEMA_ID) err('CIM-AUTH-SCHEMA-ID', '$.schema', `schema must equal "${SCHEMA_ID}".`);

  // 2. required top-level fields
  for (const k of ['id', 'title', 'description', 'subject', 'version']) need(doc, k, '$', nonEmpty, 'a non-empty string');
  if (nonEmpty(doc.version) && !SEMVER_PATTERN.test(doc.version))
    err('CIM-AUTH-VERSION', '$.version', `version "${doc.version}" must be Semantic Versioning text such as "1.0.0".`);
  checkId(doc.id, '$.id');

  let defaultPrompt = null;
  if (need(doc, 'console', '$', isObj, 'an object')) {
    fields(doc.console, 'consoleDefaults', '$.console');
    opt(doc.console, 'title', '$.console', nonEmpty, 'a non-empty string');
    if (opt(doc.console, 'prompt', '$.console', nonEmpty, 'a non-empty string')) { defaultPrompt = doc.console.prompt; checkConsoleText(defaultPrompt, '$.console.prompt'); }
  }
  if (need(doc, 'presentation', '$', isObj, 'an object')) {
    const p = doc.presentation;
    fields(p, 'presentation', '$.presentation');
    if (need(p, 'layout', '$.presentation', isStr, 'a string') && !LAYOUTS.includes(p.layout))
      err('CIM-AUTH-UNKNOWN-LAYOUT', '$.presentation.layout', `Unknown layout "${p.layout}".`);
    if (opt(p, 'defaultPlaybackRate', '$.presentation', (v) => typeof v === 'number' && Number.isFinite(v), 'a finite number')
        && (p.defaultPlaybackRate < PLAYBACK_RATE_RANGE[0] || p.defaultPlaybackRate > PLAYBACK_RATE_RANGE[1]))
      err('CIM-AUTH-PLAYBACK-RATE', '$.presentation.defaultPlaybackRate', 'defaultPlaybackRate must be from 0.5 through 2.0 inclusive.');
  }

  if (!need(doc, 'beats', '$', Array.isArray, 'an array')) return diags;
  if (doc.beats.length === 0) { err('CIM-AUTH-EMPTY-BEATS', '$.beats', 'beats must contain at least one beat.'); return diags; }

  // Pass 1: beat ids and output ids across the whole experience (§3)
  const beatIds = new Map();
  const outputOwner = new Map(); // output id -> beat index
  doc.beats.forEach((beat, bi) => {
    if (!isObj(beat)) return;
    if (isStr(beat.id)) {
      if (beatIds.has(beat.id)) err('CIM-AUTH-DUPLICATE-BEAT-ID', `$.beats[${bi}].id`, `Beat id "${beat.id}" is already used by beats[${beatIds.get(beat.id)}].`);
      else beatIds.set(beat.id, bi);
    }
    const out = beat.console && Array.isArray(beat.console.output) ? beat.console.output : [];
    out.forEach((line, li) => {
      if (isObj(line) && 'id' in line && isStr(line.id)) {
        if (outputOwner.has(line.id)) err('CIM-AUTH-DUPLICATE-OUTPUT-ID', `$.beats[${bi}].console.output[${li}].id`, `Output id "${line.id}" is not unique within the experience.`);
        else outputOwner.set(line.id, bi);
      }
    });
  });

  // Pass 2: per-beat structure and semantics
  doc.beats.forEach((beat, bi) => {
    const bp = `$.beats[${bi}]`;
    if (!isObj(beat)) { err('CIM-AUTH-TYPE', bp, 'Each beat must be an object.'); return; }
    fields(beat, 'beat', bp);
    need(beat, 'id', bp, nonEmpty, 'a non-empty string');
    checkId(beat.id, `${bp}.id`);
    if (RESERVED_BEAT_IDS.includes(beat.id)) err('CIM-AUTH-RESERVED-ID', `${bp}.id`, `Beat id "${beat.id}" is reserved for the runtime's pre-instruction boundary.`);
    opt(beat, 'dwell', bp, (v) => Number.isInteger(v) && v >= 0, 'a non-negative integer (milliseconds)');

    // console (§6, §7)
    let output = [], hasResponse = false;
    if (need(beat, 'console', bp, isObj, 'an object')) {
      const c = beat.console, cp = `${bp}.console`;
      fields(c, 'console', cp);
      if (need(c, 'command', cp, nonEmpty, 'a non-empty string')) checkConsoleText(c.command, `${cp}.command`);
      if ('copy' in c && !nonEmpty(c.copy))                                  // §7, §17
        err('CIM-AUTH-INVALID-COPY', `${cp}.copy`, 'copy, when present, must be a non-empty string.');
      else if ('copy' in c) checkConsoleText(c.copy, `${cp}.copy`);
      opt(c, 'typing', cp, (v) => typeof v === 'boolean', 'a boolean');
      if (opt(c, 'prompt', cp, nonEmpty, 'a non-empty string')) checkConsoleText(c.prompt, `${cp}.prompt`);
      else if (defaultPrompt === null)
        err('CIM-AUTH-MISSING-PROMPT', `${cp}.prompt`, 'No prompt: define console.prompt at experience level or override it in this beat.');
      if (need(c, 'output', cp, Array.isArray, 'an array')) {
        output = c.output;
        output.forEach((line, li) => {
          const lp = `${cp}.output[${li}]`;
          if (!isObj(line)) { err('CIM-AUTH-TYPE', lp, 'Output entries must be {text, tone} objects.'); return; }
          fields(line, 'output', lp);
          if (need(line, 'text', lp, isStr, 'a string')) checkConsoleText(line.text, `${lp}.text`); // §8, §9
          if (need(line, 'tone', lp, isStr, 'a string') && !TONES.includes(line.tone))
            err('CIM-AUTH-UNKNOWN-TONE', `${lp}.tone`, `Unknown tone "${line.tone}". Recognized: ${TONES.join(', ')}.`); // §8
          if (opt(line, 'id', lp, nonEmpty, 'a non-empty string')) checkId(line.id, `${lp}.id`);
        });
      }
      if (opt(c, 'response', cp, nonEmpty, 'a non-empty string')) {
        hasResponse = true;
        checkConsoleText(c.response, `${cp}.response`);
        if (output.length === 0)                                         // §12
          err('CIM-AUTH-RESPONSE-WITHOUT-PROMPT', `${cp}.response`, 'A response requires output whose final line is the interactive prompt.');
      }
    }

    // explanation (§10, §11, §13, §15)
    if (need(beat, 'explanation', bp, isObj, 'an object')) {
      const e = beat.explanation, ep = `${bp}.explanation`;
      fields(e, 'explanation', ep);
      need(e, 'heading', ep, nonEmpty, 'a non-empty string');
      if (need(e, 'segments', ep, Array.isArray, 'an array')) {
        if (e.segments.length === 0) err('CIM-AUTH-NO-SEGMENTS', `${ep}.segments`, 'Every explanation needs at least one segment.');
        let lastOrder = -1;
        e.segments.forEach((seg, si) => {
          const sp = `${ep}.segments[${si}]`;
          if (!isObj(seg)) { err('CIM-AUTH-TYPE', sp, 'Segments must be objects.'); return; }
          fields(seg, 'segment', sp);
          need(seg, 'text', sp, nonEmpty, 'a non-empty string');
          let anchorOk = false;
          if (need(seg, 'at', sp, isStr, 'a string')) {
            if (!ANCHORS.includes(seg.at)) err('CIM-AUTH-UNKNOWN-ANCHOR', `${sp}.at`, `Unknown anchor "${seg.at}". Recognized: ${ANCHORS.join(', ')}.`);
            else {
              anchorOk = true;
              if (ANCHOR_ORDER[seg.at] < lastOrder)
                err('CIM-AUTH-SEGMENT-ORDER', `${sp}.at`, 'Segments must be ordered command, then output, then response.');
              lastOrder = Math.max(lastOrder, ANCHOR_ORDER[seg.at]);
              if (seg.at === 'response' && !hasResponse)
                err('CIM-AUTH-RESPONSE-ANCHOR-WITHOUT-RESPONSE', `${sp}.at`, 'A response-anchored segment requires console.response.');
              if (seg.at === 'output' && output.length === 0)
                err('CIM-AUTH-OUTPUT-ANCHOR-WITHOUT-OUTPUT', `${sp}.at`, 'An output-anchored segment requires console output.');
            }
          }
          if ('focus' in seg) {
            if (!Array.isArray(seg.focus) || !seg.focus.every(isStr)) { err('CIM-AUTH-TYPE', `${sp}.focus`, '"focus" must be an array of output id strings.'); return; }
            seg.focus.forEach((fid, fi) => {
              const fp = `${sp}.focus[${fi}]`;
              if (!outputOwner.has(fid)) err('CIM-AUTH-FOCUS-UNKNOWN-TARGET', fp, `Focus target "${fid}" does not match any output id.`);   // §13
              else if (outputOwner.get(fid) !== bi) err('CIM-AUTH-FOCUS-CROSS-BEAT', fp, `Focus target "${fid}" belongs to beats[${outputOwner.get(fid)}]; v1 focus is same-beat only.`); // §13
              else if (anchorOk && seg.at === 'command') err('CIM-AUTH-FOCUS-FUTURE-OUTPUT', fp, `A command-anchored segment cannot focus output "${fid}", which has not yet appeared.`); // §13
            });
            if (seg.focus.length > 3) warn('CIM-AUTH-LINT-FOCUS-BREADTH', `${sp}.focus`, `Segment focuses ${seg.focus.length} output lines; sparse emphasis recommends three or fewer.`);
          }
        });
        // A2R §3: the final segment must reach the beat's last Console phase, so the final
        // generated boundary is the complete settled destination without compiler inference.
        const last = e.segments[e.segments.length - 1];
        if (isObj(last) && ANCHORS.includes(last.at)) {
          const expected = hasResponse ? 'response' : output.length > 0 ? 'output' : 'command';
          if (ANCHOR_ORDER[last.at] < ANCHOR_ORDER[expected])
            err('CIM-AUTH-FINAL-ANCHOR', `${ep}.segments[${e.segments.length - 1}].at`,
              `The final segment is anchored to "${last.at}", but this beat's last Console phase is "${expected}".`);
        }
      }
      if (opt(e, 'references', ep, Array.isArray, 'an array')) {
        e.references.forEach((ref, ri) => {
          const rp = `${ep}.references[${ri}]`;
          if (!isObj(ref)) { err('CIM-AUTH-TYPE', rp, 'References must be objects.'); return; }
          fields(ref, 'reference', rp);
          if (need(ref, 'label', rp, nonEmpty, 'a non-empty string') && GENERIC_LABELS.includes(ref.label.trim().toLowerCase()))
            err('CIM-AUTH-REFERENCE-LABEL', `${rp}.label`, `Generic label "${ref.label}" does not describe the destination.`);   // §15
          if (need(ref, 'url', rp, isStr, 'a string')) {
            let ok = false;
            try { const u = new URL(ref.url); ok = u.protocol === 'https:' && u.hostname !== ''; } catch { ok = false; }
            if (!ok) err('CIM-AUTH-REFERENCE-URL', `${rp}.url`, `Reference URL must be an absolute HTTPS URL: "${ref.url}".`); // §15
          }
        });
      }
    }

    // risk (§18: presence means risk; label is Player-derived)
    if (opt(beat, 'risk', bp, isObj, 'an object')) {
      const r = beat.risk, rp = `${bp}.risk`;
      fields(r, 'risk', rp);
      if (need(r, 'level', rp, isStr, 'a string') && !RISK_LEVELS.includes(r.level))
        err('CIM-AUTH-UNKNOWN-RISK-LEVEL', `${rp}.level`, `Unknown risk level "${r.level}". Recognized: ${RISK_LEVELS.join(', ')}.`);
      opt(r, 'guidance', rp, nonEmpty, 'a non-empty string');
    }

    // lint: tone density over non-blank output lines
    const nonBlank = output.filter((l) => isObj(l) && isStr(l.text) && l.text.trim() !== '');
    const toned = nonBlank.filter((l) => TONES.includes(l.tone) && l.tone !== 'normal' && l.tone !== 'dim');
    if (nonBlank.length > 0 && toned.length / nonBlank.length > 0.25)
      warn('CIM-AUTH-LINT-TONE-DENSITY', `${bp}.console.output`, `${toned.length} of ${nonBlank.length} non-blank output lines use an emphasis tone (>25%).`);
  });

  return diags;
}
