import { createCommentaryRevealProjection } from '../../src/commentary/reveal-projection.mjs';
import { createCommentarySelectionController } from '../../src/commentary/selection-controller.mjs';
import { createCommentaryPresentation } from '../../src/commentary/presentation.mjs';
import { createCommentaryNavigation } from '../../src/commentary/navigation.mjs';
import { createCommentaryNativeBinding } from '../../src/commentary/native-binding.mjs';
import { createCommentaryFollowController } from '../../src/commentary/follow-controller.mjs';
import { createCommentaryScrollBinding } from '../../src/commentary/scroll-binding.mjs';
import { createConsoleExplanationTransportBinding, createWordPressTransportBinding } from './transport-binding.mjs';

export const WORDPRESS_PLAYER_MODES = Object.freeze({ 'console/v1': 'console-explanation' });

export function wordPressPlayerMode(rendererId) {
  return Object.hasOwn(WORDPRESS_PLAYER_MODES, rendererId)
    ? WORDPRESS_PLAYER_MODES[rendererId] : 'legacy';
}

// WordPress owns composition. Peers receive only their existing narrow capabilities.
export function createWordPressPlayerBinding({ root, commandPort, observationPort, content, onError }) {
  if (wordPressPlayerMode(content.rendererId) === 'legacy') {
    return createWordPressTransportBinding({ root, commandPort, observationPort });
  }
  const document = root.ownerDocument;
  const view = document.defaultView;
  const rendererRoot = root.querySelector('[data-cim-renderer-root]');
  if (rendererRoot === null) throw new TypeError('Player requires the existing renderer root.');
  const originalParent = rendererRoot.parentNode;
  const originalNext = rendererRoot.nextSibling;
  const disposers = [];
  let timer = null;
  let disposed = false;
  let disposalComplete = false;
  let player = null;

  function element(tag, attribute, value = '') {
    const node = document.createElement(tag);
    node.setAttribute(attribute, value);
    return node;
  }

  function dispose() {
    if (disposalComplete) return null;
    disposed = true;
    const errors = [];
    function attempt(action) { try { action(); } catch (error) { errors.push(error); } }
    if (timer !== null) attempt(() => view.clearTimeout(timer));
    timer = null;
    for (const cleanup of [...disposers].reverse()) attempt(cleanup);
    if (player !== null && player.contains(rendererRoot)) {
      attempt(() => originalParent.insertBefore(rendererRoot,
        originalNext?.parentNode === originalParent ? originalNext : null));
    }
    if (player?.parentNode) attempt(() => player.parentNode.removeChild(player));
    if (errors.length) throw new AggregateError(errors, 'Player disposal failed.');
    disposalComplete = true;
    return null;
  }

  try {
    player = element('div', 'data-cim-player', 'console-explanation');
    const consolePane = element('section', 'data-cim-pane', 'console');
    consolePane.setAttribute('aria-label', 'Console');
    const explanationPane = element('section', 'data-cim-pane', 'explanation');
    explanationPane.setAttribute('aria-label', 'Explanation');
    if (content.title !== null) {
      const title = element('h2', 'data-cim-player-title');
      title.textContent = content.title;
      explanationPane.appendChild(title);
    }
    if (content.description !== null) {
      const description = element('p', 'data-cim-player-description');
      description.textContent = content.description;
      explanationPane.appendChild(description);
    }
    const viewport = element('div', 'data-cim-commentary-viewport');
    const indicator = element('button', 'data-cim-commentary-resume');
    indicator.type = 'button';
    indicator.hidden = true;
    const controls = Object.freeze(content.entries.map((entry, index) => {
      const entryRoot = element('div', 'data-cim-commentary-entry');
      entryRoot.hidden = true;
      const select = document.createElement('button');
      select.type = 'button';
      select.textContent = `Step ${index + 1}`;
      const text = document.createElement('p');
      const links = Object.freeze(entry.links.map(() => document.createElement('a')));
      entryRoot.appendChild(select);
      entryRoot.appendChild(text);
      for (const link of links) entryRoot.appendChild(link);
      viewport.appendChild(entryRoot);
      return Object.freeze({ root: entryRoot, text, select, links });
    }));
    explanationPane.appendChild(viewport);
    explanationPane.appendChild(indicator);
    player.appendChild(consolePane);
    player.appendChild(explanationPane);
    originalParent.insertBefore(player, rendererRoot);
    consolePane.appendChild(rendererRoot);

    const observation = Object.freeze({ snapshot: () => observationPort.snapshot() });
    const reveal = createCommentaryRevealProjection({
      boundaryIds: content.boundaryIds, entries: content.entries, observation
    });
    const selection = createCommentarySelectionController({ reveal });
    const presentation = createCommentaryPresentation({
      selection, observation, entryCount: content.entries.length
    });
    const navigation = createCommentaryNavigation(Object.freeze({
      seek: (stepId, source) => commandPort.seek(stepId, source)
    }));
    const native = createCommentaryNativeBinding({
      controls, presentation, select: (stepId) => selection.select(stepId),
      navigate: (stepId) => {
        const pending = navigation.seek(stepId);
        Promise.resolve(pending).catch(onError);
        return pending;
      }
    });
    disposers.push(() => native.dispose());
    const follow = createCommentaryFollowController({ presentation });
    const scroll = createCommentaryScrollBinding({
      viewport, indicator, follow, newerStepsLabel: 'Newer steps available'
    });
    disposers.push(() => scroll.dispose());
    const transport = createConsoleExplanationTransportBinding({ root, commandPort, observationPort });
    disposers.push(() => transport.dispose());

    function refresh() {
      if (disposed) return;
      native.refresh();
      // CSS withholds geometry until presentation admission; do not acknowledge follow early.
      if (root.getAttribute('data-cim-state') === 'ready') scroll.refresh();
      timer = view.setTimeout(() => {
        timer = null;
        try { refresh(); } catch (error) { onError(error); }
      }, 50);
    }
    refresh();
    return Object.freeze({ dispose });
  } catch (error) {
    try { dispose(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Player construction rollback failed.', { cause: error });
    }
    throw error;
  }
}
