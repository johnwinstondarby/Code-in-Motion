// console/v1 renderer-owned validation (docs/renderers/CONSOLE-RENDERER-v1.md §6).
//
// The Console renderer validates its configuration and every destination state it receives
// against §§2–3 before touching the DOM. A violation rejects the render with
// ConsoleRendererInputError, which Runtime reports through the existing renderer fault path
// (CIM-RND-004, recover by restoring the previous stable view). Nothing is repaired.
//
// Dependency-free by design: renderers may not depend on Core, Runtime, or authoring code.
// Producer-side conformance (authoring/v1/console-state-conformance.mjs) enforces the same
// contract on compiled output; tests/console-renderer-validation.test.mjs proves the two agree.

export const CONSOLE_RENDERER_ID = 'console/v1';
export const CONSOLE_TONES = Object.freeze(['normal', 'dim', 'accent', 'added', 'removed', 'warning']);
export const CONSOLE_RISK_LEVELS = Object.freeze(['free-to-undo', 'leaves-a-trace', 'cannot-be-undone']);
export const CONSOLE_VALIDATION_RULES = Object.freeze([
  'config-shape', 'config-unknown-key', 'config-value', 'step-config',
  'state-shape', 'state-unknown-key', 'state-missing-key',
  'entry-shape', 'entry-unknown-key', 'entry-missing-key', 'entry-value', 'prompt-unavailable',
  'response-exclusive', 'response-requires-output',
  'line-shape', 'line-unknown-key', 'line-missing-key', 'line-value',
  'output-id-unique', 'focus-shape', 'focus-duplicate', 'focus-target'
]);

const CONFIG_KEYS = ['title', 'prompt'];
const STATE_KEYS = ['transcript', 'focus'];
const ENTRY_KEYS = ['beat', 'prompt', 'command', 'copy', 'typing', 'risk', 'output', 'awaiting_response', 'response'];
const ENTRY_REQUIRED = ['beat', 'command', 'copy'];
const LINE_KEYS = ['id', 'text', 'tone'];
const LINE_REQUIRED = ['text', 'tone'];
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BREAKS = /[\t\r\n\u2028\u2029]/;

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isSingleLine = (value) => typeof value === 'string' && value.length > 0 && !BREAKS.test(value);

export class ConsoleRendererInputError extends Error {
  constructor(violations) {
    const first = violations[0];
    super(`console/v1 rejected renderer input: ${first.path}: ${first.message}${violations.length > 1 ? ` (+${violations.length - 1} more)` : ''}`);
    this.name = 'ConsoleRendererInputError';
    Object.defineProperty(this, 'violations', {
      value: Object.freeze(violations.map((violation) => Object.freeze({ ...violation }))),
      enumerable: true, configurable: false, writable: false
    });
  }
}

/**
 * Returns the §§2–3 violations for one render's input. An empty array means the input is valid.
 * Reads only; never mutates, and never inspects anything beyond the supplied arguments.
 */
export function consoleRendererInputViolations(state, rendererConfig, stepRendererConfig) {
  const violations = [];
  const add = (rule, path, message) => violations.push({ rule, path, message });
  const keys = (value, allowed, required, path, prefix) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) add(`${prefix}-unknown-key`, `${path}.${key}`, 'is not permitted by CONSOLE-RENDERER-v1');
    for (const key of required) if (!own(value, key)) add(`${prefix}-missing-key`, `${path}.${key}`, 'is required by CONSOLE-RENDERER-v1');
  };

  // §2 renderer configuration. Absent experience configuration arrives as null.
  let configPrompt = null;
  if (rendererConfig !== null) {
    if (!isRecord(rendererConfig)) add('config-shape', 'rendererConfig', 'must be an object or null');
    else {
      for (const key of Object.keys(rendererConfig)) if (!CONFIG_KEYS.includes(key)) add('config-unknown-key', `rendererConfig.${key}`, 'is not permitted by CONSOLE-RENDERER-v1 §2');
      if (own(rendererConfig, 'title') && typeof rendererConfig.title !== 'string') add('config-value', 'rendererConfig.title', 'must be a string');
      if (own(rendererConfig, 'prompt')) {
        if (isSingleLine(rendererConfig.prompt)) configPrompt = rendererConfig.prompt;
        else add('config-value', 'rendererConfig.prompt', 'must be a non-empty single line');
      }
    }
  }
  if (stepRendererConfig !== null) add('step-config', 'stepRendererConfig', 'console/v1 defines no step-level renderer configuration (§2)');

  // §3 state.
  if (!isRecord(state)) { add('state-shape', 'state', 'must be an object'); return violations; }
  for (const key of Object.keys(state)) if (!STATE_KEYS.includes(key)) add('state-unknown-key', `state.${key}`, 'is not permitted by CONSOLE-RENDERER-v1 §3');
  for (const key of STATE_KEYS) if (!own(state, key)) add('state-missing-key', `state.${key}`, 'is required by CONSOLE-RENDERER-v1 §3');
  const transcript = Array.isArray(state.transcript) ? state.transcript : null;
  if (own(state, 'transcript') && transcript === null) add('state-shape', 'state.transcript', 'must be an array');

  const outputIds = new Set();
  (transcript ?? []).forEach((entry, entryIndex) => {
    const path = `state.transcript[${entryIndex}]`;
    if (!isRecord(entry)) { add('entry-shape', path, 'must be an object'); return; }
    keys(entry, ENTRY_KEYS, ENTRY_REQUIRED, path, 'entry');
    if (own(entry, 'beat') && (typeof entry.beat !== 'string' || !IDENTIFIER.test(entry.beat))) add('entry-value', `${path}.beat`, 'must be a canonical identifier');
    for (const key of ['command', 'copy', 'prompt', 'response']) {
      if (own(entry, key) && !isSingleLine(entry[key])) add('entry-value', `${path}.${key}`, 'must be a non-empty single line');
    }
    if (!own(entry, 'prompt') && configPrompt === null) add('prompt-unavailable', `${path}.prompt`, 'no entry prompt and no rendererConfig.prompt');
    if (own(entry, 'typing') && entry.typing !== false) add('entry-value', `${path}.typing`, 'may only be false');
    if (own(entry, 'risk') && !CONSOLE_RISK_LEVELS.includes(entry.risk)) add('entry-value', `${path}.risk`, 'is not a recognized risk level');
    if (own(entry, 'awaiting_response') && entry.awaiting_response !== true) add('entry-value', `${path}.awaiting_response`, 'may only be true');

    const hasOutput = Array.isArray(entry.output) && entry.output.length > 0;
    if (own(entry, 'awaiting_response') && own(entry, 'response')) add('response-exclusive', path, 'awaiting_response and response are mutually exclusive (§3.2.1)');
    if ((own(entry, 'awaiting_response') || own(entry, 'response')) && !hasOutput) add('response-requires-output', path, 'an interactive prompt requires non-empty output (§3.2.1)');

    if (own(entry, 'output')) {
      if (!hasOutput) { add('entry-value', `${path}.output`, 'must be a non-empty array when present'); return; }
      entry.output.forEach((line, lineIndex) => {
        const linePath = `${path}.output[${lineIndex}]`;
        if (!isRecord(line)) { add('line-shape', linePath, 'must be an object'); return; }
        keys(line, LINE_KEYS, LINE_REQUIRED, linePath, 'line');
        if (own(line, 'text') && (typeof line.text !== 'string' || BREAKS.test(line.text))) add('line-value', `${linePath}.text`, 'must be a single line without tabs');
        if (own(line, 'tone') && !CONSOLE_TONES.includes(line.tone)) add('line-value', `${linePath}.tone`, 'is not a recognized tone');
        if (own(line, 'id')) {
          if (typeof line.id !== 'string' || !IDENTIFIER.test(line.id)) add('line-value', `${linePath}.id`, 'must be a canonical identifier');
          else if (outputIds.has(line.id)) add('output-id-unique', `${linePath}.id`, 'output ids must be unique across the state (§3.2.2)');
          else outputIds.add(line.id);
        }
      });
    }
  });

  if (own(state, 'focus')) {
    if (!Array.isArray(state.focus)) add('focus-shape', 'state.focus', 'must be an array');
    else {
      const seen = new Set();
      state.focus.forEach((id, index) => {
        const path = `state.focus[${index}]`;
        if (typeof id !== 'string') { add('focus-shape', path, 'must be an output id string'); return; }
        if (seen.has(id)) add('focus-duplicate', path, 'focus ids must not repeat (§3.2.4)');
        seen.add(id);
        if (!outputIds.has(id)) add('focus-target', path, `"${id}" names no output line in this state (§3.2.3)`);
      });
    }
  }
  return violations;
}

/** Throws ConsoleRendererInputError unless the input satisfies CONSOLE-RENDERER-v1 §§2–3. */
export function assertConsoleRendererInput(state, rendererConfig, stepRendererConfig) {
  const violations = consoleRendererInputViolations(state, rendererConfig, stepRendererConfig);
  if (violations.length > 0) throw new ConsoleRendererInputError(violations);
}
