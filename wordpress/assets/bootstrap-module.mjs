import { COMMAND_SOURCE } from '../../src/contracts/events.mjs';
import {
  createWordPressDeepLinkResolver,
  parseCiMDeepLinkFragment,
  resolveWordPressDeepLink
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
import { lessonPackUrlFor, readBoundedLesson } from './lesson-pack-loading.mjs';
import { createWordPressRendererRegistry } from './renderer-registry.mjs';
import { createWordPressRootLifecycleBinding } from './root-lifecycle-binding.mjs';
import { createWordPressPlayerBinding } from './player-binding.mjs';
import { createHostIdentity } from '../../src/multipane/admission.mjs';
import { admitPanesRoot, isPanesRoot, mountPanesRoot as mountAdmittedPanesRoot, panesNamespaces } from './panes-binding.mjs';

const experienceAssets = new Map(
  WORDPRESS_EXPERIENCE_REGISTRY.map(({ id, asset }) => [id, asset])
);
const ROOT_SELECTOR = '[data-cim-experience]';
const packUrls = new Set();
const moduleUrl = new URL(import.meta.url);
const forceReducedMotion = moduleUrl.searchParams.get('cim-motion-policy') === 'reduce';
// Multi-pane admission identity: the released engine, or the explicit 1.1.0-dev development identity.
const panesIdentity = createHostIdentity({
  developmentAdmission: moduleUrl.searchParams.get('cim-admission') === 'development'
});
const matchMedia = createWordPressMotionPolicyMatchMedia(
  (query) => window.matchMedia(query),
  forceReducedMotion
);

function versionedUrl(relativePath) {
  const url = new URL(relativePath, moduleUrl);
  url.search = moduleUrl.search;
  url.searchParams.delete('cim-motion-policy');
  url.searchParams.delete('cim-admission');
  return url.href;
}

const experienceLoader = createWordPressExperienceLoader({
  fetch: async (url) => {
    const response = await window.fetch(url, { credentials: 'same-origin' });
    return { ok: response.ok, status: response.status, json: () => readBoundedLesson(response, packUrls.has(url)) };
  },
  experienceUrlFor(experienceId) {
    const asset = experienceAssets.get(experienceId);
    if (asset !== undefined) return versionedUrl('../experiences/' + asset);
    const url = lessonPackUrlFor(document, experienceId);
    if (url) packUrls.add(url);
    return url;
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

// Multi-pane roots are mounted by the panes binding; the legacy Host never sees them.
const legacyDocument = Object.freeze({
  querySelectorAll: (selector) => Array.from(document.querySelectorAll(selector)).filter((root) => !isPanesRoot(root))
});

const host = createWordPressLiveHost({
  document: legacyDocument,
  matchMedia,
  experienceLoader,
  rendererResolver,
  clockFactory,
  entryResolver,
  diagnostics
});

const transportBindings = new Map();
const panesPlayers = new Map();
const panesLifecycles = new Map();
const panesAbort = new AbortController();
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
  const fragment = window.location.hash;
  let target;
  try {
    target = parseCiMDeepLinkFragment(fragment);
  } catch (error) {
    reportDeepLinkError(null, 'deep_link_hashchange', error);
    return;
  }
  if (target === null) return;

  for (const [root, player] of panesPlayers) {
    if (root.getAttribute('data-cim-experience') !== target.experienceId) continue;
    try { player.applyFragment(fragment); } catch (error) { reportDeepLinkError(root, 'deep_link_hashchange', error); }
  }

  const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR)).filter((root) => !isPanesRoot(root));
  for (const root of roots) {
    const experienceId = root.getAttribute('data-cim-experience');
    if (typeof experienceId !== 'string' || experienceId.trim() !== target.experienceId) continue;
    if (host.commands(root) === null) continue;

    try {
      const experience = await experienceLoader.load(experienceId.trim());
      if (disposalStarted || window.location.hash !== fragment || root.isConnected === false) return;
      const resolution = resolveWordPressDeepLink(fragment, experienceId.trim(), experience);
      const commandPort = host.commands(root);
      if (commandPort === null || resolution === null) continue;
      const outcome = await commandPort.seek(resolution.stepId, COMMAND_SOURCE.DEEP_LINK);
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

function disposePanesPlayer(root, operation) {
  const lifecycle = panesLifecycles.get(root);
  if (lifecycle !== undefined) {
    panesLifecycles.delete(root);
    try { lifecycle.dispose(); } catch (error) { reportBootstrapError(root, 'root_lifecycle_dispose', error); }
  }
  const player = panesPlayers.get(root);
  if (player === undefined) return;
  panesPlayers.delete(root);
  try { player.dispose(); } catch (error) { reportBootstrapError(root, operation, error); }
}

// Each panes root loads, admits and mounts on its own: a slow or stalled pack response ends in
// that root's fallback at the read deadline and never delays another lesson or the legacy Host.
// A root removed while loading, or a disposed page, cancels its requests and never mounts.
async function mountPanesRoot(root, instanceId) {
  const retire = new AbortController();
  const stopOnPageDisposal = () => retire.abort(new Error('CiM page host disposed.'));
  panesAbort.signal.addEventListener('abort', stopOnPageDisposal, { once: true });
  let lifecycle = null;
  try {
    lifecycle = createWordPressRootLifecycleBinding({
      MutationObserver: window.MutationObserver,
      observeTarget: document.documentElement,
      roots: Object.freeze([root]),
      onDetached(detached) {
        if (panesPlayers.has(detached)) disposeDetachedRoot(detached);
        else retire.abort(new Error('CiM panes root was removed while loading.'));
      }
    });
  } catch (error) {
    reportBootstrapError(root, 'root_lifecycle_bind', error);
  }
  try {
    const admitted = await admitPanesRoot(root, {
      baseURI: document.baseURI,
      fetch: (url, init) => window.fetch(url, init),
      identity: panesIdentity,
      signal: retire.signal
    });
    if (retire.signal.aborted || disposalStarted || root.isConnected === false) throw retire.signal.reason ?? new Error('Retired.');
    panesPlayers.set(root, mountAdmittedPanesRoot(root, admitted, {
      document,
      location: window.location,
      moduleUrl: moduleUrl.href,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      instanceId
    }));
    if (lifecycle !== null) panesLifecycles.set(root, lifecycle);
  } catch (error) {
    try { lifecycle?.dispose(); } catch (cleanupError) { reportBootstrapError(root, 'root_lifecycle_dispose', cleanupError); }
    // A retired root is gone on purpose: nothing to report. Otherwise the static fallback stays
    // visible and the reason is reported, never rendered as lesson content.
    if (!retire.signal.aborted) reportHostDiagnostic('CIM-HST-005', root, 'panes_admission', error);
  } finally {
    panesAbort.signal.removeEventListener('abort', stopOnPageDisposal);
  }
}

function mountPanesRoots() {
  const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR)).filter(isPanesRoot);
  const namespaces = panesNamespaces(roots);
  return roots.map((root, index) => mountPanesRoot(root, namespaces[index]));
}

function disposeDetachedRoot(root) {
  if (panesPlayers.has(root)) { disposePanesPlayer(root, 'detached_panes_dispose'); return; }
  disposeTransportBinding(root, 'detached_transport_dispose');
  Promise.resolve(host.disposeRoot(root)).catch((error) => {
    reportBootstrapError(root, 'detached_root_dispose', error);
  });
}

function installDeepLinkHandler() {
  if (deepLinkHandler !== null || disposalStarted) return;
  deepLinkHandler = () => {
    void applyLocationDeepLink();
  };
  window.addEventListener('hashchange', deepLinkHandler);
}

async function mountPageHost() {
  const panesMounts = mountPanesRoots();
  if (panesMounts.length > 0) installDeepLinkHandler();
  const result = await host.mount();
  const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR)).filter((root) => !isPanesRoot(root));
  const mountedRoots = [];

  for (const root of roots) {
    const commandPort = host.commands(root);
    if (commandPort === null) continue;
    const observationPort = host.observations(root);
    try {
      const content = host.playerContent(root);
      if (observationPort === null || content === null) {
        throw new Error('WordPress Host presentation capabilities are unavailable.');
      }
      const binding = createWordPressPlayerBinding({
        root, commandPort, observationPort, content,
        onError(error) {
          reportBootstrapError(root, 'player_refresh', error);
          disposeDetachedRoot(root);
        }
      });
      transportBindings.set(root, binding);
      if (!host.present(root)) throw new Error('WordPress presentation admission failed.');
      mountedRoots.push(root);
    } catch (error) {
      disposeTransportBinding(root, 'failed_player_dispose');
      await host.disposeRoot(root).catch((cleanupError) => {
        reportBootstrapError(root, 'failed_root_dispose', cleanupError);
      });
      reportBootstrapError(root, 'player_bind', error);
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

    installDeepLinkHandler();
  }

  return result;
}

mountPageHost().catch((error) => {
  reportBootstrapError(null, 'bootstrap_mount', error);
});

function disposePageHost() {
  if (disposalStarted) return;
  disposalStarted = true;

  panesAbort.abort(new Error('CiM page host disposed.'));

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

  for (const root of [...panesPlayers.keys()]) {
    disposePanesPlayer(root, 'panes_dispose');
  }

  Promise.resolve(host.dispose()).catch((error) => {
    reportBootstrapError(null, 'bootstrap_dispose', error);
  });
}

window.addEventListener('pagehide', disposePageHost, { once: true });
