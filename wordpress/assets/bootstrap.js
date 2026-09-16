(() => {
  const current = document.currentScript;
  if (!current || typeof current.src !== 'string' || current.src.length === 0) return;

  const sourceUrl = new URL(current.src, document.baseURI);
  const moduleUrl = new URL('./bootstrap-module.mjs', sourceUrl);
  moduleUrl.search = sourceUrl.search;

  import(moduleUrl.href).catch((error) => {
    try {
      console.error('[CiM] WordPress bootstrap failed.', error);
    } catch {
      // Bootstrap diagnostics cannot change static fallback behavior.
    }
  });
})();
