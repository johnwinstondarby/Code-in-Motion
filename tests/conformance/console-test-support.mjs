// Shared virtual-time support for console/v1 conformance tests (not a test file).
// The scheduler stands in for Runtime's injected scheduler: virtual time advances only when a
// test runs callbacks, in (due time, schedule order) order, so animation is fully deterministic.
export function virtualScheduler() {
  let now = 0;
  let sequence = 0;
  const queue = new Map();
  const counts = { schedule: 0, onFrame: 0 };
  return {
    counts,
    now: () => now,
    schedule: (fn, ms) => { counts.schedule += 1; sequence += 1; queue.set(sequence, { at: now + ms, order: sequence, fn }); return sequence; },
    cancel: (handle) => queue.delete(handle),
    onFrame: () => { counts.onFrame += 1; sequence += 1; return sequence; },
    pending: () => queue.size,
    time: () => now,
    runNext() {
      let next = null;
      for (const [handle, item] of queue) if (next === null || item.at < next.item.at || (item.at === next.item.at && item.order < next.item.order)) next = { handle, item };
      if (next === null) return false;
      queue.delete(next.handle);
      now = next.item.at;
      next.item.fn();
      return true;
    },
    advanceTo(ms) {
      for (;;) {
        let due = null;
        for (const item of queue.values()) if (item.at <= ms && (due === null || item.at < due)) due = item.at;
        if (due === null) break;
        this.runNext();
      }
      now = Math.max(now, ms);
    }
  };
}

const settledFlag = (promise) => {
  const box = { state: 'pending', error: null };
  promise.then(() => { box.state = 'resolved'; }, (error) => { box.state = 'rejected'; box.error = error; });
  return box;
};
const microtasks = () => new Promise((resolve) => setImmediate(resolve));

// Drives virtual time until the render promise settles. Throws if it can never settle.
export async function drain(promise, scheduler) {
  const box = settledFlag(promise);
  await microtasks();
  while (box.state === 'pending') {
    if (!scheduler.runNext()) {
      await microtasks();
      if (box.state === 'pending' && scheduler.pending() === 0) throw new Error('render never settled: no scheduled work remains');
    } else {
      await microtasks();
    }
  }
  if (box.state === 'rejected') throw box.error;
}
