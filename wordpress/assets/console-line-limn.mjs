// Learner-action presentation only. Never reads or changes engine state or renderer data.
export function createConsoleLineLimn({ rendererRoot, viewport, onError }) {
  const view = rendererRoot.ownerDocument.defaultView;
  let disposed = false;
  let frame = null;
  let timer = null;
  let generation = 0;
  let targets = [];
  let activeStep = null;

  function clear() {
    generation += 1;
    if (frame !== null) view.cancelAnimationFrame(frame);
    if (timer !== null) view.clearTimeout(timer);
    frame = timer = null;
    for (const target of targets) target.removeAttribute('data-cim-line-limn');
    targets = [];
    activeStep = null;
  }

  function show({ beatId, instruction, stepId }) {
    if (disposed) return;
    clear();
    const entry = [...rendererRoot.querySelectorAll('[data-role="entry"]')]
      .find(node => node.getAttribute('data-beat') === beatId);
    if (!entry || !instruction) return;
    if (instruction.anchor === 'command') {
      targets = [entry.querySelector('[data-role="command-line"]')].filter(Boolean);
    } else if (instruction.anchor === 'response') {
      targets = [entry.querySelector('[data-role="response"]')?.closest('[data-role="output-line"]')].filter(Boolean);
    } else {
      const evidence = new Set(instruction.evidence);
      targets = [...entry.querySelectorAll('[data-role="output-line"]')]
        .filter(node => evidence.has(node.getAttribute('data-output-id')));
    }
    if (!targets.length) return;
    activeStep = stepId;
    // Existing seek repositioning has finished. Bring the actual first target into view,
    // then start the cue on the next painted frame, even when playback is paused.
    const top = targets[0].getBoundingClientRect().top;
    const viewportTop = viewport.getBoundingClientRect().top;
    const headerHeight = rendererRoot.querySelector('[data-role="titlebar"]')?.getBoundingClientRect().height ?? 0;
    viewport.scrollTop = Math.max(0, viewport.scrollTop + top - viewportTop - headerHeight - 8);
    const request = generation;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      if (disposed || request !== generation) return;
      try {
        const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches ||
          new URL(view.location.href).searchParams.get('cim-motion-policy') === 'reduce' ||
          [...rendererRoot.ownerDocument.querySelectorAll('script[data-cim-motion-policy]')]
            .some(script => script.getAttribute('data-cim-motion-policy') === 'reduce');
        for (const target of targets) target.setAttribute('data-cim-line-limn', reduced ? 'steady' : 'flash');
        if (!reduced) timer = view.setTimeout(() => {
          timer = null;
          if (disposed || request !== generation) return;
          for (const target of targets) target.setAttribute('data-cim-line-limn', 'quiet');
        }, 1200);
      } catch (error) { clear(); onError(error); }
    });
  }

  return Object.freeze({
    show,
    refresh(stepId) { if (activeStep !== null && stepId !== activeStep) clear(); },
    dispose() { disposed = true; clear(); }
  });
}
