// Distinguish native scrolling from focus/selection/layout movement. Never prevent input.
export function createPaneScrollIntent({ viewport }) {
  const view = viewport.ownerDocument.defaultView;
  const document = viewport.ownerDocument;
  let lastInput = -Infinity;
  let draggingScrollbar = false;
  let disposed = false;
  let disposalComplete = false;
  const installed = [];
  function mark() { if (!disposed) lastInput = view.performance.now(); }
  const keys = new Set(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ']);
  const listeners = [
    [viewport, 'wheel', mark],
    [viewport, 'touchmove', mark],
    [viewport, 'keydown', event => {
      if (event.target === viewport && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && keys.has(event.key)) mark();
    }],
    [viewport, 'pointerdown', event => {
      const box = viewport.getBoundingClientRect();
      draggingScrollbar = event.target === viewport && event.clientX >= box.left + viewport.clientLeft + viewport.clientWidth;
      if (draggingScrollbar) mark();
    }],
    [document, 'pointermove', () => { if (draggingScrollbar) mark(); }],
    [document, 'pointerup', () => { draggingScrollbar = false; }],
    [viewport, 'scrollend', () => { lastInput = -Infinity; }],
    [viewport, 'focusin', () => { lastInput = -Infinity; }]
  ];
  function dispose() {
    if (disposalComplete) return;
    disposed = true;
    const errors = [];
    for (const [target, type, listener] of installed) {
      try { target.removeEventListener(type, listener); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Pane scroll intent disposal failed.');
    disposalComplete = true;
  }
  try {
    for (const [target, type, listener] of listeners) {
      target.addEventListener(type, listener, {passive:true});
      installed.push([target, type, listener]);
    }
  } catch (error) {
    try { dispose(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Scroll intent rollback failed.'); }
    throw error;
  }
  return Object.freeze({
    read: () => !disposed && (draggingScrollbar || view.performance.now() - lastInput < 1000),
    dispose
  });
}
