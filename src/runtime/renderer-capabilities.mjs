import { RENDER_CLOCK_KEYS } from '../renderers/interface.mjs';

const NOOP_UNSUBSCRIBE = Object.freeze(() => false);

function assertFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be a function.`);
  }
}

function assertScheduler(scheduler) {
  if (!scheduler || typeof scheduler !== 'object') {
    throw new TypeError('renderer clock scheduler must be an object.');
  }

  for (const method of RENDER_CLOCK_KEYS) {
    assertFunction(scheduler[method], `scheduler.${method}`);
  }
}

function readSourceNow(scheduler) {
  const now = scheduler.now.call(scheduler);
  if (!Number.isFinite(now) || now < 0) {
    throw new RangeError('renderer clock scheduler.now() must return a finite non-negative number.');
  }
  return now;
}

export class RendererCapabilityRevokedError extends Error {
  constructor(capability, transitionId) {
    super(`${capability} capability for transition ${String(transitionId)} has been revoked.`);
    this.name = 'RendererCapabilityRevokedError';
    this.capability = capability;
    this.transitionId = transitionId;
  }
}

export function createRendererAbortCapability() {
  let open = true;
  let aborted = false;
  let reason = null;
  const listeners = new Set();

  const facade = {};
  Object.defineProperties(facade, {
    aborted: {
      enumerable: true,
      get: () => aborted
    },
    reason: {
      enumerable: true,
      get: () => reason
    },
    onAbort: {
      enumerable: true,
      value(fn) {
        assertFunction(fn, 'abortSignal.onAbort callback');

        if (!open) return NOOP_UNSUBSCRIBE;

        if (aborted) {
          fn(reason);
          return NOOP_UNSUBSCRIBE;
        }

        listeners.add(fn);
        let subscribed = true;

        return Object.freeze(() => {
          if (!subscribed) return false;
          subscribed = false;
          return listeners.delete(fn);
        });
      }
    }
  });
  Object.freeze(facade);

  const controller = Object.freeze({
    abort(nextReason = null) {
      if (!open || aborted) {
        return Object.freeze({ changed: false, callbackErrors: Object.freeze([]) });
      }

      aborted = true;
      reason = nextReason ?? null;

      const callbacks = [...listeners];
      listeners.clear();
      const callbackErrors = [];

      for (const callback of callbacks) {
        try {
          callback(reason);
        } catch (error) {
          callbackErrors.push(error);
        }
      }

      return Object.freeze({
        changed: true,
        callbackErrors: Object.freeze(callbackErrors)
      });
    },

    close() {
      if (!open) return false;
      open = false;
      listeners.clear();
      return true;
    }
  });

  return Object.freeze({ facade, controller });
}

export function createRendererClockCapability({ transitionId, scheduler }) {
  if (transitionId === null || transitionId === undefined) {
    throw new TypeError('renderer clock transitionId is required.');
  }
  assertScheduler(scheduler);

  let active = true;
  let paused = false;
  let pausedSourceNow = null;
  let pausedSemanticNow = null;
  let accumulatedPauseMs = 0;
  const handles = new Map();

  function requireActive(operation) {
    if (!active) {
      throw new RendererCapabilityRevokedError(`renderer clock ${operation}`, transitionId);
    }
  }

  function semanticNow() {
    if (paused) return pausedSemanticNow;
    return readSourceNow(scheduler) - accumulatedPauseMs;
  }

  function makeHandle(kind) {
    return Symbol(`cim-renderer-${kind}`);
  }

  function cancelSourceHandle(entry) {
    if (!entry.hasSourceHandle) return false;
    const sourceHandle = entry.sourceHandle;
    entry.sourceHandle = undefined;
    entry.hasSourceHandle = false;
    scheduler.cancel.call(scheduler, sourceHandle);
    return true;
  }

  function armDelay(handle, entry, delayMs) {
    entry.armGeneration += 1;
    const generation = entry.armGeneration;
    const wrapped = () => {
      if (!active || paused || !handles.has(handle) || entry.armGeneration !== generation) return;
      handles.delete(handle);
      entry.sourceHandle = undefined;
      entry.hasSourceHandle = false;
      entry.callback(semanticNow());
    };

    const sourceHandle = scheduler.schedule.call(scheduler, wrapped, delayMs);
    if (handles.has(handle)) {
      entry.sourceHandle = sourceHandle;
      entry.hasSourceHandle = true;
    }
  }

  function armFrame(handle, entry) {
    entry.armGeneration += 1;
    const generation = entry.armGeneration;
    const wrapped = () => {
      if (!active || paused || !handles.has(handle) || entry.armGeneration !== generation) return;
      entry.callback(semanticNow());
    };

    const sourceHandle = scheduler.onFrame.call(scheduler, wrapped);
    if (handles.has(handle)) {
      entry.sourceHandle = sourceHandle;
      entry.hasSourceHandle = true;
    }
  }

  function cancelOwnedHandle(handle) {
    const entry = handles.get(handle);
    if (!entry) return false;

    handles.delete(handle);
    if (entry.hasSourceHandle) {
      cancelSourceHandle(entry);
    }
    return true;
  }

  const facade = Object.freeze({
    now() {
      requireActive('now');
      return semanticNow();
    },

    schedule(fn, ms) {
      requireActive('schedule');
      assertFunction(fn, 'clock.schedule callback');
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError('clock.schedule delay must be a finite non-negative number.');
      }

      const handle = makeHandle('delay');
      const entry = {
        kind: 'delay',
        callback: fn,
        dueSemanticTime: semanticNow() + ms,
        sourceHandle: undefined,
        hasSourceHandle: false,
        armGeneration: 0
      };
      handles.set(handle, entry);

      try {
        if (!paused) armDelay(handle, entry, ms);
      } catch (error) {
        handles.delete(handle);
        throw error;
      }

      return handle;
    },

    cancel(handle) {
      if (!active) return false;
      return cancelOwnedHandle(handle);
    },

    onFrame(fn) {
      requireActive('onFrame');
      assertFunction(fn, 'clock.onFrame callback');

      const handle = makeHandle('frame');
      const entry = {
        kind: 'frame',
        callback: fn,
        sourceHandle: undefined,
        hasSourceHandle: false,
        armGeneration: 0
      };
      handles.set(handle, entry);

      try {
        if (!paused) armFrame(handle, entry);
      } catch (error) {
        handles.delete(handle);
        throw error;
      }

      return handle;
    }
  });

  const controller = Object.freeze({
    pause() {
      requireActive('pause');
      if (paused) {
        return Object.freeze({ changed: false, cancelErrors: Object.freeze([]) });
      }

      pausedSemanticNow = semanticNow();
      pausedSourceNow = readSourceNow(scheduler);
      paused = true;
      const cancelErrors = [];

      for (const entry of handles.values()) {
        if (!entry.hasSourceHandle) continue;
        try {
          cancelSourceHandle(entry);
        } catch (error) {
          entry.sourceHandle = undefined;
          entry.hasSourceHandle = false;
          cancelErrors.push(error);
        }
      }

      return Object.freeze({
        changed: true,
        cancelErrors: Object.freeze(cancelErrors)
      });
    },

    resume() {
      requireActive('resume');
      if (!paused) {
        return Object.freeze({ changed: false, scheduleErrors: Object.freeze([]) });
      }

      const sourceNow = readSourceNow(scheduler);
      accumulatedPauseMs += Math.max(0, sourceNow - pausedSourceNow);
      paused = false;
      pausedSourceNow = null;
      pausedSemanticNow = null;
      const scheduleErrors = [];

      for (const [handle, entry] of handles.entries()) {
        if (entry.hasSourceHandle) continue;
        try {
          if (entry.kind === 'delay') {
            const remaining = Math.max(0, entry.dueSemanticTime - semanticNow());
            armDelay(handle, entry, remaining);
          } else {
            armFrame(handle, entry);
          }
        } catch (error) {
          scheduleErrors.push(error);
        }
      }

      return Object.freeze({
        changed: true,
        scheduleErrors: Object.freeze(scheduleErrors)
      });
    },

    revoke() {
      if (!active) {
        return Object.freeze({ changed: false, cancelErrors: Object.freeze([]) });
      }

      active = false;
      const entries = [...handles.values()];
      handles.clear();
      const cancelErrors = [];

      for (const entry of entries) {
        if (!entry.hasSourceHandle) continue;
        try {
          cancelSourceHandle(entry);
        } catch (error) {
          cancelErrors.push(error);
        }
      }

      return Object.freeze({
        changed: true,
        cancelErrors: Object.freeze(cancelErrors)
      });
    }
  });

  return Object.freeze({ facade, controller });
}
