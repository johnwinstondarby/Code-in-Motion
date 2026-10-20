// Tests-first stub: intentionally no tab or transport semantics.
export function mountMultiPaneControls({root}) {
  root.textContent='Multi-pane controls stub';
  return Object.freeze({dispose(){root.textContent='';}});
}
