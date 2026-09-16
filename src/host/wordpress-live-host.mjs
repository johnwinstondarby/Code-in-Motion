import { createReducedMotionPreferenceSource } from '../accessibility/reduced-motion-preference-source.mjs';
import {
  HOST_DIAGNOSTIC_KEYS,
  HOST_DIAGNOSTIC_RECORD_KEYS,
  createLiveHostCiMInstance
} from './cim-instance.mjs';

export const WORDPRESS_LIVE_HOST_OPTIONS_KEYS = Object.freeze([
  'document',
  'matchMedia',
  'experienceLoader',
  'rendererResolver',
  'clockFactory',
  'diagnostics'
]);

export const WORDPRESS_LIVE_HOST_KEYS = Object.freeze(['mount', 'dispose']);
export const WORDPRESS_EXPERIENCE_LOADER_KEYS = Object.freeze(['load']);
export const WORDPRESS_RENDERER_RESOLVER_KEYS = Object.freeze(['resolve']);
export const WORDPRESS_CLOCK_FACTORY_KEYS = Object.freeze(['create']);
export const WORDPRESS_MOUNT_RESULT_KEYS = Object.freeze(['mounted', 'fallback']);

const ROOT_SELECTOR = '[data-cim-experience]';
const RENDERER_ROOT_SELECTOR = '[data-cim-renderer-root]';
const EXPERIENCE_ATTRIBUTE = 'data-cim-experience';
const INSTANCE_ATTRIBUTE = 'data-cim-instance';
const STATE_ATTRIBUTE = 'data-cim-state';
const PAGE_DIAGNOSTIC_INSTANCE_ID = 'wordpress-host';
const HOST_LOAD_DIAGNOSTIC_CODE = 'CIM-HST-001';
const HOST_MOUNT_DIAGNOSTIC_CODE = 'CIM-HST-004';
const RENDERER_RESOLUTION_DIAGNOSTIC_CODE = 'CIM-RND-001';

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

function assertDocument(document) {
  if (document === null || (typeof document !== 'object' && typeof document !== 'function')) {
    fail('WordPress Host document must be an object.');
  }
  if (typeof document.querySelectorAll !== 'function') {
    fail('WordPress Host document must expose querySelectorAll().');
  }
}

function assertMatchMedia(matchMedia) {
  if (typeof matchMedia !== 'function') {
    fail('WordPress Host matchMedia must be a function.');
  }
}

function assertRoot(root) {
  if (root === null || (typeof root !== 'object' && typeof root !== 'function')) {
    fail('WordPress CiM root must be an object.');
  }
  for (const method of ['getAttribute', 'setAttribute', 'querySelector']) {
    if (typeof root[method] !== 'function') {
      fail(`WordPress CiM root must expose ${method}().`);
    }
  }
}

function readAttribute(root, name) {
  const value = root.getAttribute(name);
  if (value === null) return null;
  if (typeof value !== 'string') fail(`WordPress CiM root ${name} must be string or null.`);
  return value.trim();
}

function readRendererId(experience) {
  if (experience === null || typeof experience !== 'object' || !Object.isFrozen(experience)) {
    fail('WordPress experience loader must return a frozen validated experience.');
  }
  const descriptor = Object.getOwnPropertyDescriptor(experience, 'renderer');
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    fail('WordPress loaded experience.renderer must be an enumerable data property.');
  }
  if (typeof descriptor.value !== 'string' || descriptor.value.trim().length === 0) {
    fail('WordPress loaded experience.renderer must be a non-empty string.');
  }
  return descriptor.value;
}

function errorMessage(error) {
  if (error instanceof Error && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  try {
    return String(error);
  } catch {
    return 'Unknown WordPress Host failure.';
  }
}

function reportDiagnostic(report, { code, component = 'host', instanceId, operation, error }) {
  const record = Object.freeze({
    code,
    component,
    instanceId,
    operation,
    message: errorMessage(error)
  });
  assertExactKeys(record, HOST_DIAGNOSTIC_RECORD_KEYS, 'WordPress Host diagnostic record');
  try {
    report(record);
  } catch {
    // Diagnostics cannot alter page fallback or Runtime control flow.
  }
}

function createMountResult(mounted, fallback) {
  const result = Object.freeze({ mounted, fallback });
  assertExactKeys(result, WORDPRESS_MOUNT_RESULT_KEYS, 'WordPress Host mount result');
  return result;
}

function deriveDescriptor(root, ordinal, seenInstanceIds) {
  assertRoot(root);
  const experienceId = readAttribute(root, EXPERIENCE_ATTRIBUTE);
  const explicitInstanceId = readAttribute(root, INSTANCE_ATTRIBUTE);
  const fallbackInstanceId = `cim:${ordinal + 1}`;
  const instanceId = explicitInstanceId && explicitInstanceId.length > 0
    ? explicitInstanceId
    : experienceId && experienceId.length > 0
      ? `cim:${experienceId}:${ordinal + 1}`
      : fallbackInstanceId;

  if (!experienceId) {
    return {
      root,
      instanceId,
      experienceId: null,
      error: new TypeError('WordPress CiM root data-cim-experience must be a non-empty string.')
    };
  }

  if (seenInstanceIds.has(instanceId)) {
    return {
      root,
      instanceId,
      experienceId,
      error: new TypeError(`WordPress CiM instance ID must be unique on the page: ${instanceId}.`)
    };
  }
  seenInstanceIds.add(instanceId);

  let rendererRoot;
  try {
    rendererRoot = root.querySelector(RENDERER_ROOT_SELECTOR) ?? root;
  } catch (error) {
    return { root, instanceId, experienceId, error };
  }
  if (rendererRoot === null || (typeof rendererRoot !== 'object' && typeof rendererRoot !== 'function')) {
    return {
      root,
      instanceId,
      experienceId,
      error: new TypeError('WordPress CiM renderer root must be an object.')
    };
  }

  return { root, instanceId, experienceId, rendererRoot, error: null };
}

function projectState(root, state) {
  root.setAttribute(STATE_ATTRIBUTE, state);
}

function projectFallback(root, report, instanceId) {
  try {
    projectState(root, 'fallback');
  } catch (error) {
    reportDiagnostic(report, {
      code: HOST_MOUNT_DIAGNOSTIC_CODE,
      instanceId,
      operation: 'fallback_projection',
      error
    });
  }
}

async function cleanupInstance(instance, report, instanceId, operation) {
  if (instance === null) return;
  try {
    await instance.dispose();
  } catch (error) {
    reportDiagnostic(report, {
      code: HOST_MOUNT_DIAGNOSTIC_CODE,
      instanceId,
      operation,
      error
    });
  }
}

export function createWordPressLiveHost(optionsInput) {
  assertPlainObject(optionsInput, 'WordPress live Host options');
  assertExactKeys(optionsInput, WORDPRESS_LIVE_HOST_OPTIONS_KEYS, 'WordPress live Host options');

  const document = dataValue(optionsInput, 'document', 'WordPress live Host options');
  const matchMedia = dataValue(optionsInput, 'matchMedia', 'WordPress live Host options');
  const experienceLoader = dataValue(optionsInput, 'experienceLoader', 'WordPress live Host options');
  const rendererResolver = dataValue(optionsInput, 'rendererResolver', 'WordPress live Host options');
  const clockFactory = dataValue(optionsInput, 'clockFactory', 'WordPress live Host options');
  const diagnostics = dataValue(optionsInput, 'diagnostics', 'WordPress live Host options');

  assertDocument(document);
  assertMatchMedia(matchMedia);
  const { load } = readFrozenFunctionCapability(
    experienceLoader,
    WORDPRESS_EXPERIENCE_LOADER_KEYS,
    'WordPress experience loader'
  );
  const { resolve } = readFrozenFunctionCapability(
    rendererResolver,
    WORDPRESS_RENDERER_RESOLVER_KEYS,
    'WordPress renderer resolver'
  );
  const { create } = readFrozenFunctionCapability(
    clockFactory,
    WORDPRESS_CLOCK_FACTORY_KEYS,
    'WordPress clock factory'
  );
  const { report } = readFrozenFunctionCapability(
    diagnostics,
    HOST_DIAGNOSTIC_KEYS,
    'WordPress Host diagnostics'
  );

  let lifecycle = 'idle';
  let mountPromise = null;
  let disposePromise = null;
  let reducedMotionSource = null;
  const mountedRecords = [];
  const disposeStarted = new Set();

  function isDisposing() {
    return lifecycle === 'disposing' || lifecycle === 'disposed';
  }

  async function mountDescriptor(descriptor) {
    const { root, instanceId, experienceId, rendererRoot } = descriptor;
    let stage = 'experience_load';
    let instance = null;

    if (descriptor.error !== null) {
      reportDiagnostic(report, {
        code: HOST_MOUNT_DIAGNOSTIC_CODE,
        instanceId,
        operation: 'invocation',
        error: descriptor.error
      });
      projectFallback(root, report, instanceId);
      return false;
    }

    try {
      const experience = await load(experienceId);
      if (isDisposing()) {
        projectFallback(root, report, instanceId);
        return false;
      }

      stage = 'renderer_resolve';
      const renderer = await resolve(readRendererId(experience));
      if (isDisposing()) {
        projectFallback(root, report, instanceId);
        return false;
      }

      stage = 'clock_create';
      const clock = create();
      if (isDisposing()) {
        projectFallback(root, report, instanceId);
        return false;
      }

      stage = 'instance_create';
      instance = await createLiveHostCiMInstance({
        instanceId,
        experience,
        clock,
        renderer,
        rendererRoot,
        reducedMotionPreference: reducedMotionSource.preference,
        reducedMotionChanges: reducedMotionSource.changes,
        diagnostics
      });

      if (isDisposing()) {
        await cleanupInstance(instance, report, instanceId, 'late_instance_cleanup');
        projectFallback(root, report, instanceId);
        return false;
      }

      stage = 'initialize';
      await instance.initialize();

      if (isDisposing()) {
        await cleanupInstance(instance, report, instanceId, 'late_instance_cleanup');
        projectFallback(root, report, instanceId);
        return false;
      }

      stage = 'ready_projection';
      projectState(root, 'ready');
      if (isDisposing()) {
        projectFallback(root, report, instanceId);
        await cleanupInstance(instance, report, instanceId, 'late_instance_cleanup');
        return false;
      }

      mountedRecords.push({ root, instanceId, experienceId, instance });
      return true;
    } catch (error) {
      await cleanupInstance(instance, report, instanceId, 'failed_mount_cleanup');
      projectFallback(root, report, instanceId);
      reportDiagnostic(report, {
        code: stage === 'experience_load'
          ? HOST_LOAD_DIAGNOSTIC_CODE
          : stage === 'renderer_resolve'
            ? RENDERER_RESOLUTION_DIAGNOSTIC_CODE
            : HOST_MOUNT_DIAGNOSTIC_CODE,
        component: stage === 'renderer_resolve' ? 'renderer' : 'host',
        instanceId,
        operation: stage,
        error
      });
      return false;
    }
  }

  async function runMount() {
    lifecycle = 'mounting';

    let roots;
    try {
      roots = Array.from(document.querySelectorAll(ROOT_SELECTOR));
    } catch (error) {
      reportDiagnostic(report, {
        code: HOST_MOUNT_DIAGNOSTIC_CODE,
        instanceId: PAGE_DIAGNOSTIC_INSTANCE_ID,
        operation: 'discovery',
        error
      });
      if (!isDisposing()) lifecycle = 'ready';
      return createMountResult(0, 0);
    }

    const seenInstanceIds = new Set();
    const descriptors = roots.map((root, ordinal) => {
      try {
        return deriveDescriptor(root, ordinal, seenInstanceIds);
      } catch (error) {
        return {
          root,
          instanceId: `cim:${ordinal + 1}`,
          experienceId: null,
          error
        };
      }
    });

    if (descriptors.length === 0) {
      if (!isDisposing()) lifecycle = 'ready';
      return createMountResult(0, 0);
    }

    try {
      reducedMotionSource = createReducedMotionPreferenceSource({ matchMedia });
    } catch (error) {
      for (const descriptor of descriptors) {
        projectFallback(descriptor.root, report, descriptor.instanceId);
        reportDiagnostic(report, {
          code: HOST_MOUNT_DIAGNOSTIC_CODE,
          instanceId: descriptor.instanceId,
          operation: 'reduced_motion_source',
          error
        });
      }
      if (!isDisposing()) lifecycle = 'ready';
      return createMountResult(0, descriptors.length);
    }

    let mounted = 0;
    let fallback = 0;
    for (const descriptor of descriptors) {
      if (await mountDescriptor(descriptor)) mounted += 1;
      else fallback += 1;
    }

    if (!isDisposing()) lifecycle = 'ready';
    return createMountResult(mounted, fallback);
  }

  function mount() {
    if (mountPromise !== null) return mountPromise;
    if (isDisposing()) {
      mountPromise = Promise.reject(new Error('WordPress live Host is disposing or disposed.'));
      return mountPromise;
    }
    mountPromise = runMount();
    return mountPromise;
  }

  function startMountedDisposals(pending, errors) {
    for (const record of mountedRecords) {
      if (disposeStarted.has(record)) continue;
      disposeStarted.add(record);
      projectFallback(record.root, report, record.instanceId);
      try {
        pending.push(Promise.resolve(record.instance.dispose()));
      } catch (error) {
        errors.push(error);
      }
    }
  }

  function dispose() {
    if (disposePromise !== null) return disposePromise;

    let resolveDispose;
    let rejectDispose;
    disposePromise = new Promise((resolvePromise, rejectPromise) => {
      resolveDispose = resolvePromise;
      rejectDispose = rejectPromise;
    });

    lifecycle = 'disposing';
    const pending = [];
    const errors = [];

    startMountedDisposals(pending, errors);

    if (reducedMotionSource !== null) {
      try {
        reducedMotionSource.changes.dispose();
      } catch (error) {
        errors.push(error);
        reportDiagnostic(report, {
          code: HOST_MOUNT_DIAGNOSTIC_CODE,
          instanceId: PAGE_DIAGNOSTIC_INSTANCE_ID,
          operation: 'reduced_motion_source_dispose',
          error
        });
      }
    }

    Promise.resolve(mountPromise).catch(() => undefined).then(() => {
      startMountedDisposals(pending, errors);
      return Promise.allSettled(pending);
    }).then((settlements) => {
      for (const settlement of settlements) {
        if (settlement.status === 'rejected') errors.push(settlement.reason);
      }
      lifecycle = 'disposed';
      if (errors.length === 0) {
        resolveDispose(true);
      } else if (errors.length === 1) {
        rejectDispose(errors[0]);
      } else {
        rejectDispose(new AggregateError(errors, 'WordPress live Host disposal failed.'));
      }
    });

    return disposePromise;
  }

  const host = { mount, dispose };
  assertExactKeys(host, WORDPRESS_LIVE_HOST_KEYS, 'WordPress live Host');
  return Object.freeze(host);
}
