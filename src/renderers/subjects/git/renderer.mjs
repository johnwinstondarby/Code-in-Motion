import { RendererCancelledError } from '../../interface.mjs';

const RENDERER_ID = 'git/v1';
const ALLOWED_LANES = Object.freeze(['working-tree', 'index', 'local', 'remote']);
const ALLOWED_FOCUS = new Set(['overview', 'working-tree', 'index', 'local', 'head', 'refs', 'remote', 'reflog']);

function assertRoot(root) {
  if (!root || typeof root !== 'object' || root.nodeType !== 1) {
    throw new TypeError('Git renderer mount requires an element root.');
  }
  if (!root.ownerDocument || typeof root.ownerDocument.createElement !== 'function' || typeof root.ownerDocument.createTextNode !== 'function') {
    throw new TypeError('Git renderer root must expose an ownerDocument with createElement and createTextNode.');
  }
  if (typeof root.replaceChildren !== 'function') {
    throw new TypeError('Git renderer root must support replaceChildren().');
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Git renderer ' + label + ' must be a non-empty string.');
  }
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError('Git renderer ' + label + ' must be an array of non-empty strings.');
  }
  return value;
}

function readState(state) {
  if (!isObject(state)) throw new TypeError('Git renderer state must be an object.');

  const workingTree = state.working_tree;
  const index = state.index;
  const local = state.local;
  const remote = state.remote;

  if (!isObject(workingTree) || !isObject(index) || !isObject(local) || !isObject(remote)) {
    throw new TypeError('Git renderer state requires working_tree, index, local, and remote objects.');
  }

  const tags = local.tags;
  if (!Array.isArray(tags) || tags.some((tag) =>
    !isObject(tag) ||
    typeof tag.name !== 'string' ||
    tag.name.length === 0 ||
    typeof tag.target !== 'string' ||
    tag.target.length === 0
  )) {
    throw new TypeError('Git renderer local.tags must contain name/target records.');
  }

  if (typeof workingTree.unstaged !== 'boolean') {
    throw new TypeError('Git renderer working_tree.unstaged must be boolean.');
  }
  if (typeof index.staged !== 'boolean') {
    throw new TypeError('Git renderer index.staged must be boolean.');
  }

  return {
    workingTree: {
      content: nonEmptyString(workingTree.content, 'working_tree.content'),
      unstaged: workingTree.unstaged
    },
    index: {
      content: nonEmptyString(index.content, 'index.content'),
      staged: index.staged
    },
    local: {
      head: nonEmptyString(local.head, 'local.head'),
      commits: [...stringArray(local.commits, 'local.commits')],
      tags: tags.map((tag) => ({ name: tag.name, target: tag.target }))
    },
    remote: {
      head: nonEmptyString(remote.head, 'remote.head'),
      commits: [...stringArray(remote.commits, 'remote.commits')]
    },
    reflog: [...stringArray(state.reflog, 'reflog')]
  };
}

function readConfig(context) {
  const config = context.rendererConfig;
  if (!isObject(config)) throw new TypeError('Git renderer requires renderer configuration.');
  if (!Array.isArray(config.lanes) || config.lanes.length !== ALLOWED_LANES.length) {
    throw new TypeError('Git renderer lanes must define the four-place Git model.');
  }
  for (let index = 0; index < ALLOWED_LANES.length; index += 1) {
    if (config.lanes[index] !== ALLOWED_LANES[index]) {
      throw new TypeError('Git renderer lanes must be working-tree, index, local, remote in order.');
    }
  }

  const file = nonEmptyString(config.file, 'rendererConfig.file');
  const stepConfig = context.stepRendererConfig;
  const focus = stepConfig === null ? 'overview' : stepConfig.focus;
  if (typeof focus !== 'string' || !ALLOWED_FOCUS.has(focus)) {
    throw new TypeError('Git renderer focus is not supported: ' + String(focus));
  }

  return { file, focus };
}

function text(document, value) {
  return document.createTextNode(String(value));
}

function addTextElement(document, parent, name, value, role = null) {
  const element = document.createElement(name);
  if (role !== null) element.setAttribute('data-role', role);
  element.appendChild(text(document, value));
  parent.appendChild(element);
  return element;
}

function addList(document, parent, values, role) {
  const list = document.createElement('ul');
  list.setAttribute('data-role', role);
  for (const value of values) {
    const item = document.createElement('li');
    item.appendChild(text(document, value));
    list.appendChild(item);
  }
  parent.appendChild(list);
  return list;
}

function lane(document, id, title, focus) {
  const section = document.createElement('section');
  section.setAttribute('data-git-lane', id);
  section.setAttribute('data-focus', focus === id ? 'true' : 'false');
  section.setAttribute('aria-label', title);
  addTextElement(document, section, 'h4', title, 'lane-title');
  return section;
}

function buildStableOutput(root, stateInput, context) {
  const state = readState(stateInput);
  const { file, focus } = readConfig(context);
  const document = root.ownerDocument;

  const section = document.createElement('section');
  section.setAttribute('data-cim-renderer', RENDERER_ID);
  section.setAttribute('data-step', context.stepId);
  section.setAttribute('data-git-focus', focus);
  section.setAttribute('aria-label', 'Git repository state');

  addTextElement(document, section, 'h3', 'Git repository state', 'title');

  const lanes = document.createElement('div');
  lanes.setAttribute('data-role', 'git-lanes');

  const working = lane(document, 'working-tree', 'Working Tree', focus);
  addTextElement(document, working, 'div', file, 'file');
  addTextElement(document, working, 'div', state.workingTree.content, 'content');
  addTextElement(
    document,
    working,
    'div',
    state.workingTree.unstaged ? 'unstaged change' : 'matches index',
    'status'
  );
  lanes.appendChild(working);

  const indexLane = lane(document, 'index', 'Index', focus);
  addTextElement(document, indexLane, 'div', state.index.content, 'content');
  addTextElement(
    document,
    indexLane,
    'div',
    state.index.staged ? 'staged for next commit' : 'no staged change',
    'status'
  );
  lanes.appendChild(indexLane);

  const localLane = lane(document, 'local', 'Local Repository', focus);
  addTextElement(document, localLane, 'div', 'HEAD ' + state.local.head, 'head');
  addList(document, localLane, state.local.commits, 'commits');
  const tagText = state.local.tags.length === 0
    ? ['no tags']
    : state.local.tags.map((tag) => tag.name + ' → ' + tag.target);
  addList(document, localLane, tagText, 'tags');
  lanes.appendChild(localLane);

  const remoteLane = lane(document, 'remote', 'Remote', focus);
  addTextElement(document, remoteLane, 'div', 'HEAD ' + state.remote.head, 'head');
  addList(document, remoteLane, state.remote.commits, 'commits');
  lanes.appendChild(remoteLane);

  section.appendChild(lanes);

  const evidence = document.createElement('aside');
  evidence.setAttribute('data-git-evidence', 'reflog');
  evidence.setAttribute('data-git-grammar', 'evidence-timeline');
  evidence.setAttribute('data-focus', focus === 'reflog' ? 'true' : 'false');
  evidence.setAttribute('aria-label', 'Reflog evidence timeline');
  addTextElement(document, evidence, 'h4', 'Reflog evidence', 'evidence-title');
  addList(document, evidence, state.reflog, 'evidence-timeline');
  section.appendChild(evidence);

  return section;
}

export function createGitRenderer({ animationFrames = 2 } = {}) {
  if (!Number.isInteger(animationFrames) || animationFrames < 1) {
    throw new RangeError('Git renderer animationFrames must be a positive integer.');
  }

  let root = null;
  let disposed = false;
  let activeCleanup = null;

  function mount(context) {
    if (!context || typeof context !== 'object') {
      throw new TypeError('Git renderer mount context must be an object.');
    }
    assertRoot(context.root);
    root = context.root;
    disposed = false;
  }

  function render(state, context) {
    if (disposed) return Promise.reject(new Error('Git renderer is disposed.'));
    if (!root) return Promise.reject(new Error('Git renderer must be mounted before render().'));

    const stableOutput = buildStableOutput(root, state, context);
    const settle = () => root.replaceChildren(stableOutput);

    if (context.abortSignal.aborted) {
      return Promise.reject(new RendererCancelledError(context.abortSignal.reason));
    }

    if (!context.animate || context.reducedMotion) {
      settle();
      return Promise.resolve();
    }

    if (activeCleanup) {
      return Promise.reject(new Error('Git renderer already has an active render.'));
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

export const GIT_RENDERER_ID = RENDERER_ID;
