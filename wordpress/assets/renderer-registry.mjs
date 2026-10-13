import {
  createGitRenderer,
  GIT_RENDERER_ID
} from '../../src/renderers/subjects/git/renderer.mjs';
import {
  createSyntheticRenderer,
  SYNTHETIC_RENDERER_ID
} from '../../src/renderers/subjects/synthetic/renderer.mjs';
import { createConsoleRenderer } from '../../src/renderers/subjects/console/renderer.mjs';
import { CONSOLE_RENDERER_ID } from '../../src/renderers/subjects/console/validate-console-input.mjs';

const REGISTRATIONS = Object.freeze([
  Object.freeze({
    id: CONSOLE_RENDERER_ID,
    create: () => createConsoleRenderer()
  }),
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
