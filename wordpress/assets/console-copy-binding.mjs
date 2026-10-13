// Player clipboard authority. Renderer data supplies the exact authored copy value.
export function createConsoleCopyBinding({viewport, status}) {
  const view = viewport.ownerDocument.defaultView;
  let disposed = false;
  let disposalComplete = false;
  let request = 0;
  function announce(text, token) {
    if (!disposed && token === request) status.textContent = text;
  }
  function click(event) {
    if (disposed || event.defaultPrevented) return;
    const button = event.target.closest?.('button[data-role="copy"][data-copy]');
    if (!button || !viewport.contains(button)) return;
    const value = button.getAttribute('data-copy');
    const token = ++request;
    status.textContent = '';
    try {
      if (!view.navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      Promise.resolve(view.navigator.clipboard.writeText(value)).then(
        () => announce(`Copied command: ${value}`, token),
        () => announce(`Could not copy. Select the command text and use your device’s Copy command. Command: ${value}`, token));
    } catch {
      announce(`Could not copy. Select the command text and use your device’s Copy command. Command: ${value}`, token);
    }
  }
  viewport.addEventListener('click', click);
  return Object.freeze({dispose() {
    if (disposalComplete) return;
    disposed = true;
    request++;
    viewport.removeEventListener('click', click);
    disposalComplete = true;
  }});
}
