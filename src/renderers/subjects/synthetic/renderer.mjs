import { RendererCancelledError } from '../../interface.mjs';

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const RENDERER_ID = 'synthetic/v1';

function assertRoot(root) {
  if (!root || typeof root !== 'object' || root.nodeType !== 1) {
    throw new TypeError('synthetic renderer mount requires an element root.');
  }
  if (!root.ownerDocument || typeof root.ownerDocument.createElement !== 'function' || typeof root.ownerDocument.createTextNode !== 'function') {
    throw new TypeError('synthetic renderer root must expose an ownerDocument with createElement and createTextNode.');
  }
  if (typeof root.replaceChildren !== 'function') {
    throw new TypeError('synthetic renderer root must support replaceChildren().');
  }
}

function readState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('synthetic renderer state must be an object.');
  }
  if (typeof state.node !== 'string' || state.node.length === 0) {
    throw new TypeError('synthetic renderer state.node must be a non-empty string.');
  }
  if (state.detail !== undefined && typeof state.detail !== 'string') {
    throw new TypeError('synthetic renderer state.detail must be a string when present.');
  }
  return { node: state.node, detail: state.detail ?? '' };
}

function configString(config, key) {
  if (config === null) return '';
  const value = config[key];
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new TypeError(`synthetic renderer ${key} configuration must be a string when present.`);
  }
  return value;
}

function buildStableOutput(root, state, context) {
  const document = root.ownerDocument;
  const section = document.createElement('section');
  section.setAttribute('data-cim-renderer', RENDERER_ID);
  section.setAttribute('data-step', context.stepId);
  section.setAttribute('data-node', state.node);

  const label = document.createElement('span');
  label.setAttribute('data-role', 'label');
  const prefix = configString(context.rendererConfig, 'prefix');
  const suffix = configString(context.stepRendererConfig, 'suffix');
  label.replaceChildren(document.createTextNode(`${prefix}${state.node}${suffix}`));
  section.appendChild(label);

  if (state.detail.length > 0) {
    const detail = document.createElement('span');
    detail.setAttribute('data-role', 'detail');
    detail.replaceChildren(document.createTextNode(state.detail));
    section.appendChild(detail);
  }

  return section;
}

export function createSyntheticRenderer({ animationFrames = 2 } = {}) {
  if (!Number.isInteger(animationFrames) || animationFrames < 1) {
    throw new RangeError('synthetic renderer animationFrames must be a positive integer.');
  }

  let root = null;
  let disposed = false;
  let activeCleanup = null;

  function mount(context) {
    if (!context || typeof context !== 'object') {
      throw new TypeError('synthetic renderer mount context must be an object.');
    }
    assertRoot(context.root);
    root = context.root;
    disposed = false;
    return undefined;
  }

  function render(stateInput, context) {
    if (disposed) return Promise.reject(new Error('synthetic renderer is disposed.'));
    if (!root) return Promise.reject(new Error('synthetic renderer must be mounted before render().'));

    const state = readState(stateInput);
    const settle = () => root.replaceChildren(buildStableOutput(root, state, context));

    if (context.abortSignal.aborted) {
      return Promise.reject(new RendererCancelledError(context.abortSignal.reason));
    }

    if (!context.animate || context.reducedMotion) {
      settle();
      return Promise.resolve();
    }

    if (activeCleanup) {
      return Promise.reject(new Error('synthetic renderer already has an active render.'));
    }

    return new Promise((resolve, reject) => {
      let frameHandle = null;
      let frameCount = 0;
      let finished = false;
      let unsubscribeAbort = () => false;
      let cancelForDispose = null;

      const cleanup = () => {
        if (frameHandle !== null) context.clock.cancel(frameHandle);
        unsubscribeAbort();
        frameHandle = null;
        if (activeCleanup === cancelForDispose) activeCleanup = null;
      };

      const rejectCancelled = (reason) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new RendererCancelledError(reason));
      };

      cancelForDispose = () => {
        if (finished) return false;
        finished = true;
        cleanup();
        reject(new RendererCancelledError('disposed'));
        return true;
      };
      activeCleanup = cancelForDispose;

      unsubscribeAbort = context.abortSignal.onAbort(rejectCancelled);
      if (finished) return;

      frameHandle = context.clock.onFrame(() => {
        if (finished) return;
        frameCount += 1;
        if (frameCount < animationFrames) return;
        finished = true;
        cleanup();
        settle();
        resolve();
      });
    });
  }

  function dispose() {
    if (activeCleanup) activeCleanup();
    activeCleanup = null;
    root = null;
    disposed = true;
  }

  return Object.freeze({ mount, render, dispose });
}

export const SYNTHETIC_RENDERER_ID = RENDERER_ID;
export const SYNTHETIC_RENDERER_NAMESPACE = HTML_NAMESPACE;
