// console/v1 renderer: stable absolute rendering (docs/renderers/CONSOLE-RENDERER-v1.md).
//
// R42 slice 2 scope. Every arrival settles directly to the destination's stable output. Animated
// arrivals are accepted, but timed presentation (typing, reveal) is slice 3; RENDERER-CONTRACT §9
// permits animate:true to change only the path, never the destination output.
//
// Output is a pure function of (destination state, rendererConfig): no earlier boundary, wall
// clock, randomness, or DOM history participates (RENDERER-CONTRACT §9; CONSOLE-RENDERER-v1 §5).

import { RendererCancelledError } from '../../interface.mjs';
import { assertConsoleRendererInput, CONSOLE_RENDERER_ID } from './validate-console-input.mjs';

// CONSOLE-RENDERER-v1 §4.2: labels are derived from levels; they are never authored.
export const CONSOLE_RISK_LABELS = Object.freeze({
  'free-to-undo': 'FREE TO UNDO',
  'leaves-a-trace': 'LEAVES A TRACE',
  'cannot-be-undone': 'CANNOT BE UNDONE'
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

function commandLine(document, entry, prompt) {
  const children = [];
  if (entry.risk !== undefined) {
    children.push(element(document, 'span', [['data-role', 'risk-mark'], ['data-risk', entry.risk], ['aria-hidden', 'true']]));
  }
  children.push(element(document, 'span', [['data-role', 'prompt']], [prompt]));
  children.push(element(document, 'span', [['data-role', 'prompt-separator'], ['aria-hidden', 'true']], [PROMPT_SEPARATOR]));
  children.push(element(document, 'span', [['data-role', 'command']], [entry.command]));
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
  } else if (interactive?.response !== undefined) {
    children.push(element(document, 'span', [['data-role', 'response-separator'], ['aria-hidden', 'true']], [RESPONSE_SEPARATOR]));
    children.push(element(document, 'span', [['data-role', 'response']], [interactive.response]));
  }
  return element(document, 'div', attributes, children);
}

function transcriptEntry(document, entry, config, focus) {
  const prompt = entry.prompt ?? config.prompt;
  const children = [commandLine(document, entry, prompt)];
  if (entry.output !== undefined) {
    const last = entry.output.length - 1;
    entry.output.forEach((line, index) => {
      const interactive = index === last && (entry.awaiting_response === true || entry.response !== undefined)
        ? { awaiting: entry.awaiting_response === true, response: entry.response }
        : null;
      children.push(outputLine(document, line, line.id !== undefined && focus.has(line.id), interactive));
    });
  }
  const attributes = [['data-role', 'entry'], ['data-beat', entry.beat]];
  if (entry.typing === false) attributes.push(['data-typing', 'false']);
  return element(document, 'div', attributes, children);
}

function buildStableOutput(document, state, config, stepId) {
  const lastRisk = state.transcript.length > 0 ? state.transcript[state.transcript.length - 1].risk : undefined;
  const titleChildren = [element(document, 'span', [['data-role', 'title']], [config.title ?? ''])];
  if (lastRisk !== undefined) {
    titleChildren.push(element(document, 'span', [['data-role', 'risk-badge'], ['data-risk', lastRisk]], [CONSOLE_RISK_LABELS[lastRisk]]));
  }
  const focus = new Set(state.focus);
  return element(document, 'section', [
    ['data-cim-renderer', CONSOLE_RENDERER_ID],
    ['data-step', stepId]
  ], [
    element(document, 'header', [['data-role', 'titlebar']], titleChildren),
    element(document, 'div', [['data-role', 'transcript']], state.transcript.map((entry) => transcriptEntry(document, entry, config, focus)))
  ]);
}

export function createConsoleRenderer() {
  let root = null;
  let disposed = false;

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
    try {
      // §6: validate before any DOM work; reject rather than repair. The previous stable view is
      // left untouched, so Runtime's CIM-RND-004 restoration starts from a coherent DOM.
      assertConsoleRendererInput(state, context.rendererConfig, context.stepRendererConfig);
      const output = buildStableOutput(root.ownerDocument, state, context.rendererConfig ?? {}, context.stepId);
      root.replaceChildren(output);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function dispose() {
    root = null;
    disposed = true;
  }

  return Object.freeze({ mount, render, dispose });
}

export { CONSOLE_RENDERER_ID };
