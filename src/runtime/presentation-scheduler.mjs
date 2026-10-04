const RATE_MIN = 0.5;
const RATE_MAX = 2.0;

function fail(message) {
  throw new TypeError(message);
}

function assertFunction(value, label) {
  if (typeof value !== 'function') fail(`${label} must be a function.`);
}

function assertSourceClock(sourceScheduler) {
  if (!sourceScheduler || typeof sourceScheduler !== 'object') {
    fail('presentation scheduler sourceScheduler must be an object.');
  }
  assertFunction(sourceScheduler.now, 'presentation scheduler sourceScheduler.now');
}

function assertDelayScheduler(sourceScheduler) {
  assertFunction(sourceScheduler.schedule, 'presentation scheduler sourceScheduler.schedule');
  assertFunction(sourceScheduler.cancel, 'presentation scheduler sourceScheduler.cancel');
}

function assertFrameScheduler(sourceScheduler) {
  assertFunction(sourceScheduler.onFrame, 'presentation scheduler sourceScheduler.onFrame');
  assertFunction(sourceScheduler.cancel, 'presentation scheduler sourceScheduler.cancel');
}

function readSourceNow(sourceScheduler) {
  const value = sourceScheduler.now.call(sourceScheduler);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('presentation scheduler source time must be a finite non-negative number.');
  }
  return value;
}

export function assertPlaybackRate(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < RATE_MIN || rate > RATE_MAX) {
    throw new RangeError(`playback rate must be a finite number from ${RATE_MIN} through ${RATE_MAX}.`);
  }
  return rate;
}

export function createPresentationScheduler({ sourceScheduler, initialRate = 1 }) {
  assertSourceClock(sourceScheduler);
  let rate = assertPlaybackRate(initialRate);
  let anchorSourceNow = readSourceNow(sourceScheduler);
  let anchorPresentationNow = 0;
  let sequence = 0;
  const delays = new Map();
  const frames = new Map();

  function nextHandle(kind) {
    sequence += 1;
    return Symbol(`cim-presentation-${kind}-${sequence}`);
  }

  function presentationNowAt(sourceNow) {
    return anchorPresentationNow + Math.max(0, sourceNow - anchorSourceNow) * rate;
  }

  function presentationNow() {
    return presentationNowAt(readSourceNow(sourceScheduler));
  }

  function cancelSourceHandle(entry) {
    if (entry.sourceHandle === null) return false;
    const sourceHandle = entry.sourceHandle;
    entry.sourceHandle = null;
    sourceScheduler.cancel.call(sourceScheduler, sourceHandle);
    return true;
  }

  function armDelay(handle, entry, currentPresentationNow = presentationNow()) {
    entry.generation += 1;
    const generation = entry.generation;
    const remainingPresentationMs = Math.max(0, entry.duePresentationTime - currentPresentationNow);
    const sourceDelayMs = remainingPresentationMs / rate;
    const wrapped = () => {
      if (!delays.has(handle) || entry.generation !== generation) return;
      delays.delete(handle);
      entry.sourceHandle = null;
      entry.callback(presentationNow());
    };
    const sourceHandle = sourceScheduler.schedule.call(sourceScheduler, wrapped, sourceDelayMs);
    if (delays.has(handle) && entry.generation === generation) entry.sourceHandle = sourceHandle;
  }

  const scheduler = Object.freeze({
    now() {
      return presentationNow();
    },

    schedule(callback, delayMs) {
      assertFunction(callback, 'presentation scheduler callback');
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new RangeError('presentation scheduler delay must be a finite non-negative number.');
      }
      assertDelayScheduler(sourceScheduler);
      const handle = nextHandle('delay');
      const now = presentationNow();
      const entry = {
        callback,
        duePresentationTime: now + delayMs,
        sourceHandle: null,
        generation: 0
      };
      delays.set(handle, entry);
      try {
        armDelay(handle, entry, now);
      } catch (error) {
        delays.delete(handle);
        throw error;
      }
      return handle;
    },

    cancel(handle) {
      const delay = delays.get(handle);
      if (delay) {
        delays.delete(handle);
        cancelSourceHandle(delay);
        return true;
      }
      const frame = frames.get(handle);
      if (frame) {
        frames.delete(handle);
        if (frame.sourceHandle !== null) {
          sourceScheduler.cancel.call(sourceScheduler, frame.sourceHandle);
          frame.sourceHandle = null;
        }
        return true;
      }
      return false;
    },

    onFrame(callback) {
      assertFunction(callback, 'presentation scheduler frame callback');
      assertFrameScheduler(sourceScheduler);
      const handle = nextHandle('frame');
      const entry = { callback, sourceHandle: null };
      frames.set(handle, entry);
      try {
        const sourceHandle = sourceScheduler.onFrame.call(sourceScheduler, () => {
          if (!frames.has(handle)) return;
          callback(presentationNow());
        });
        if (frames.has(handle)) entry.sourceHandle = sourceHandle;
      } catch (error) {
        frames.delete(handle);
        throw error;
      }
      return handle;
    }
  });

  const control = Object.freeze({
    rate() {
      return rate;
    },

    setRate(nextRate) {
      nextRate = assertPlaybackRate(nextRate);
      if (nextRate === rate) return Object.freeze({ changed: false, fromRate: rate, toRate: rate });

      const sourceNow = readSourceNow(sourceScheduler);
      const currentPresentationNow = presentationNowAt(sourceNow);
      const fromRate = rate;
      anchorSourceNow = sourceNow;
      anchorPresentationNow = currentPresentationNow;
      rate = nextRate;

      const scheduleErrors = [];
      for (const [handle, entry] of delays.entries()) {
        try {
          cancelSourceHandle(entry);
          armDelay(handle, entry, currentPresentationNow);
        } catch (error) {
          scheduleErrors.push(error);
        }
      }
      if (scheduleErrors.length > 0) {
        throw new AggregateError(scheduleErrors, 'presentation scheduler failed to re-arm delayed work after rate change.');
      }

      return Object.freeze({ changed: true, fromRate, toRate: nextRate });
    }
  });

  return Object.freeze({ scheduler, control });
}
