export const RENDERER_ABORT_ACK_TIMEOUT_MS = 1000;
export const RENDERER_DISPOSE_ACK_TIMEOUT_MS = 1000;
export const RENDERER_ABORT_TIMEOUT_FAULT_CODE = 'CIM-RND-002';
export const RENDERER_DISPOSE_TIMEOUT_FAULT_CODE = 'CIM-RND-003';

function fail(message) {
  throw new TypeError(message);
}

export function waitForRuntimeAcknowledgement({ scheduler, promise, timeoutMs }) {
  if (!scheduler || typeof scheduler !== 'object' || typeof scheduler.schedule !== 'function' || typeof scheduler.cancel !== 'function') {
    fail('runtime acknowledgement wait requires scheduler.schedule() and scheduler.cancel().');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    fail('runtime acknowledgement timeoutMs must be a finite non-negative number.');
  }

  return new Promise((resolve) => {
    let finished = false;
    let timeoutHandle;

    const finish = (outcome) => {
      if (finished) return;
      finished = true;
      if (timeoutHandle !== undefined) {
        try {
          scheduler.cancel.call(scheduler, timeoutHandle);
        } catch {}
      }
      resolve(Object.freeze(outcome));
    };

    Promise.resolve(promise).then(
      (value) => finish({ status: 'fulfilled', value }),
      (error) => finish({ status: 'rejected', error })
    );

    timeoutHandle = scheduler.schedule.call(
      scheduler,
      () => finish({ status: 'timeout' }),
      timeoutMs
    );
  });
}
