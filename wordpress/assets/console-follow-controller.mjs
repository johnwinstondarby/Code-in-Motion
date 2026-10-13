// Player-local presentation policy. Content identity is rendered text, never renderer state.
export function createConsoleFollowController({ readContent }) {
  if (typeof readContent !== 'function') throw new TypeError('Console follow requires readContent.');
  let priorContent = null;
  let revision = 0;
  let acknowledged = 0;
  let following = true;
  const holds = new Set();

  function fresh() {
    const content = readContent();
    if (typeof content !== 'string') throw new TypeError('Console content must be a string.');
    if (content !== priorContent) {
      // Contraction is a new presentation baseline, not pending new output.
      if (priorContent !== null && content.length < priorContent.length) {
        revision = 0;
        acknowledged = 0;
      } else revision += 1;
      priorContent = content;
    }
    return revision;
  }

  function project() {
    fresh();
    if (following && holds.size === 0) acknowledged = revision;
    return Object.freeze({ following, held: holds.size > 0,
      newerStepsAvailable: revision > acknowledged,
      latestVisibleStepId: revision === 0 ? null : String(revision) });
  }

  return Object.freeze({
    read: project,
    suspend() {
      project();
      following = false;
      return project();
    },
    resume() {
      acknowledged = fresh();
      following = true;
      return project();
    },
    hold(reason) {
      if (!['pointer', 'focus', 'selection'].includes(reason)) throw new TypeError('Unknown Console hold reason.');
      project();
      holds.add(reason);
      return project();
    },
    release(reason) {
      if (!['pointer', 'focus', 'selection'].includes(reason)) throw new TypeError('Unknown Console hold reason.');
      fresh();
      holds.delete(reason);
      return project();
    }
  });
}
