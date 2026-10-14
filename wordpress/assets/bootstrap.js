(() => {
  // Phones (including landscape) and narrow windows get a static fallback.
  // Check before importing any engine, renderer, lesson or Player modules.
  const mobileQuery = '(max-width: 767px), (hover: none) and (pointer: coarse)';
  if (window.matchMedia(mobileQuery).matches) {
    const showDesktopNotice = () => {
      document.querySelectorAll('[data-cim-experience]').forEach((root) => {
        if (root.getAttribute('data-cim-state') === 'desktop-required') return;
        root.setAttribute('data-cim-state', 'desktop-required');
        root.textContent = 'Open this lesson on a desktop or laptop to use the interactive Player.';
      });
    };
    showDesktopNotice();
    new MutationObserver(showDesktopNotice).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    return;
  }

  const current = document.currentScript;
  if (!current || typeof current.src !== 'string' || current.src.length === 0) return;

  const sourceUrl = new URL(current.src, document.baseURI);
  const moduleUrl = new URL('./bootstrap-module.mjs', sourceUrl);
  moduleUrl.search = sourceUrl.search;

  const motionPolicy = current.getAttribute('data-cim-motion-policy') === 'reduce'
    ? 'reduce'
    : 'system';
  moduleUrl.searchParams.set('cim-motion-policy', motionPolicy);

  import(moduleUrl.href).catch((error) => {
    try {
      console.error('[CiM] WordPress bootstrap failed.', error);
    } catch {
      // Bootstrap diagnostics cannot change static fallback behavior.
    }
  });
})();
