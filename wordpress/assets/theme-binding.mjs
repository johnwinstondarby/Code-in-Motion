import { THEME_PRESETS, isThemeId, resolveLearnerTheme } from './theme-presets.mjs';

export const LEARNER_THEME_STORAGE_KEY = 'cim.learnerTheme';
const coordinators = new WeakMap();

// One page preference, shared only by Players on this Window. No Runtime port.
export function createLearnerThemeCoordinator(view) {
  let explicit = null;
  try {
    const stored = view.localStorage.getItem(LEARNER_THEME_STORAGE_KEY);
    if (isThemeId(stored)) explicit = stored;
  } catch { /* Storage access is optional, including the property getter. */ }
  const media = query => typeof view.matchMedia === 'function' ? view.matchMedia(query) : { matches: false };
  const contrast = media('(prefers-contrast: more)');
  const light = media('(prefers-color-scheme: light)');
  const forced = media('(forced-colors: active)');
  const subscribers = new Set();
  const withdrawals = [];
  const read = () => Object.freeze({
    theme: resolveLearnerTheme({ explicit, contrast: contrast.matches, light: light.matches }),
    forcedColors: forced.matches
  });
  function publish() {
    const snapshot = read();
    for (const { listener, onError } of subscribers) {
      try { listener(snapshot); } catch (error) { try { onError(error); } catch { /* Diagnostics cannot break siblings. */ } }
    }
  }
  function stop() {
    const errors = [];
    for (const cleanup of [...withdrawals].reverse()) {
      try { cleanup(); withdrawals.splice(withdrawals.indexOf(cleanup), 1); }
      catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Theme media withdrawal failed.');
  }
  function start() {
    if (subscribers.size) return;
    if (withdrawals.length) stop();
    try {
      for (const query of [contrast, light, forced]) {
        if (typeof query.addEventListener !== 'function') continue;
        const listener = () => { if (subscribers.size) publish(); };
        withdrawals.push(() => query.removeEventListener('change', listener));
        query.addEventListener('change', listener);
      }
    } catch (error) {
      try { stop(); } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Theme media rollback failed.');
      }
      throw error;
    }
  }
  return Object.freeze({
    read,
    choose(theme) {
      if (!isThemeId(theme) || forced.matches) return;
      explicit = theme;
      try { view.localStorage.setItem(LEARNER_THEME_STORAGE_KEY, theme); } catch { /* Keep the in-memory choice. */ }
      publish();
    },
    subscribe(listener, onError = () => {}) {
      const subscription = { listener, onError };
      try { listener(read()); start(); subscribers.add(subscription); }
      catch (error) { if (!subscribers.size) stop(); throw error; }
      return () => { subscribers.delete(subscription); if (!subscribers.size) stop(); };
    }
  });
}

export function createWordPressThemeBinding({ root, onError = () => {} }) {
  const document = root.ownerDocument;
  const view = document.defaultView;
  let coordinator = coordinators.get(view);
  if (!coordinator) { coordinator = createLearnerThemeCoordinator(view); coordinators.set(view, coordinator); }
  const transport = root.querySelector('[data-cim-transport-controls]');
  if (!transport) throw new TypeError('Theme requires Player controls.');
  const previous = root.getAttribute('data-cim-theme');
  const label = document.createElement('label');
  label.setAttribute('data-cim-theme-control', '');
  label.appendChild(document.createTextNode('Theme '));
  const select = document.createElement('select');
  select.setAttribute('data-cim-theme-select', '');
  select.setAttribute('aria-label', 'Theme');
  for (const [id, preset] of Object.entries(THEME_PRESETS)) {
    const option = document.createElement('option');
    option.value = id; option.textContent = preset.label; select.appendChild(option);
  }
  label.appendChild(select);
  let disposed = false;
  let listening = false;
  let unsubscribe = null;
  let restored = false;
  const change = () => { if (!disposed) coordinator.choose(select.value); };
  function dispose() {
    disposed = true;
    const errors = [];
    const attempt = fn => { try { fn(); } catch (error) { errors.push(error); } };
    if (listening) attempt(() => { select.removeEventListener('change', change); listening = false; });
    if (unsubscribe) attempt(() => { unsubscribe(); unsubscribe = null; });
    if (!restored) attempt(() => {
      if (previous === null) root.removeAttribute('data-cim-theme'); else root.setAttribute('data-cim-theme', previous);
      restored = true;
    });
    if (label.parentNode) attempt(() => label.parentNode.removeChild(label));
    if (errors.length) throw new AggregateError(errors, 'Theme binding disposal failed.');
  }
  try {
    listening = true;
    select.addEventListener('change', change);
    transport.appendChild(label);
    unsubscribe = coordinator.subscribe(snapshot => {
      if (disposed) return;
      root.setAttribute('data-cim-theme', snapshot.theme);
      select.value = snapshot.theme;
      label.hidden = snapshot.forcedColors;
    }, onError);
    return Object.freeze({ dispose });
  } catch (error) {
    try { dispose(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Theme binding rollback failed.'); }
    throw error;
  }
}
