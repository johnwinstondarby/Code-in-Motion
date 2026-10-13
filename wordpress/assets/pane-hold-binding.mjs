// Native engagement is a temporary movement hold, never a follow suspension.
export function createPaneHoldBinding({ pane, follow, refresh }) {
  const document = pane.ownerDocument;
  let disposed = false;
  let disposalComplete = false;
  const installed = [];
  function set(reason, held) {
    if (disposed) return;
    if (held) follow.hold(reason); else follow.release(reason);
    refresh();
  }
  function selectionHeld() {
    const selection = document.getSelection();
    if (selection === null || selection.isCollapsed) return false;
    for (let index = 0; index < selection.rangeCount; index += 1) {
      if (selection.getRangeAt(index).intersectsNode(pane)) return true;
    }
    return false;
  }
  const listeners = [
    [pane, 'pointerenter', () => set('pointer', true)],
    [pane, 'pointerleave', () => set('pointer', false)],
    [pane, 'pointercancel', () => set('pointer', false)],
    [pane, 'focusin', () => set('focus', true)],
    [pane, 'focusout', event => set('focus', pane.contains(event.relatedTarget))],
    [document, 'selectionchange', () => set('selection', selectionHeld())]
  ];
  function dispose() {
    if (disposalComplete) return;
    disposed = true;
    const errors = [];
    for (const [target, type, listener] of installed) {
      try { target.removeEventListener(type, listener); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Pane hold disposal failed.');
    disposalComplete = true;
  }
  try {
    for (const [target, type, listener] of listeners) {
      target.addEventListener(type, listener);
      installed.push([target, type, listener]);
    }
    if (pane.matches(':hover')) follow.hold('pointer');
    if (pane.contains(document.activeElement)) follow.hold('focus');
    if (selectionHeld()) follow.hold('selection');
  } catch (error) {
    try { dispose(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Pane hold construction rollback failed.');
    }
    throw error;
  }
  return Object.freeze({ dispose });
}
