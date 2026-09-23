import { COMMAND_SOURCE } from '../../src/contracts/events.mjs';
import {
  createWordPressDeepLinkResolver,
  parseCiMDeepLinkFragment
} from '../../src/host/wordpress-deep-link.mjs';
import {
  createWordPressLiveHost,
  createWordPressMotionPolicyMatchMedia
} from '../../src/host/wordpress-live-host.mjs';
import {
  createWordPressClockFactory,
  createWordPressExperienceLoader,
  createWordPressRendererResolver
} from '../../src/host/wordpress-browser-bindings.mjs';
import { WORDPRESS_EXPERIENCE_REGISTRY } from './experience-registry.generated.mjs';
import { createWordPressRendererRegistry } from './renderer-registry.mjs';
import { createWordPressRootLifecycleBinding } from './root-lifecycle-binding.mjs';
import { createWordPressTransportBinding } from './transport-binding.mjs';

const experienceAssets = new Map(
  WORDPRESS_EXPERIENCE_REGISTRY.map(({ id, asset }) => [id, asset])
);
const ROOT_SELECTOR = '[data-cim-experience]';
const moduleUrl = new URL(import.meta.url);
const forceReducedMotion = moduleUrl.searchParams.get('cim-motion-policy') === 'reduce';
const matchMedia = createWordPressMotionPolicyMatchMedia(
  (query) => window.matchMedia(query),
  forceReducedMotion
);

function versionedUrl(relativePath) {
  const url = new URL(relativePath, moduleUrl);
  url.search = moduleUrl.search;
  url.searchParams.delete('cim-motion-policy');
  return url.href;
}

const experienceLoader = createWordPressExperienceLoader({
  fetch: (url) => window.fetch(url, { credentials: 'same-origin' }),
  experienceUrlFor(experienceId) {
    const asset = experienceAssets.get(experienceId);
    return asset === undefined ? '' : versionedUrl('../experiences/' + asset);
  }
});

const rendererResolver = createWordPressRendererResolver({
  registry: createWordPressRendererRegistry()
});

const clockFactory = createWordPressClockFactory({
  now: () => window.performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
  requestAnimationFrame: (fn) => window.requestAnimationFrame(fn),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle)
});

const entryResolver = createWordPressDeepLinkResolver({
  readFragment: () => window.location.hash
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
  matchMedia,
  experienceLoader,
  rendererResolver,
  clockFactory,
  entryResolver,
  diagnostics
});

const transportBindings = new Map();
let rootLifecycleBinding = null;
let deepLinkHandler = null;
let disposalStarted = false;

function diagnosticInstanceId(root) {
  const explicit = root.getAttribute('data-cim-instance');
  if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit.trim();
  const experienceId = root.getAttribute('data-cim-experience');
  return typeof experienceId === 'string' && experienceId.trim().length > 0
    ? `cim:${experienceId.trim()}`
    : 'wordpress-host';
}

function reportHostDiagnostic(code, root, operation, error) {
  diagnostics.report(Object.freeze({
    code,
    component: 'host',
    instanceId: root === null ? 'wordpress-host' : diagnosticInstanceId(root),
    operation,
    message: error instanceof Error ? error.message : String(error)
  }));
}

function reportBootstrapError(root, operation, error) {
  reportHostDiagnostic('CIM-HST-004', root, operation, error);
}

function reportDeepLinkError(root, operation, error) {
  reportHostDiagnostic('CIM-HST-002', root, operation, error);
}

async function applyLocationDeepLink() {
  let target;
  try {
    target = parseCiMDeepLinkFragment(window.location.hash);
  } catch (error) {
    reportDeepLinkError(null, 'deep_link_hashchange', error);
    return;
  }
  if (target === null) return;

  const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR));
  for (const root of roots) {
    const experienceId = root.getAttribute('data-cim-experience');
    if (typeof experienceId !== 'string' || experienceId.trim() !== target.experienceId) continue;
    const commandPort = host.commands(root);
    if (commandPort === null) continue;

    try {
      const outcome = await commandPort.seek(target.stepId, COMMAND_SOURCE.DEEP_LINK);
      if (outcome && outcome.result === 'rejected') {
        reportDeepLinkError(root, 'deep_link_hashchange', new Error(
          'CiM deep-link target was rejected: ' + target.stepId
        ));
      }
    } catch (error) {
      reportDeepLinkError(root, 'deep_link_hashchange', error);
    }
  }
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
    const observationPort = host.observations(root);
    if (observationPort === null) {
      reportBootstrapError(
        root,
        'transport_bind',
        new Error('WordPress Host observation port is unavailable for a mounted root.')
      );
      continue;
    }

    try {
      const binding = createWordPressTransportBinding({ root, commandPort, observationPort });
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

    deepLinkHandler = () => {
      void applyLocationDeepLink();
    };
    window.addEventListener('hashchange', deepLinkHandler);
  }

  return result;
}

mountPageHost().catch((error) => {
  reportBootstrapError(null, 'bootstrap_mount', error);
});

function disposePageHost() {
  if (disposalStarted) return;
  disposalStarted = true;

  if (deepLinkHandler !== null) {
    window.removeEventListener('hashchange', deepLinkHandler);
    deepLinkHandler = null;
  }

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
