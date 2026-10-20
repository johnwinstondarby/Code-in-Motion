// Internal panes/v1 lifecycle. Trusted adapter code only; no registry/admission.
// A finite frame plan bounds completion in shared virtual time, not wall time.
export const PANE_METHODS = Object.freeze(['mount', 'settle', 'play', 'dispose']);

export function readonlyPaneData(value) {
  if (value === null || ['string','number','boolean','undefined'].includes(typeof value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(readonlyPaneData));
  if (typeof value !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw new TypeError('Pane data must be plain JSON data.');
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value,key);
    if (typeof key !== 'string' || ['__proto__','constructor','prototype'].includes(key) || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('Pane data cannot contain capabilities or accessors.');
    result[key] = readonlyPaneData(descriptor.value);
  }
  return Object.freeze(result);
}

export function paneBoundary(context) {
  // Explicit projection: never spread an external renderer/host context.
  if (typeof context.stepId !== 'string' || !context.stepId) throw new TypeError('Pane boundary identity must be a non-empty string.');
  return Object.freeze({ stepId: context.stepId, stepRendererConfig: readonlyPaneData(context.stepRendererConfig ?? null) });
}

export function paneTransition(context) {
  return Object.freeze({ ...paneBoundary(context), fromState: readonlyPaneData(context.fromState),
    animate: context.animate === true, reducedMotion: context.reducedMotion === true,
    clock: Object.freeze({ now: () => context.clock.now(), schedule: (fn,ms) => context.clock.schedule(fn,ms), cancel: handle => context.clock.cancel(handle) }),
    cancellation: Object.freeze({ get aborted() { return context.abortSignal.aborted; }, get reason() { return context.abortSignal.reason; }, onAbort: fn => context.abortSignal.onAbort(fn) }) });
}

// definition is registered implementation code. It sees only container handles,
// immutable config/state/identity and projected boundary data; never the caller.
export function createPaneLifecycle(definition) {
  let container = null, config = null, identity = null, active = null;
  let disposed = false;
  const cancel = reason => active?.finish({ status: 'cancelled', reason });
  function mount(target, validatedConfig, restrictedIdentity) {
    if (container !== null) throw new Error('Pane is already mounted.');
    if (!restrictedIdentity || Object.keys(restrictedIdentity).some(k => !['id','type'].includes(k)) || typeof restrictedIdentity.id !== 'string' || typeof restrictedIdentity.type !== 'string') throw new TypeError('Pane identity must contain only id and type.');
    config = readonlyPaneData(validatedConfig); identity = readonlyPaneData(restrictedIdentity);
    container = target; disposed = false;
  }
  function requireMounted() {
    if (disposed || container === null) throw new Error('Pane must be mounted and not disposed.');
  }
  function checked(state, context) {
    requireMounted();
    const data = readonlyPaneData(state), boundary = paneBoundary(context);
    definition.validate(data, config, boundary);
    return { state: data, context: boundary };
  }
  function settle(state, context) {
    const next = checked(state, context);
    cancel('superseded');
    definition.settle(container, next.state, config, next.context, identity);
  }
  function play(state, context) {
    cancel('superseded');
    let next, frames;
    try {
      next = checked(state, context);
      frames = context.animate && !context.reducedMotion ? definition.frames?.(context.fromState, next.state) : null;
      if (frames != null && !Array.isArray(frames)) throw new TypeError('Pane transition must provide a finite frame array.');
      let budget = 0;
      if (frames !== null && frames !== undefined) for (const frame of frames) {
        budget += frame.delayMs;
        if (!Number.isFinite(frame.delayMs) || frame.delayMs < 0 || !Number.isFinite(budget)) throw new TypeError('Pane transition must have a finite non-negative frame plan.');
      }
    } catch (error) { return Promise.resolve(Object.freeze({ status: 'failed', error })); }
    if (context.cancellation.aborted) return Promise.resolve(Object.freeze({ status: 'cancelled', reason: context.cancellation.reason }));
    return new Promise(resolve => {
      let finished = false, pending = null, unsubscribe = () => {};
      const task = { finish(result) {
        if (finished) return;
        finished = true;
        if (active === task) active = null;
        unsubscribe();
        if (pending !== null) { try { context.clock.cancel(pending); } catch { /* transition facade revoked */ } pending = null; }
        resolve(Object.freeze(result));
      }};
      active = task;
      const off = context.cancellation.onAbort(reason => task.finish({ status: 'cancelled', reason }));
      unsubscribe = off;
      if (finished) { off(); return; } // Handles an abort during subscription.
      const show = index => {
        if (finished || disposed || active !== task) return;
        try {
          if (!frames?.length || index === frames.length - 1) {
            definition.settle(container, next.state, config, next.context, identity);
            task.finish({ status: 'settled' });
          } else {
            definition.frame(container, frames[index], next.state, config, next.context, identity);
            arm(index + 1);
          }
        } catch (error) { task.finish({ status: 'failed', error }); }
      };
      const arm = index => {
        if (!frames?.length || frames[index].delayMs === 0) { show(index); return; }
        try { pending = context.clock.schedule(() => { pending = null; show(index); }, frames[index].delayMs); }
        catch (error) { task.finish({ status: 'failed', error }); }
      };
      arm(0);
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancel('disposed');
    try { definition.dispose?.(container); }
    finally { container = null; config = null; identity = null; }
  }
  return Object.freeze({ mount, settle, play, dispose });
}
