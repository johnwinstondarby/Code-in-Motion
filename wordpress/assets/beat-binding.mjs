// WordPress presentation over immutable grouping and a read-only canonical projection.
export function createWordPressBeatBinding({root, beats, boundaryIds, observation, seek, onError}) {
  const document = root.ownerDocument;
  const transport = root.querySelector('[data-cim-transport-controls]');
  if (transport === null) throw new TypeError('Beat controls require mounted Transport.');
  const indices = new Map(boundaryIds.map((id,index) => [id,index]));
  const beatByBoundary = new Map(beats.flatMap(beat => beat.boundaryIds.map(id => [id,beat])));
  const container = document.createElement('div');
  container.setAttribute('data-cim-beat-controls','');
  const progress = document.createElement('output');
  progress.setAttribute('data-cim-beat-progress','');
  progress.setAttribute('aria-label','Lesson beat progress');
  const markers = document.createElement('div');
  markers.setAttribute('data-cim-beat-markers','');
  markers.setAttribute('role','group');
  markers.setAttribute('aria-label','Lesson beats');
  container.appendChild(progress); container.appendChild(markers);
  const installed = [];
  let disposed = false;
  let disposalComplete = false;
  const controls = [];
  function refresh() {
    if (disposed) return;
    const canonical = observation.snapshot().canonical;
    if (!Object.isFrozen(canonical) || !indices.has(canonical.currentStepId) || !indices.has(canonical.revealFrontier) ||
        indices.get(canonical.currentStepId) > indices.get(canonical.revealFrontier)) {
      throw new TypeError('Beat presentation requires known fresh canonical identities.');
    }
    const active = beatByBoundary.get(canonical.currentStepId);
    const label = active === undefined ? `Start · ${beats.length} beats` : `${active.ordinal} / ${beats.length} · ${active.heading}`;
    if (progress.textContent !== label) progress.textContent = label;
    for (const {beat,button} of controls) {
      if (active?.id === beat.id) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
  }
  function dispose() {
    if (disposalComplete) return;
    disposed = true;
    const errors = [];
    for (const [button,listener] of installed) {
      try { button.removeEventListener('click',listener); } catch (error) { errors.push(error); }
    }
    if (container.parentNode) {
      try { container.parentNode.removeChild(container); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors,'Beat binding disposal failed.');
    disposalComplete = true;
  }
  try {
    for (const beat of beats) {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('data-cim-beat-marker',beat.id);
      button.setAttribute('aria-label',`Go to beat ${beat.ordinal}: ${beat.heading}`);
      button.textContent = `${beat.ordinal} ${beat.heading}`;
      const listener = event => {
        if (disposed || event.defaultPrevented) return;
        try { Promise.resolve(seek(beat.finalStepId,'marker')).then(refresh).catch(onError); }
        catch (error) { onError(error); }
      };
      button.addEventListener('click',listener); installed.push([button,listener]);
      markers.appendChild(button); controls.push({beat,button});
    }
    refresh(); transport.appendChild(container);
  } catch (error) {
    try { dispose(); } catch (cleanupError) { throw new AggregateError([error,cleanupError],'Beat binding rollback failed.'); }
    throw error;
  }
  return Object.freeze({refresh,dispose});
}
