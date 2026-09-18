import { createWordPressLiveHost } from '../../src/host/wordpress-live-host.mjs';
import {
  createWordPressClockFactory,
  createWordPressExperienceLoader,
  createWordPressRendererResolver
} from '../../src/host/wordpress-browser-bindings.mjs';
import {
  createSyntheticRenderer,
  SYNTHETIC_RENDERER_ID
} from '../../src/renderers/subjects/synthetic/renderer.mjs';
import {
  createGitRenderer,
  GIT_RENDERER_ID
} from '../../src/renderers/subjects/git/renderer.mjs';
import { createWordPressRootLifecycleBinding } from './root-lifecycle-binding.mjs';
import { createWordPressTransportBinding } from './transport-binding.mjs';

const SYNTHETIC_EXPERIENCE_ID = 'synthetic-wordpress';
const GIT_BASIC_CYCLE_EXPERIENCE_ID = 'git-basic-cycle';
const EXPERIENCE_PATHS = new Map([
  [SYNTHETIC_EXPERIENCE_ID, '../experiences/synthetic-wordpress.json'],
  [GIT_BASIC_CYCLE_EXPERIENCE_ID, '../experiences/git-basic-cycle.json']
]);
const ROOT_SELECTOR = '[data-cim-experience]';
const moduleUrl = new URL(import.meta.url);

function versionedUrl(relativePath) {
  const url = new URL(relativePath, moduleUrl);
  url.search = moduleUrl.search;
  return url.href;
}

const experienceLoader = createWordPressExperienceLoader({
  fetch: (url) => window.fetch(url, { credentials: 'same-origin' }),
  experienceUrlFor(experienceId) {
    const path = EXPERIENCE_PATHS.get(experienceId);
    return path === undefined ? '' : versionedUrl(path);
  }
});

const rendererResolver = createWordPressRendererResolver({
  registry: new Map([
    [SYNTHETIC_RENDERER_ID, () => createSyntheticRenderer()],
    [GIT_RENDERER_ID, () => createGitRenderer()]
  ])
});

const clockFactory = createWordPressClockFactory({
  now: () => window.performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
  requestAnimationFrame: (fn) => window.requestAnimationFrame(fn),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle)
});

const diagnostics = Object.freeze({
  report(record) {
    try {
      console.error('[CiM]', record);
    } catch {
      // Diagnostics cannot alter Host control flow.
    }
  }
});

const host = createWordPressLiveHost({
  document,
  matchMedia: (query) => window.matchMedia(query),
  experienceLoader,
  rendererResolver,
  clockFactory,
  diagnostics
});

const transportBindings = new Map();
let rootLifecycleBinding = null;
let disposalStarted = false;

function diagnosticInstanceId(root) {
  const explicit = root.getAttribute('data-cim-instance');
  if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit.trim();
  const experienceId = root.getAttribute('data-cim-experience');
  return typeof experienceId === 'string' && experienceId.trim().length > 0
    ? `cim:${experienceId.trim()}`
    : 'wordpress-host';
}

function reportBootstrapError(root, operation, error) {
  diagnostics.report(Object.freeze({
    code: 'CIM-HST-004',
    component: 'host',
    instanceId: root === null ? 'wordpress-host' : diagnosticInstanceId(root),
    operation,
    message: error instanceof Error ? error.message : String(error)
  }));
}

function disposeTransportBinding(root, operation) {
  const binding = transportBindings.get(root);
  if (binding === undefined) return;
  transportBindings.delete(root);
  try {
    binding.dispose();
  } catch (error) {
    reportBootstrapError(root, operation, error);
  }
}

function disposeDetachedRoot(root) {
  disposeTransportBinding(root, 'detached_transport_dispose');
  Promise.resolve(host.disposeRoot(root)).catch((error) => {
    reportBootstrapError(root, 'detached_root_dispose', error);
  });
}

async function mountPageHost() {
  const result = await host.mount();
  const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR));
  const mountedRoots = [];

  for (const root of roots) {
    const commandPort = host.commands(root);
    if (commandPort === null) continue;
    mountedRoots.push(root);

    try {
      const binding = createWordPressTransportBinding({ root, commandPort });
      transportBindings.set(root, binding);
    } catch (error) {
      reportBootstrapError(root, 'transport_bind', error);
    }
  }

  if (mountedRoots.length > 0) {
    try {
      rootLifecycleBinding = createWordPressRootLifecycleBinding({
        MutationObserver: window.MutationObserver,
        observeTarget: document.documentElement,
        roots: Object.freeze([...mountedRoots]),
        onDetached: disposeDetachedRoot
      });
    } catch (error) {
      reportBootstrapError(null, 'root_lifecycle_bind', error);
    }
  }

  return result;
}

mountPageHost().catch((error) => {
  reportBootstrapError(null, 'bootstrap_mount', error);
});

function disposePageHost() {
  if (disposalStarted) return;
  disposalStarted = true;

  if (rootLifecycleBinding !== null) {
    try {
      rootLifecycleBinding.dispose();
    } catch (error) {
      reportBootstrapError(null, 'root_lifecycle_dispose', error);
    }
    rootLifecycleBinding = null;
  }

  for (const root of [...transportBindings.keys()]) {
    disposeTransportBinding(root, 'transport_dispose');
  }

  Promise.resolve(host.dispose()).catch((error) => {
    reportBootstrapError(null, 'bootstrap_dispose', error);
  });
}

window.addEventListener('pagehide', disposePageHost, { once: true });
