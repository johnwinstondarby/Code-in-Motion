import {
  createGitRenderer,
  GIT_RENDERER_ID
} from '../../src/renderers/subjects/git/renderer.mjs';
import {
  createSyntheticRenderer,
  SYNTHETIC_RENDERER_ID
} from '../../src/renderers/subjects/synthetic/renderer.mjs';

const REGISTRATIONS = Object.freeze([
  Object.freeze({
    id: GIT_RENDERER_ID,
    create: () => createGitRenderer()
  }),
  Object.freeze({
    id: SYNTHETIC_RENDERER_ID,
    create: () => createSyntheticRenderer()
  })
]);

export const WORDPRESS_RENDERER_IDS = Object.freeze(
  REGISTRATIONS.map(({ id }) => id)
);

export function createWordPressRendererRegistry() {
  return new Map(
    REGISTRATIONS.map(({ id, create }) => [id, create])
  );
}
