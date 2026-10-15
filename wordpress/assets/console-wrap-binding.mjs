// Player-only layout derived from rendered text. Authored text and renderer output stay intact.
export function createConsoleWrapBinding({rendererRoot}) {
  let disposed = false;
  const originals = new WeakMap();
  const property = '--cim-continuation-indent';
  function lines() {
    return rendererRoot.querySelectorAll('[data-role="command-line"], [data-role="output-line"]');
  }
  return Object.freeze({
    refresh() {
      if (disposed) return;
      for (const line of lines()) {
        if (!originals.has(line)) originals.set(line,line.style.getPropertyValue(property));
        const spaces = line.textContent.match(/^ */)[0].length;
        const indent = `${spaces + 2}ch`;
        if (line.style.getPropertyValue(property) !== indent) line.style.setProperty(property,indent);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const line of lines()) {
        if (!originals.has(line)) continue;
        const prior = originals.get(line);
        if (prior) line.style.setProperty(property,prior);
        else line.style.removeProperty(property);
        if (line.style.length === 0) line.removeAttribute('style');
      }
    }
  });
}
