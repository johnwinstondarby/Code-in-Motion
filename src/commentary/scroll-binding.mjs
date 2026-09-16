import {
  COMMENTARY_FOLLOW_CONTROLLER_KEYS,
  COMMENTARY_FOLLOW_STATE_KEYS
} from './follow-controller.mjs';

export const COMMENTARY_SCROLL_BINDING_KEYS = Object.freeze(['refresh', 'dispose']);
export const COMMENTARY_SCROLL_BINDING_OPTIONS_KEYS = Object.freeze([
  'viewport',
  'indicator',
  'follow',
  'newerStepsLabel'
]);

const END_TOLERANCE_PX = 1;

function fail(message) {
  throw new TypeError(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain object.`);
  }
}

function assertFrozenPlainObject(value, label) {
  assertPlainObject(value, label);
  if (!Object.isFrozen(value)) fail(`${label} must be frozen.`);
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

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string.`);
  return value;
}

function readProperty(object, key, label) {
  try {
    return object[key];
  } catch {
    fail(`${label}.${key} must be readable.`);
  }
}

function requireMethods(object, methods, label) {
  if (object === null || (typeof object !== 'object' && typeof object !== 'function')) {
    fail(`${label} must be an element-like object.`);
  }
  for (const method of methods) {
    if (typeof readProperty(object, method, label) !== 'function') fail(`${label}.${method} must be a function.`);
  }
  return object;
}

function validateViewport(viewport) {
  requireMethods(viewport, ['addEventListener', 'removeEventListener', 'scrollTo'], 'Commentary scroll viewport');
  for (const key of ['scrollTop', 'scrollHeight', 'clientHeight']) readProperty(viewport, key, 'Commentary scroll viewport');
  return viewport;
}

function validateIndicator(indicator) {
  requireMethods(indicator, ['addEventListener', 'removeEventListener'], 'Commentary newer-steps indicator');
  const tagName = readProperty(indicator, 'tagName', 'Commentary newer-steps indicator');
  const type = readProperty(indicator, 'type', 'Commentary newer-steps indicator');
  if (typeof tagName !== 'string' || tagName.toUpperCase() !== 'BUTTON' || type !== 'button') {
    fail('Commentary newer-steps indicator must identify a button with type button.');
  }
  readProperty(indicator, 'hidden', 'Commentary newer-steps indicator');
  readProperty(indicator, 'textContent', 'Commentary newer-steps indicator');
  return indicator;
}

function validateFollow(follow) {
  assertFrozenPlainObject(follow, 'Commentary follow capability');
  assertExactKeys(follow, COMMENTARY_FOLLOW_CONTROLLER_KEYS, 'Commentary follow capability');
  for (const key of COMMENTARY_FOLLOW_CONTROLLER_KEYS) {
    if (typeof dataValue(follow, key, 'Commentary follow capability') !== 'function') {
      fail(`Commentary follow capability.${key} must be a function.`);
    }
  }
  return follow;
}

function validateFollowState(state) {
  assertFrozenPlainObject(state, 'Commentary follow state');
  assertExactKeys(state, COMMENTARY_FOLLOW_STATE_KEYS, 'Commentary follow state');
  const following = dataValue(state, 'following', 'Commentary follow state');
  const newerStepsAvailable = dataValue(state, 'newerStepsAvailable', 'Commentary follow state');
  const latestVisibleStepId = dataValue(state, 'latestVisibleStepId', 'Commentary follow state');
  if (typeof following !== 'boolean') fail('Commentary follow state.following must be a boolean.');
  if (typeof newerStepsAvailable !== 'boolean') fail('Commentary follow state.newerStepsAvailable must be a boolean.');
  if (following && newerStepsAvailable) {
    fail('Commentary follow state cannot report newer steps while following.');
  }
  if (latestVisibleStepId !== null) {
    requireNonEmptyString(latestVisibleStepId, 'Commentary follow state.latestVisibleStepId');
  }
  return Object.freeze({ following, newerStepsAvailable, latestVisibleStepId });
}

function readGeometry(viewport) {
  const scrollTop = readProperty(viewport, 'scrollTop', 'Commentary scroll viewport');
  const scrollHeight = readProperty(viewport, 'scrollHeight', 'Commentary scroll viewport');
  const clientHeight = readProperty(viewport, 'clientHeight', 'Commentary scroll viewport');
  if (!Number.isFinite(scrollTop)) fail('Commentary scroll viewport.scrollTop must be finite.');
  if (!Number.isFinite(scrollHeight) || scrollHeight < 0) {
    fail('Commentary scroll viewport.scrollHeight must be a finite non-negative number.');
  }
  if (!Number.isFinite(clientHeight) || clientHeight < 0) {
    fail('Commentary scroll viewport.clientHeight must be a finite non-negative number.');
  }
  if (scrollHeight < clientHeight) {
    fail('Commentary scroll viewport.scrollHeight cannot be less than clientHeight.');
  }
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  return Object.freeze({ scrollTop, maxScrollTop });
}

function isAtEnd(geometry) {
  return geometry.scrollTop >= geometry.maxScrollTop - END_TOLERANCE_PX;
}

function scrollToEnd(viewport) {
  const geometry = readGeometry(viewport);
  viewport.scrollTo(Object.freeze({ top: geometry.maxScrollTop, behavior: 'auto' }));
}

function eligibleClick(event) {
  if (event === null || (typeof event !== 'object' && typeof event !== 'function')) return false;
  try {
    return event.defaultPrevented !== true;
  } catch {
    return false;
  }
}

export function createCommentaryScrollBinding(optionsInput) {
  assertPlainObject(optionsInput, 'Commentary scroll binding options');
  assertExactKeys(optionsInput, COMMENTARY_SCROLL_BINDING_OPTIONS_KEYS, 'Commentary scroll binding options');

  const viewport = validateViewport(dataValue(optionsInput, 'viewport', 'Commentary scroll binding options'));
  const indicator = validateIndicator(dataValue(optionsInput, 'indicator', 'Commentary scroll binding options'));
  const follow = validateFollow(dataValue(optionsInput, 'follow', 'Commentary scroll binding options'));
  const newerStepsLabel = requireNonEmptyString(
    dataValue(optionsInput, 'newerStepsLabel', 'Commentary scroll binding options'),
    'Commentary scroll binding options.newerStepsLabel'
  );

  let disposalStarted = false;
  let lastAutoScrolledStepId = null;

  function readFollow() {
    return validateFollowState(follow.read());
  }

  function applyIndicator(state) {
    indicator.textContent = newerStepsLabel;
    indicator.hidden = !state.newerStepsAvailable;
  }

  function projectIndicator(state) {
    const priorText = indicator.textContent;
    const priorHidden = indicator.hidden;
    try {
      applyIndicator(state);
    } catch (error) {
      const rollbackErrors = [];
      try { indicator.textContent = priorText; } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      try { indicator.hidden = priorHidden; } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], 'Commentary indicator projection failed and rollback was incomplete.');
      }
      throw error;
    }
  }

  function refresh() {
    if (disposalStarted) fail('Commentary scroll binding cannot refresh after disposal begins.');
    const state = readFollow();
    const priorText = indicator.textContent;
    const priorHidden = indicator.hidden;
    try {
      applyIndicator(state);
      if (state.following && state.latestVisibleStepId !== null && state.latestVisibleStepId !== lastAutoScrolledStepId) {
        scrollToEnd(viewport);
        lastAutoScrolledStepId = state.latestVisibleStepId;
      } else if (state.following && state.latestVisibleStepId === null) {
        lastAutoScrolledStepId = null;
      }
      return state;
    } catch (error) {
      const rollbackErrors = [];
      try { indicator.textContent = priorText; } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      try { indicator.hidden = priorHidden; } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], 'Commentary scroll refresh failed and rollback was incomplete.');
      }
      throw error;
    }
  }

  const onScroll = () => {
    if (disposalStarted) return;
    const state = readFollow();
    const atEnd = isAtEnd(readGeometry(viewport));
    let next = state;
    if (atEnd && !state.following) next = validateFollowState(follow.resume());
    else if (!atEnd && state.following) next = validateFollowState(follow.suspend());
    if (next.following) lastAutoScrolledStepId = next.latestVisibleStepId;
    projectIndicator(next);
  };

  const onIndicatorClick = (event) => {
    if (disposalStarted || !eligibleClick(event)) return;
    const state = readFollow();
    if (!state.newerStepsAvailable) return;
    scrollToEnd(viewport);
    const resumed = validateFollowState(follow.resume());
    lastAutoScrolledStepId = resumed.latestVisibleStepId;
    projectIndicator(resumed);
  };

  const installed = [];
  try {
    viewport.addEventListener('scroll', onScroll);
    installed.push([viewport, 'scroll', onScroll]);
    indicator.addEventListener('click', onIndicatorClick);
    installed.push([indicator, 'click', onIndicatorClick]);
    refresh();
  } catch (error) {
    const rollbackErrors = [];
    for (const [target, type, listener] of installed.reverse()) {
      try { target.removeEventListener(type, listener); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], 'Commentary scroll binding construction failed and listener rollback was incomplete.');
    }
    throw error;
  }

  const binding = {
    refresh,
    dispose() {
      if (disposalStarted) return;
      const errors = [];
      try { viewport.removeEventListener('scroll', onScroll); } catch (error) { errors.push(error); }
      try { indicator.removeEventListener('click', onIndicatorClick); } catch (error) { errors.push(error); }
      if (errors.length > 0) {
        if (errors.length === 1) throw errors[0];
        throw new AggregateError(errors, 'Commentary scroll binding disposal could not remove all listeners.');
      }
      disposalStarted = true;
    }
  };

  assertExactKeys(binding, COMMENTARY_SCROLL_BINDING_KEYS, 'Commentary scroll binding');
  return Object.freeze(binding);
}
