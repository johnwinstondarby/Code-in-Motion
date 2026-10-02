// console/v1 renderer (docs/renderers/CONSOLE-RENDERER-v1.md).
//
// Stable output is a pure function of (destination state, rendererConfig): no earlier boundary,
// wall clock, randomness, or DOM history participates (RENDERER-CONTRACT §9; CONSOLE-RENDERER-v1 §5).
//
// R42 slice 3 adds timed presentation for forward arrivals: command typing, output reveal, and
// response entry, driven only by the transition-scoped clock facade (RENDERER-CONTRACT §6). The
// final frame of every animation is the exact stable output, so animation changes the path to a
// destination and never the destination. Every other arrival settles directly.

import { RendererCancelledError } from '../../interface.mjs';
import { assertConsoleRendererInput, CONSOLE_RENDERER_ID } from './validate-console-input.mjs';

// CONSOLE-RENDERER-v1 §4.2: labels are derived from levels; they are never authored.
export const CONSOLE_RISK_LABELS = Object.freeze({
  'free-to-undo': 'FREE TO UNDO',
  'leaves-a-trace': 'LEAVES A TRACE',
  'cannot-be-undone': 'CANNOT BE UNDONE'
});

// Renderer-owned presentation timing at 1.0x, in virtual CiM milliseconds (CONSOLE-RENDERER-v1
// §4.5). Playback-rate dilation belongs to Runtime's clock (Playback Rate ADR, deferred).
export const CONSOLE_ANIMATION_TIMING = Object.freeze({
  typeCharMs: 45,
  enterMs: 350,
  firstOutputLineMs: 250,
  outputLineMs: 90,
  responsePauseMs: 500
});

// The Player-supplied separator between an interactive prompt and its response (§4.3).
const RESPONSE_SEPARATOR = ' ';
const PROMPT_SEPARATOR = ' ';

function assertRoot(root) {
  if (!root || typeof root !== 'object' || root.nodeType !== 1) {
    throw new TypeError('console renderer mount requires an element root.');
  }
  const document = root.ownerDocument;
  if (!document || typeof document.createElement !== 'function' || typeof document.createTextNode !== 'function') {
    throw new TypeError('console renderer root must expose an ownerDocument with createElement and createTextNode.');
  }
  if (typeof root.replaceChildren !== 'function') {
    throw new TypeError('console renderer root must support replaceChildren().');
  }
}

function element(document, localName, attributes = [], children = []) {
  const node = document.createElement(localName);
  for (const [name, value] of attributes) node.setAttribute(name, value);
  for (const child of children) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

// D1 (visual-DOM audit): one cursor per state, at a position derived from state alone.
function cursor(document) {
  return element(document, 'span', [['data-role', 'cursor'], ['aria-hidden', 'true']]);
}

// The cursor's position, a pure function of the transcript (CONSOLE-RENDERER-v1 §4.7):
//   'ready'    empty transcript, or the last entry is complete (output revealed and not
//              awaiting, or a response is present)
//   'awaiting' the last entry's interactive prompt awaits its response
//   'command'  the last entry has no revealed output; its command is pending (V2 limitation)
export function cursorPlacement(transcript) {
  if (transcript.length === 0) return 'ready';
  const last = transcript[transcript.length - 1];
  if (last.awaiting_response === true) return 'awaiting';
  if (last.output !== undefined || last.response !== undefined) return 'ready';
  return 'command';
}

function commandLine(document, entry, prompt, withCursor) {
  const children = [];
  if (entry.risk !== undefined) {
    children.push(element(document, 'span', [['data-role', 'risk-mark'], ['data-risk', entry.risk], ['aria-hidden', 'true']]));
  }
  children.push(element(document, 'span', [['data-role', 'prompt']], [prompt]));
  children.push(element(document, 'span', [['data-role', 'prompt-separator'], ['aria-hidden', 'true']], [PROMPT_SEPARATOR]));
  children.push(element(document, 'span', [['data-role', 'command']], [entry.command]));
  if (withCursor) children.push(cursor(document));
  // §4.4: inert copy control. It carries the resolved value as data; the renderer performs no
  // clipboard write or announcement. A Player-level handler owns both.
  children.push(element(document, 'button', [
    ['type', 'button'],
    ['data-role', 'copy'],
    ['data-copy', entry.copy],
    ['aria-label', `Copy command: ${entry.copy}`]
  ], ['Copy']));
  return element(document, 'div', [['data-role', 'command-line']], children);
}

function outputLine(document, line, focused, interactive) {
  const attributes = [['data-role', 'output-line'], ['data-tone', line.tone]];
  if (line.id !== undefined) attributes.push(['data-output-id', line.id]);
  if (focused) attributes.push(['data-focused', 'true']);
  const children = [element(document, 'span', [['data-role', 'output-text']], [line.text])];
  if (interactive?.awaiting) {
    attributes.push(['data-awaiting-response', 'true']);
    if (interactive.withCursor) children.push(cursor(document));
  } else if (interactive?.response !== undefined) {
    children.push(element(document, 'span', [['data-role', 'response-separator'], ['aria-hidden', 'true']], [RESPONSE_SEPARATOR]));
    children.push(element(document, 'span', [['data-role', 'response']], [interactive.response]));
  }
  return element(document, 'div', attributes, children);
}

function transcriptEntry(document, entry, config, focus, placement) {
  const prompt = entry.prompt ?? config.prompt;
  const children = [commandLine(document, entry, prompt, placement === 'command')];
  if (entry.output !== undefined) {
    const last = entry.output.length - 1;
    entry.output.forEach((line, index) => {
      const interactive = index === last && (entry.awaiting_response === true || entry.response !== undefined)
        ? { awaiting: entry.awaiting_response === true, response: entry.response, withCursor: placement === 'awaiting' }
        : null;
      children.push(outputLine(document, line, line.id !== undefined && focus.has(line.id), interactive));
    });
  }
  const attributes = [['data-role', 'entry'], ['data-beat', entry.beat]];
  if (entry.typing === false) attributes.push(['data-typing', 'false']);
  return element(document, 'div', attributes, children);
}

// D2 (visual-DOM audit): the fresh prompt that follows a completed command, and the opening
// prompt. V3: it uses the last entry's effective prompt, or renderer_config.prompt at initial.
function readyLine(document, prompt) {
  const children = [];
  if (prompt !== undefined) {
    children.push(element(document, 'span', [['data-role', 'prompt']], [prompt]));
    children.push(element(document, 'span', [['data-role', 'prompt-separator'], ['aria-hidden', 'true']], [PROMPT_SEPARATOR]));
  }
  children.push(cursor(document));
  return element(document, 'div', [['data-role', 'ready-line']], children);
}

function buildOutput(document, state, config, stepId, placementOverride) {
  const transcript = state.transcript;
  const last = transcript.length > 0 ? transcript[transcript.length - 1] : undefined;
  const lastRisk = last?.risk;
  const titleChildren = [element(document, 'span', [['data-role', 'title']], [config.title ?? ''])];
  if (lastRisk !== undefined) {
    titleChildren.push(element(document, 'span', [['data-role', 'risk-badge'], ['data-risk', lastRisk]], [CONSOLE_RISK_LABELS[lastRisk]]));
  }
  // D3 (visual-DOM audit): the title bar carries the current risk so its tint needs no :has().
  const headerAttributes = [['data-role', 'titlebar']];
  if (lastRisk !== undefined) headerAttributes.push(['data-risk', lastRisk]);

  const focus = new Set(state.focus);
  const placement = placementOverride === undefined ? cursorPlacement(transcript) : placementOverride;
  const lines = transcript.map((entry, index) =>
    transcriptEntry(document, entry, config, focus, index === transcript.length - 1 ? placement : null));
  if (placement === 'ready') lines.push(readyLine(document, last === undefined ? config.prompt : (last.prompt ?? config.prompt)));

  return element(document, 'section', [
    ['data-cim-renderer', CONSOLE_RENDERER_ID],
    ['data-step', stepId]
  ], [
    element(document, 'header', headerAttributes, titleChildren),
    element(document, 'div', [['data-role', 'transcript']], lines)
  ]);
}

function buildStableOutput(document, state, config, stepId) {
  return buildOutput(document, state, config, stepId, undefined);
}

// ---- forward-delta animation plan ----------------------------------------------------------

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Fields of a transcript entry that cannot change while its phase advances.
const PHASE_INVARIANT_FIELDS = Object.freeze(['beat', 'prompt', 'command', 'copy', 'typing', 'risk']);

function phaseOf(entry) {
  if (entry.response !== undefined) return 2;
  if (entry.output !== undefined) return 1;
  return 0;
}

// Returns the timed frames from `from` to `to`, or null when the arrival is not a forward delta
// (reverse, jump, focus-only, or non-canonical producer data). Each frame is { delayMs, state,
// placement }, where placement 'none' suppresses the cursor and ready line mid-animation. The
// caller always finishes with the exact stable output; frames only describe the path.
export function consoleAnimationFrames(from, to) {
  if (from === null || !Array.isArray(from.transcript)) return null;
  const f = from.transcript.length;
  const t = to.transcript.length;
  let entry;
  let startPhase;
  if (t === f + 1) {
    for (let i = 0; i < f; i += 1) if (!sameJson(from.transcript[i], to.transcript[i])) return null;
    entry = to.transcript[f];
    startPhase = -1;
  } else if (t === f && f > 0) {
    for (let i = 0; i < f - 1; i += 1) if (!sameJson(from.transcript[i], to.transcript[i])) return null;
    const before = from.transcript[f - 1];
    entry = to.transcript[f - 1];
    // Every phase-invariant field must be identical; only the phase may advance.
    for (const key of PHASE_INVARIANT_FIELDS) if (!sameJson(before[key], entry[key])) return null;
    startPhase = phaseOf(before);
    if (phaseOf(entry) <= startPhase) return null;
    // Output already revealed must be preserved exactly when advancing to the response.
    if (startPhase >= 1 && !sameJson(before.output, entry.output)) return null;
  } else {
    return null;
  }

  const timing = CONSOLE_ANIMATION_TIMING;
  const prefix = to.transcript.slice(0, to.transcript.length - 1);
  const frames = [];
  const frame = (delayMs, partial, placement) =>
    frames.push({ delayMs, state: { transcript: [...prefix, partial], focus: [] }, placement });
  const base = { ...entry };
  delete base.output; delete base.awaiting_response; delete base.response;

  if (startPhase < 0) {
    if (entry.typing === false) {
      frame(0, base, 'command');
    } else {
      frame(0, { ...base, command: '' }, 'command');
      for (let k = 1; k <= entry.command.length; k += 1) frame(timing.typeCharMs, { ...base, command: entry.command.slice(0, k) }, 'command');
    }
  }
  const finalPhase = phaseOf(entry);
  if (startPhase < 1 && entry.output !== undefined) {
    entry.output.forEach((_, index) => {
      const delay = index === 0 ? (startPhase < 0 ? timing.enterMs : timing.firstOutputLineMs) : timing.outputLineMs;
      frame(delay, { ...base, output: entry.output.slice(0, index + 1) }, 'none');
    });
  }
  if (startPhase < 2 && finalPhase === 2) {
    const awaiting = { ...base, output: entry.output, awaiting_response: true };
    if (startPhase < 1) frame(timing.firstOutputLineMs, awaiting, 'awaiting');
    for (let k = 1; k <= entry.response.length; k += 1) {
      frame(k === 1 ? timing.responsePauseMs : timing.typeCharMs, { ...base, output: entry.output, response: entry.response.slice(0, k) }, 'none');
    }
  }
  return frames;
}

export function createConsoleRenderer() {
  let root = null;
  let disposed = false;
  let generation = 0;   // renderer-side stale-callback guard, in addition to facade revocation

  function mount(context) {
    if (!context || typeof context !== 'object') throw new TypeError('console renderer mount context must be an object.');
    assertRoot(context.root);
    root = context.root;
    disposed = false;
    return undefined;
  }

  function render(state, context) {
    if (disposed) return Promise.reject(new Error('console renderer is disposed.'));
    if (!root) return Promise.reject(new Error('console renderer must be mounted before render().'));
    if (context.abortSignal.aborted) return Promise.reject(new RendererCancelledError(context.abortSignal.reason));
    generation += 1;
    const token = generation;
    try {
      // §6: validate before any DOM work; reject rather than repair. The previous stable view is
      // left untouched, so Runtime's CIM-RND-004 restoration starts from a coherent DOM.
      assertConsoleRendererInput(state, context.rendererConfig, context.stepRendererConfig);
    } catch (error) {
      return Promise.reject(error);
    }
    const document = root.ownerDocument;
    const config = context.rendererConfig ?? {};
    const settleStable = () => root.replaceChildren(buildStableOutput(document, state, config, context.stepId));

    const frames = context.animate === true && context.reducedMotion !== true
      ? consoleAnimationFrames(context.fromState, state)
      : null;
    if (frames === null || frames.length === 0) {
      settleStable();
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let pending = null;
      let finished = false;
      const live = () => !finished && !disposed && token === generation && root !== null;
      const finish = (outcome) => {
        if (finished) return;
        finished = true;
        unsubscribe();
        if (pending !== null) { try { context.clock.cancel(pending); } catch { /* facade already revoked */ } pending = null; }
        outcome();
      };
      const unsubscribe = context.abortSignal.onAbort((reason) => {
        finish(() => reject(new RendererCancelledError(reason)));
      });
      if (finished) return;
      // Frame i appears frames[i].delayMs after frame i-1 (or after render start, for frame 0).
      // The last planned frame is replaced by the exact stable output at the moment it is due, so
      // settlement adds no delay of its own. Only zero-delay frames apply synchronously.
      const show = (index) => {
        if (!live()) return;
        if (index === frames.length - 1) {
          settleStable();
          finish(resolve);
          return;
        }
        const { state: partial, placement } = frames[index];
        root.replaceChildren(buildOutput(document, partial, config, context.stepId, placement));
        arm(index + 1);
      };
      const arm = (index) => {
        if (frames[index].delayMs === 0) { show(index); return; }
        try {
          pending = context.clock.schedule(() => { pending = null; show(index); }, frames[index].delayMs);
        } catch (error) {
          finish(() => reject(error));
        }
      };
      arm(0);
    });
  }

  function dispose() {
    generation += 1;
    root = null;
    disposed = true;
  }

  return Object.freeze({ mount, render, dispose });
}

export { CONSOLE_RENDERER_ID };
