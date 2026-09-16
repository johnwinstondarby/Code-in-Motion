import {
  REDUCED_MOTION_PREFERENCE_KEYS
} from '../accessibility/reduced-motion-preference.mjs';
import {
  REDUCED_MOTION_CHANGE_KEYS,
  REDUCED_MOTION_CHANGE_RECORD_KEYS
} from '../accessibility/reduced-motion-preference-source.mjs';
import { CIM_INSTANCE_PUBLIC_KEYS } from '../contracts/runtime-instance.mjs';
import { createCiMInstance } from '../runtime/cim-instance.mjs';

export const HOST_CIM_INSTANCE_OPTIONS_KEYS = Object.freeze([
  'instanceId',
  'experience',
  'clock',
  'renderer',
  'rendererRoot',
  'reducedMotionPreference'
]);

export const HOST_LIVE_CIM_INSTANCE_OPTIONS_KEYS = Object.freeze([
  'instanceId',
  'experience',
  'clock',
  'renderer',
  'rendererRoot',
  'reducedMotionPreference',
  'reducedMotionChanges',
  'diagnostics'
]);

export const HOST_RETAINED_RUNTIME_KEYS = Object.freeze([
  'adoptReducedMotion'
]);

export const HOST_LIVE_CIM_INSTANCE_KEYS = Object.freeze([
  'identity',
  'read',
  'events',
  'initialize',
  'next',
  'previous',
  'seek',
  'home',
  'end',
  'restart',
  'dispose',
  'pause',
  'play'
]);

export const HOST_DIAGNOSTIC_KEYS = Object.freeze(['report']);
export const HOST_DIAGNOSTIC_RECORD_KEYS = Object.freeze([
  'code',
  'component',
  'instanceId',
  'operation',
  'message'
]);

const HOST_LIVE_COMPOSITION_DIAGNOSTIC_CODE = 'CIM-HST-003';

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertExactKeys(value, expected, label) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) fail(`${label} must not contain symbol keys.`);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    fail(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function assertSameKeySet(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    expected.some((key) => !actual.includes(key)) ||
    actual.some((key) => !expected.includes(key))
  ) {
    fail(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function dataValue(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail(`${label}.${key} must be an enumerable data property.`);
  }
  return descriptor.value;
}

function readFrozenFunctionCapability(capability, expectedKeys, label) {
  assertPlainObject(capability, label);
  if (!Object.isFrozen(capability)) fail(`${label} must be frozen.`);
  assertExactKeys(capability, expectedKeys, label);

  const methods = {};
  for (const key of expectedKeys) {
    const method = dataValue(capability, key, label);
    if (typeof method !== 'function') fail(`${label}.${key} must be a function.`);
    methods[key] = method;
  }
  return methods;
}

function readReducedMotionPreference(preference) {
  const { read } = readFrozenFunctionCapability(
    preference,
    REDUCED_MOTION_PREFERENCE_KEYS,
    'Host reduced-motion preference'
  );
  return readReducedMotionValue(read);
}

function readReducedMotionValue(read) {
  const reducedMotion = read();
  if (typeof reducedMotion !== 'boolean') {
    fail('Host reduced-motion preference.read must return boolean.');
  }
  return reducedMotion;
}

function readReducedMotionChangeRecord(record) {
  assertPlainObject(record, 'Host reduced-motion change record');
  if (!Object.isFrozen(record)) fail('Host reduced-motion change record must be frozen.');
  assertExactKeys(record, REDUCED_MOTION_CHANGE_RECORD_KEYS, 'Host reduced-motion change record');
  const reducedMotion = dataValue(record, 'reducedMotion', 'Host reduced-motion change record');
  if (typeof reducedMotion !== 'boolean') {
    fail('Host reduced-motion change record.reducedMotion must be boolean.');
  }
  return reducedMotion;
}

function errorMessage(error) {
  if (error instanceof Error && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  try {
    return String(error);
  } catch {
    return 'Unknown Host live-composition failure.';
  }
}

function reportHostDiagnostic(report, instanceId, operation, error) {
  const record = Object.freeze({
    code: HOST_LIVE_COMPOSITION_DIAGNOSTIC_CODE,
    component: 'host',
    instanceId,
    operation,
    message: errorMessage(error)
  });
  assertExactKeys(record, HOST_DIAGNOSTIC_RECORD_KEYS, 'Host diagnostic record');

  try {
    report(record);
  } catch {
    // A diagnostic sink cannot alter Host or Runtime control flow.
  }
}

function assertRuntimePublicSurface(instance) {
  const ownKeys = Reflect.ownKeys(instance);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    fail('Runtime public surface must not contain symbol keys.');
  }

  const prototype = Object.getPrototypeOf(instance);
  const prototypeKeys = Reflect.ownKeys(prototype).filter((key) => key !== 'constructor');
  if (prototypeKeys.some((key) => typeof key !== 'string')) {
    fail('Runtime public prototype surface must not contain symbol keys.');
  }

  assertSameKeySet(
    [...ownKeys, ...prototypeKeys],
    CIM_INSTANCE_PUBLIC_KEYS,
    'Runtime public surface'
  );
}

function assertHostSurfaceContract() {
  const expectedHostKeys = CIM_INSTANCE_PUBLIC_KEYS.filter(
    (key) => !HOST_RETAINED_RUNTIME_KEYS.includes(key)
  );
  assertSameKeySet(
    HOST_LIVE_CIM_INSTANCE_KEYS,
    expectedHostKeys,
    'Host live CiM instance surface'
  );
}

assertHostSurfaceContract();

function createRuntime({ instanceId, experience, clock, renderer, rendererRoot }, reducedMotion) {
  return createCiMInstance({
    instanceId,
    experience,
    clock,
    renderer,
    rendererRoot,
    reducedMotion
  });
}

function primaryWithCleanupFailures(primaryError, cleanupErrors) {
  if (cleanupErrors.length === 0) return primaryError;
  return new AggregateError(
    [primaryError, ...cleanupErrors],
    'Host live CiM construction failed and compensating cleanup also failed.',
    { cause: primaryError }
  );
}

async function cleanupFailedLiveConstruction(instance, unsubscribe) {
  const cleanupErrors = [];

  if (typeof unsubscribe === 'function') {
    try {
      unsubscribe();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  let runtimeDisposePromise = null;
  try {
    runtimeDisposePromise = instance.dispose();
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (runtimeDisposePromise !== null) {
    try {
      await runtimeDisposePromise;
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  return cleanupErrors;
}

function createHostDispose(instance, unsubscribe, report, instanceId) {
  let disposePromise = null;

  return function dispose() {
    if (disposePromise !== null) return disposePromise;

    let resolveDispose;
    let rejectDispose;
    disposePromise = new Promise((resolve, reject) => {
      resolveDispose = resolve;
      rejectDispose = reject;
    });

    let unsubscribeError = null;
    try {
      unsubscribe();
    } catch (error) {
      unsubscribeError = error;
      reportHostDiagnostic(report, instanceId, 'reduced_motion_unsubscribe', error);
    }

    let runtimeDisposePromise;
    try {
      runtimeDisposePromise = instance.dispose();
    } catch (error) {
      runtimeDisposePromise = Promise.reject(error);
    }

    Promise.resolve(runtimeDisposePromise).then(
      (value) => {
        if (unsubscribeError !== null) {
          rejectDispose(unsubscribeError);
          return;
        }
        resolveDispose(value);
      },
      (runtimeError) => {
        if (unsubscribeError === null) {
          rejectDispose(runtimeError);
          return;
        }
        rejectDispose(new AggregateError(
          [runtimeError, unsubscribeError],
          'Host and Runtime disposal both failed.',
          { cause: runtimeError }
        ));
      }
    );

    return disposePromise;
  };
}

function createHostFacade(instance, unsubscribe, report, instanceId) {
  assertRuntimePublicSurface(instance);
  const dispose = createHostDispose(instance, unsubscribe, report, instanceId);
  const facade = {};

  for (const key of HOST_LIVE_CIM_INSTANCE_KEYS) {
    if (key === 'dispose') {
      facade[key] = dispose;
      continue;
    }

    if (key === 'identity' || key === 'read' || key === 'events') {
      facade[key] = instance[key];
      continue;
    }

    const method = instance[key];
    if (typeof method !== 'function') {
      fail(`Runtime public surface.${key} must be a function.`);
    }
    facade[key] = (...args) => method.apply(instance, args);
  }

  assertExactKeys(facade, HOST_LIVE_CIM_INSTANCE_KEYS, 'Host live CiM instance');
  return Object.freeze(facade);
}

export function createHostCiMInstance(optionsInput) {
  assertPlainObject(optionsInput, 'Host CiM instance options');
  assertExactKeys(optionsInput, HOST_CIM_INSTANCE_OPTIONS_KEYS, 'Host CiM instance options');

  const instanceId = dataValue(optionsInput, 'instanceId', 'Host CiM instance options');
  const experience = dataValue(optionsInput, 'experience', 'Host CiM instance options');
  const clock = dataValue(optionsInput, 'clock', 'Host CiM instance options');
  const renderer = dataValue(optionsInput, 'renderer', 'Host CiM instance options');
  const rendererRoot = dataValue(optionsInput, 'rendererRoot', 'Host CiM instance options');
  const reducedMotionPreference = dataValue(
    optionsInput,
    'reducedMotionPreference',
    'Host CiM instance options'
  );

  const reducedMotion = readReducedMotionPreference(reducedMotionPreference);

  return createRuntime({ instanceId, experience, clock, renderer, rendererRoot }, reducedMotion);
}

export async function createLiveHostCiMInstance(optionsInput) {
  assertPlainObject(optionsInput, 'Host live CiM instance options');
  assertExactKeys(optionsInput, HOST_LIVE_CIM_INSTANCE_OPTIONS_KEYS, 'Host live CiM instance options');

  const instanceId = dataValue(optionsInput, 'instanceId', 'Host live CiM instance options');
  const experience = dataValue(optionsInput, 'experience', 'Host live CiM instance options');
  const clock = dataValue(optionsInput, 'clock', 'Host live CiM instance options');
  const renderer = dataValue(optionsInput, 'renderer', 'Host live CiM instance options');
  const rendererRoot = dataValue(optionsInput, 'rendererRoot', 'Host live CiM instance options');
  const reducedMotionPreference = dataValue(
    optionsInput,
    'reducedMotionPreference',
    'Host live CiM instance options'
  );
  const reducedMotionChanges = dataValue(
    optionsInput,
    'reducedMotionChanges',
    'Host live CiM instance options'
  );
  const diagnostics = dataValue(optionsInput, 'diagnostics', 'Host live CiM instance options');

  const { read } = readFrozenFunctionCapability(
    reducedMotionPreference,
    REDUCED_MOTION_PREFERENCE_KEYS,
    'Host reduced-motion preference'
  );
  const { subscribe } = readFrozenFunctionCapability(
    reducedMotionChanges,
    REDUCED_MOTION_CHANGE_KEYS,
    'Host reduced-motion changes'
  );
  const { report } = readFrozenFunctionCapability(
    diagnostics,
    HOST_DIAGNOSTIC_KEYS,
    'Host diagnostics'
  );

  const initialReducedMotion = readReducedMotionValue(read);
  const instance = createRuntime(
    { instanceId, experience, clock, renderer, rendererRoot },
    initialReducedMotion
  );

  let unsubscribe = null;
  try {
    assertRuntimePublicSurface(instance);

    const candidateUnsubscribe = subscribe((record) => {
      try {
        instance.adoptReducedMotion(readReducedMotionChangeRecord(record));
      } catch (error) {
        reportHostDiagnostic(report, instanceId, 'reduced_motion_adoption', error);
      }
    });

    if (typeof candidateUnsubscribe === 'function') unsubscribe = candidateUnsubscribe;
    if (typeof candidateUnsubscribe !== 'function' || !Object.isFrozen(candidateUnsubscribe)) {
      fail('Host reduced-motion changes.subscribe must return a frozen unsubscribe function.');
    }

    const currentReducedMotion = readReducedMotionValue(read);
    if (currentReducedMotion !== initialReducedMotion) {
      instance.adoptReducedMotion(currentReducedMotion);
    }

    return createHostFacade(instance, unsubscribe, report, instanceId);
  } catch (primaryError) {
    const cleanupErrors = await cleanupFailedLiveConstruction(instance, unsubscribe);
    throw primaryWithCleanupFailures(primaryError, cleanupErrors);
  }
}
