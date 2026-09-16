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

const SYNTHETIC_EXPERIENCE_ID = 'synthetic-wordpress';
const moduleUrl = new URL(import.meta.url);

function versionedUrl(relativePath) {
  const url = new URL(relativePath, moduleUrl);
  url.search = moduleUrl.search;
  return url.href;
}

const experienceLoader = createWordPressExperienceLoader({
  fetch: (url) => window.fetch(url, { credentials: 'same-origin' }),
  experienceUrlFor(experienceId) {
    if (experienceId !== SYNTHETIC_EXPERIENCE_ID) return '';
    return versionedUrl('../experiences/synthetic-wordpress.json');
  }
});

const rendererResolver = createWordPressRendererResolver({
  registry: new Map([
    [SYNTHETIC_RENDERER_ID, () => createSyntheticRenderer()]
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

host.mount().catch((error) => {
  diagnostics.report(Object.freeze({
    code: 'CIM-HST-004',
    component: 'host',
    instanceId: 'wordpress-host',
    operation: 'bootstrap_mount',
    message: error instanceof Error ? error.message : String(error)
  }));
});

let disposalStarted = false;
function disposePageHost() {
  if (disposalStarted) return;
  disposalStarted = true;
  Promise.resolve(host.dispose()).catch((error) => {
    diagnostics.report(Object.freeze({
      code: 'CIM-HST-004',
      component: 'host',
      instanceId: 'wordpress-host',
      operation: 'bootstrap_dispose',
      message: error instanceof Error ? error.message : String(error)
    }));
  });
}

window.addEventListener('pagehide', disposePageHost, { once: true });
