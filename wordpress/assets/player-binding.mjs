import { createCommentaryRevealProjection } from '../../src/commentary/reveal-projection.mjs';
import { createCommentarySelectionController } from '../../src/commentary/selection-controller.mjs';
import { createCommentaryPresentation } from '../../src/commentary/presentation.mjs';
import { createCommentaryNavigation } from '../../src/commentary/navigation.mjs';
import { createCommentaryNativeBinding } from '../../src/commentary/native-binding.mjs';
import { createCommentaryFollowController } from '../../src/commentary/follow-controller.mjs';
import { createCommentaryScrollBinding } from '../../src/commentary/scroll-binding.mjs';
import { createConsoleFollowController } from './console-follow-controller.mjs';
import { createPaneHoldBinding } from './pane-hold-binding.mjs';
import { createPaneScrollIntent } from './pane-scroll-intent.mjs';
import { createWordPressBeatBinding } from './beat-binding.mjs';
import { createWordPressThemeBinding } from './theme-binding.mjs';
import { createConsoleCopyBinding } from './console-copy-binding.mjs';
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
  let beatBinding = null;

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
    if (content.commandWindow?.cli) {
      const badge = element('div', 'data-cim-cli', content.commandWindow.cli.kind);
      badge.textContent = content.commandWindow.cli.label;
      consolePane.appendChild(badge);
    }
    const consoleViewport = element('div', 'data-cim-console-viewport');
    consoleViewport.tabIndex = 0;
    consoleViewport.setAttribute('role', 'region');
    consoleViewport.setAttribute('aria-label', 'Console output');
    const consoleIndicator = element('button', 'data-cim-console-resume');
    consoleIndicator.type = 'button';
    consoleIndicator.hidden = true;
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
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Explanation transcript');
    const indicator = element('button', 'data-cim-commentary-resume');
    indicator.type = 'button';
    indicator.hidden = true;
    const beatByBoundary = new Map(content.beats.flatMap(beat => beat.boundaryIds.map(id => [id,beat])));
    const beatSections = new Map(content.beats.map(beat => {
      const section = element('section','data-cim-beat-section',beat.id); section.hidden = true;
      const heading = element('h3','data-cim-beat-heading',beat.id);
      heading.textContent = `${beat.ordinal} ${beat.heading}`;
      section.appendChild(heading); viewport.appendChild(section);
      return [beat.id,section];
    }));
    const controls = Object.freeze(content.entries.map((entry, index) => {
      const entryRoot = element('div', 'data-cim-commentary-entry');
      entryRoot.hidden = true;
      const select = document.createElement('button');
      select.type = 'button';
      const beat = beatByBoundary.get(entry.stepId);
      select.textContent = beat === undefined ? `Step ${index + 1}` : 'Show in Console';
      if (beat !== undefined) select.setAttribute('aria-label',`Show ${beat.heading} explanation ${index - content.entries.findIndex(item => item.stepId === beat.boundaryIds[0]) + 1} in Console`);
      const text = document.createElement('p');
      const links = Object.freeze(entry.links.map(() => document.createElement('a')));
      entryRoot.appendChild(select);
      const instruction = content.instructions?.[index];
      if (instruction?.anchor) {
        entryRoot.setAttribute('data-cim-commentary-anchor', instruction.anchor);
        const phase = element('span', 'data-cim-commentary-phase');
        phase.textContent = {command:'Command',output:'Output',response:'Response'}[instruction.anchor];
        entryRoot.appendChild(phase);
        select.setAttribute('aria-label', `Show ${beat?.heading ?? entry.stepId} ${instruction.anchor} in Console`);
      }
      if (instruction?.evidence.length) {
        entryRoot.setAttribute('data-cim-commentary-evidence', JSON.stringify(instruction.evidence));
        const evidence = element('span','data-cim-commentary-evidence-label');
        evidence.textContent = `Related ${instruction.anchor === 'response' ? 'response' : 'output'}: ${instruction.evidence.length} ${instruction.evidence.length === 1 ? 'line' : 'lines'}`;
        entryRoot.appendChild(evidence);
      }
      entryRoot.appendChild(text);
      if (instruction?.risk) {
        const risk = element('div','data-cim-commentary-risk',instruction.risk.level);
        const label = element('span','data-risk',instruction.risk.level);
        label.textContent = {'free-to-undo':'FREE TO UNDO','leaves-a-trace':'LEAVES A TRACE','cannot-be-undone':'CANNOT BE UNDONE'}[instruction.risk.level];
        risk.appendChild(label);
        if (instruction.risk.guidance) {
          const guidance = element('p','data-cim-risk-guidance');
          guidance.textContent = instruction.risk.guidance;
          risk.appendChild(guidance);
        }
        entryRoot.appendChild(risk);
      }
      for (const link of links) entryRoot.appendChild(link);
      (beat === undefined ? viewport : beatSections.get(beat.id)).appendChild(entryRoot);
      return Object.freeze({ root: entryRoot, text, select, links });
    }));
    explanationPane.appendChild(viewport);
    explanationPane.appendChild(indicator);
    player.appendChild(consolePane);
    player.appendChild(explanationPane);
    originalParent.insertBefore(player, rendererRoot);
    consoleViewport.appendChild(rendererRoot);
    consolePane.appendChild(consoleViewport);
    consolePane.appendChild(consoleIndicator);
    const copyStatus = element('p', 'data-cim-copy-status');
    copyStatus.setAttribute('role', 'status');
    copyStatus.setAttribute('aria-live', 'polite');
    copyStatus.setAttribute('aria-atomic', 'true');
    consolePane.appendChild(copyStatus);
    disposers.push(createConsoleCopyBinding({viewport:consoleViewport,status:copyStatus}).dispose);

    const observation = Object.freeze({ snapshot: () => observationPort.snapshot() });
    const reveal = createCommentaryRevealProjection({
      boundaryIds: content.boundaryIds, entries: content.entries, observation
    });
    const selection = createCommentarySelectionController({ reveal });
    const presentation = createCommentaryPresentation({
      selection, observation, entryCount: content.entries.length
    });
    // Deliberate navigation can reposition held/owned viewports without changing follow ownership.
    // Preserve the original command return value and provenance.
    const playerCommands = Object.freeze(Object.fromEntries(Object.entries(commandPort).map(([key, command]) => {
      if (!['next', 'previous', 'home', 'end', 'restart', 'seek'].includes(key)) return [key, command];
      return [key, (...args) => {
        const pending = command(...args);
        Promise.resolve(pending).then(outcome => {
          if (disposed || !['success', 'no_change'].includes(outcome?.result)) return;
          native.refresh();
          refreshBeatSections();
          beatBinding?.refresh();
          const current = presentation.read().currentStepId;
          const active = controls.find(control => control.root.getAttribute('data-cim-step-id') === current)?.root;
          const section = active?.closest('[data-cim-beat-section]');
          const destination = section?.querySelector('[data-cim-commentary-entry]') === active ? section : active;
          const top = destination === undefined ? 0 : Math.max(0,
            destination.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop);
          scroll.reposition(top);
          consoleScroll.reposition();
        }).catch(onError);
        return pending;
      }];
    })));
    const navigation = createCommentaryNavigation(Object.freeze({
      seek: (stepId, source) => playerCommands.seek(stepId, source)
    }));
    const native = createCommentaryNativeBinding({
      controls, presentation, select: (stepId) => selection.select(stepId),
      navigate: (stepId) => {
        const pending = navigation.seek(stepId);
        Promise.resolve(pending).catch(onError);
        return pending;
      }
    });
    function refreshBeatSections() {
      for (const section of beatSections.values()) {
        section.hidden = ![...section.querySelectorAll('[data-cim-commentary-entry]')].some(entry => !entry.hidden);
      }
    }
    disposers.push(() => native.dispose());
    const follow = createCommentaryFollowController({ presentation });
    const explanationIntent = createPaneScrollIntent({viewport});
    disposers.push(() => explanationIntent.dispose());
    const scroll = createCommentaryScrollBinding({
      viewport, indicator, follow, newerStepsLabel: 'New explanation below',
      scrollIntent: Object.freeze({read:() => explanationIntent.read()})
    });
    disposers.push(() => scroll.dispose());
    const consoleFollow = createConsoleFollowController({
      readContent: () => rendererRoot.querySelector('[data-role="transcript"]')?.textContent ?? ''
    });
    const consoleIntent = createPaneScrollIntent({viewport:consoleViewport});
    disposers.push(() => consoleIntent.dispose());
    const consoleScroll = createCommentaryScrollBinding({
      viewport: consoleViewport, indicator: consoleIndicator, follow: consoleFollow,
      newerStepsLabel: 'New output below',
      scrollIntent: Object.freeze({read:() => consoleIntent.read()})
    });
    disposers.push(() => consoleScroll.dispose());
    function refreshViewports() {
      if (!disposed && root.getAttribute('data-cim-state') === 'ready') {
        scroll.refresh();
        consoleScroll.refresh();
      }
    }
    for (const [pane, policy] of [[consolePane, consoleFollow], [explanationPane, follow]]) {
      const holds = createPaneHoldBinding({ pane, follow: policy, refresh: refreshViewports });
      disposers.push(() => holds.dispose());
    }
    const observer = new view.MutationObserver(() => {
      if (disposed) return;
      try { refreshViewports(); } catch (error) { onError(error); }
    });
    disposers.push(() => observer.disconnect());
    observer.observe(rendererRoot, { subtree: true, childList: true, characterData: true });
    const transport = createConsoleExplanationTransportBinding({ root, commandPort: playerCommands, observationPort });
    disposers.push(() => transport.dispose());
    const themeBinding = createWordPressThemeBinding({ root, onError });
    disposers.push(() => themeBinding.dispose());
    if (content.beats.length > 0) {
      beatBinding = createWordPressBeatBinding({root,beats:content.beats,boundaryIds:content.boundaryIds,
        observation,seek:playerCommands.seek,onError});
      disposers.push(() => beatBinding.dispose());
    }

    function refresh() {
      if (disposed) return;
      native.refresh();
      refreshBeatSections();
      beatBinding?.refresh();
      // CSS withholds geometry until presentation admission; do not acknowledge follow early.
      refreshViewports();
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
