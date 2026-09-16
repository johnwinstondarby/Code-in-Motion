import { createSyntheticRenderer, SYNTHETIC_RENDERER_ID } from '../../src/renderers/subjects/synthetic/renderer.mjs';

export function createPackagedRendererResolver() {
  function resolve(rendererId) {
    if (rendererId === SYNTHETIC_RENDERER_ID) return createSyntheticRenderer();
    throw new Error(`Unknown packaged renderer: ${String(rendererId)}.`);
  }

  return Object.freeze({ resolve });
}
