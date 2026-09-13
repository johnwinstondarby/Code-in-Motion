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
  const handles = new Map();

  function requireActive(operation) {
    if (!active) {
      throw new RendererCapabilityRevokedError(`renderer clock ${operation}`, transitionId);
    }
  }

  function makeHandle(kind) {
    return Symbol(`cim-renderer-${kind}`);
  }

  function cancelOwnedHandle(handle) {
    const entry = handles.get(handle);
    if (!entry) return false;

    handles.delete(handle);
    if (entry.hasSourceHandle) {
      scheduler.cancel.call(scheduler, entry.sourceHandle);
    }
    return true;
  }

  const facade = Object.freeze({
    now() {
      requireActive('now');
      return scheduler.now.call(scheduler);
    },

    schedule(fn, ms) {
      requireActive('schedule');
      assertFunction(fn, 'clock.schedule callback');
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError('clock.schedule delay must be a finite non-negative number.');
      }

      const handle = makeHandle('delay');
      const entry = { sourceHandle: undefined, hasSourceHandle: false };
      handles.set(handle, entry);

      const wrapped = () => {
        if (!active || !handles.has(handle)) return;
        handles.delete(handle);
        fn(scheduler.now.call(scheduler));
      };

      try {
        const sourceHandle = scheduler.schedule.call(scheduler, wrapped, ms);
        if (handles.has(handle)) {
          entry.sourceHandle = sourceHandle;
          entry.hasSourceHandle = true;
        }
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
      const entry = { sourceHandle: undefined, hasSourceHandle: false };
      handles.set(handle, entry);

      const wrapped = () => {
        if (!active || !handles.has(handle)) return;
        fn(scheduler.now.call(scheduler));
      };

      try {
        const sourceHandle = scheduler.onFrame.call(scheduler, wrapped);
        if (handles.has(handle)) {
          entry.sourceHandle = sourceHandle;
          entry.hasSourceHandle = true;
        }
      } catch (error) {
        handles.delete(handle);
        throw error;
      }

      return handle;
    }
  });

  const controller = Object.freeze({
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
          scheduler.cancel.call(scheduler, entry.sourceHandle);
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
