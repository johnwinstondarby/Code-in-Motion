import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommentaryFollowController } from '../src/commentary/follow-controller.mjs';
import {
  COMMENTARY_SCROLL_BINDING_KEYS,
  createCommentaryScrollBinding
} from '../src/commentary/scroll-binding.mjs';

function link(id = 'link-1') {
  return Object.freeze({ id, label: `Link ${id}`, href: `https://example.test/${id}` });
}

function entry(stepId, index, { active = false, selected = false } = {}) {
  return Object.freeze({
    stepId,
    index,
    text: `${stepId} text`,
    links: Object.freeze(index === 1 ? [link()] : []),
    selected,
    active
  });
}

function presentationState(ids, { currentStepId, selectedStepId = null, entryCount = 4 } = {}) {
  const current = currentStepId ?? (ids.length === 0 ? 'initial' : ids[ids.length - 1]);
  return Object.freeze({
    revealFrontier: ids.length === 0 ? 'initial' : ids[ids.length - 1],
    currentStepId: current,
    selectedStepId,
    entryCount,
    entries: Object.freeze(ids.map((stepId, offset) => entry(stepId, offset + 1, {
      active: stepId === current,
      selected: stepId === selectedStepId
    })))
  });
}

class FakeViewport {
  constructor({ scrollTop = 0, scrollHeight = 100, clientHeight = 100 } = {}) {
    this.scrollTop = scrollTop;
    this.scrollHeight = scrollHeight;
    this.clientHeight = clientHeight;
    this.listeners = new Map();
    this.scrollCalls = [];
    this.failAddType = null;
    this.failRemoveTypeOnce = null;
    this.failScrollOnce = false;
  }

  addEventListener(type, listener) {
    if (this.failAddType === type) throw new Error(`add ${type} failed`);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    if (this.failRemoveTypeOnce === type) {
      this.failRemoveTypeOnce = null;
      throw new Error(`remove ${type} failed`);
    }
    this.listeners.get(type)?.delete(listener);
  }

  scrollTo(options) {
    if (this.failScrollOnce) {
      this.failScrollOnce = false;
      throw new Error('scroll failed');
    }
    this.scrollCalls.push(options);
    this.scrollTop = options.top;
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeButton {
  constructor() {
    this.tagName = 'BUTTON';
    this.type = 'button';
    this.hidden = false;
    this.textContent = 'prior';
    this.listeners = new Map();
    this.failAddType = null;
    this.failRemoveTypeOnce = null;
  }

  addEventListener(type, listener) {
    if (this.failAddType === type) throw new Error(`add ${type} failed`);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    if (this.failRemoveTypeOnce === type) {
      this.failRemoveTypeOnce = null;
      throw new Error(`remove ${type} failed`);
    }
    this.listeners.get(type)?.delete(listener);
  }

  click(event = { defaultPrevented: false }) {
    for (const listener of [...(this.listeners.get('click') ?? [])]) listener(event);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function harness(initialIds = [], geometry = {}) {
  let state = presentationState(initialIds);
  const presentation = Object.freeze({ read: () => state });
  const follow = createCommentaryFollowController({ presentation });
  const viewport = new FakeViewport(geometry);
  const indicator = new FakeButton();
  const binding = createCommentaryScrollBinding({
    viewport,
    indicator,
    follow,
    newerStepsLabel: 'Newer steps'
  });
  return {
    follow,
    viewport,
    indicator,
    binding,
    set(ids, options) {
      state = presentationState(ids, options);
    }
  };
}

test('scroll binding is exact frozen and installs only scroll and native click listeners', () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.binding), COMMENTARY_SCROLL_BINDING_KEYS);
  assert.equal(Object.isFrozen(h.binding), true);
  assert.equal(h.viewport.listenerCount('scroll'), 1);
  assert.equal(h.indicator.listenerCount('click'), 1);
  assert.equal(h.indicator.textContent, 'Newer steps');
  assert.equal(h.indicator.hidden, true);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown', 'keyup']) {
    assert.equal(h.viewport.listenerCount(type), 0);
    assert.equal(h.indicator.listenerCount(type), 0);
  }
});

test('freshly revealed Commentary autoscrolls to the bottom only while following', () => {
  const h = harness([], { scrollTop: 0, scrollHeight: 300, clientHeight: 100 });
  assert.equal(h.viewport.scrollCalls.length, 0);

  h.set(['step-01']);
  h.binding.refresh();
  assert.deepEqual(h.viewport.scrollCalls, [Object.freeze({ top: 200, behavior: 'auto' })]);
  assert.equal(h.viewport.scrollTop, 200);
  assert.equal(h.follow.read().following, true);
  assert.equal(h.indicator.hidden, true);
});

test('refresh does not repeat autoscroll for the same newest entry but scrolls once for a new frontier', () => {
  const h = harness([], { scrollHeight: 300, clientHeight: 100 });
  h.set(['step-01']);
  h.binding.refresh();
  h.binding.refresh();
  assert.equal(h.viewport.scrollCalls.length, 1);

  h.viewport.scrollHeight = 360;
  h.set(['step-01', 'step-02']);
  h.binding.refresh();
  assert.equal(h.viewport.scrollCalls.length, 2);
  assert.deepEqual(h.viewport.scrollCalls[1], Object.freeze({ top: 260, behavior: 'auto' }));
});

test('learner scrolling away from the bottom suspends follow without fabricating newer steps', () => {
  const h = harness(['step-01'], { scrollTop: 200, scrollHeight: 300, clientHeight: 100 });
  h.viewport.scrollCalls.length = 0;
  h.viewport.scrollTop = 80;
  h.viewport.emit('scroll');

  assert.deepEqual(h.follow.read(), {
    following: false,
    newerStepsAvailable: false,
    latestVisibleStepId: 'step-01'
  });
  assert.equal(h.indicator.hidden, true);
  assert.equal(h.viewport.scrollCalls.length, 0);
});

test('new reveal while suspended shows the newer-steps control and does not autoscroll', () => {
  const h = harness(['step-01'], { scrollTop: 200, scrollHeight: 300, clientHeight: 100 });
  h.viewport.scrollTop = 80;
  h.viewport.emit('scroll');
  h.viewport.scrollCalls.length = 0;

  h.viewport.scrollHeight = 360;
  h.set(['step-01', 'step-02']);
  const projected = h.binding.refresh();

  assert.equal(projected.following, false);
  assert.equal(projected.newerStepsAvailable, true);
  assert.equal(h.indicator.hidden, false);
  assert.equal(h.viewport.scrollCalls.length, 0);
});

test('manually returning to the bottom resumes follow and clears the newer-steps indication', () => {
  const h = harness(['step-01'], { scrollTop: 200, scrollHeight: 300, clientHeight: 100 });
  h.viewport.scrollTop = 80;
  h.viewport.emit('scroll');
  h.set(['step-01', 'step-02']);
  h.viewport.scrollHeight = 360;
  h.binding.refresh();
  assert.equal(h.indicator.hidden, false);

  h.viewport.scrollTop = 260;
  h.viewport.emit('scroll');
  assert.equal(h.follow.read().following, true);
  assert.equal(h.follow.read().newerStepsAvailable, false);
  assert.equal(h.indicator.hidden, true);
});

test('one CSS pixel from the bottom counts as returned while farther away remains suspended', () => {
  const h = harness(['step-01'], { scrollTop: 100, scrollHeight: 200, clientHeight: 100 });
  h.viewport.scrollTop = 50;
  h.viewport.emit('scroll');
  assert.equal(h.follow.read().following, false);

  h.viewport.scrollTop = 98.9;
  h.viewport.emit('scroll');
  assert.equal(h.follow.read().following, false);

  h.viewport.scrollTop = 99;
  h.viewport.emit('scroll');
  assert.equal(h.follow.read().following, true);
});

test('newer-steps activation scrolls first then resumes follow and hides the control', () => {
  const h = harness(['step-01'], { scrollTop: 200, scrollHeight: 300, clientHeight: 100 });
  h.viewport.scrollTop = 50;
  h.viewport.emit('scroll');
  h.viewport.scrollHeight = 420;
  h.set(['step-01', 'step-02']);
  h.binding.refresh();
  assert.equal(h.indicator.hidden, false);

  h.viewport.scrollCalls.length = 0;
  h.indicator.click();

  assert.deepEqual(h.viewport.scrollCalls, [Object.freeze({ top: 320, behavior: 'auto' })]);
  assert.equal(h.follow.read().following, true);
  assert.equal(h.follow.read().newerStepsAvailable, false);
  assert.equal(h.indicator.hidden, true);
});

test('indicator activation is inert when no newer steps exist or native click was already prevented', () => {
  const h = harness(['step-01'], { scrollTop: 200, scrollHeight: 300, clientHeight: 100 });
  h.viewport.scrollCalls.length = 0;
  h.indicator.click();
  assert.equal(h.viewport.scrollCalls.length, 0);

  h.viewport.scrollTop = 50;
  h.viewport.emit('scroll');
  h.set(['step-01', 'step-02']);
  h.binding.refresh();
  assert.equal(h.indicator.hidden, false);
  h.indicator.click({ defaultPrevented: true });
  assert.equal(h.follow.read().following, false);
  assert.equal(h.indicator.hidden, false);
});

test('autoscroll failure propagates and restores indicator projection without changing follow policy', () => {
  const h = harness([], { scrollHeight: 300, clientHeight: 100 });
  h.indicator.textContent = 'prior';
  h.indicator.hidden = false;
  h.set(['step-01']);
  h.viewport.failScrollOnce = true;

  assert.throws(() => h.binding.refresh(), /scroll failed/);
  assert.equal(h.indicator.textContent, 'prior');
  assert.equal(h.indicator.hidden, false);
  assert.equal(h.follow.read().following, true);

  h.binding.refresh();
  assert.equal(h.viewport.scrollCalls.length, 1);
});

test('invalid scroll geometry fails closed before changing follow state', () => {
  const h = harness(['step-01'], { scrollTop: 100, scrollHeight: 200, clientHeight: 100 });
  h.viewport.scrollTop = Number.NaN;
  assert.throws(() => h.viewport.emit('scroll'), /scrollTop must be finite/);
  assert.equal(h.follow.read().following, true);

  h.viewport.scrollTop = 0;
  h.viewport.scrollHeight = 50;
  h.viewport.clientHeight = 100;
  assert.throws(() => h.viewport.emit('scroll'), /cannot be less than clientHeight/);
  assert.equal(h.follow.read().following, true);
});

test('binding requires the exact frozen checkpoint 4 follow capability and an accessible native button label', () => {
  const viewport = new FakeViewport();
  const indicator = new FakeButton();
  const state = Object.freeze({ following: true, newerStepsAvailable: false, latestVisibleStepId: null });
  const widened = Object.freeze({ read: () => state, suspend: () => state, resume: () => state, seek() {} });

  assert.throws(
    () => createCommentaryScrollBinding({ viewport, indicator, follow: widened, newerStepsLabel: 'Newer steps' }),
    /must contain exactly: read, suspend, resume/
  );
  assert.throws(
    () => createCommentaryScrollBinding({
      viewport,
      indicator,
      follow: { read: () => state, suspend: () => state, resume: () => state },
      newerStepsLabel: 'Newer steps'
    }),
    /must be frozen/
  );
  const exact = Object.freeze({ read: () => state, suspend: () => state, resume: () => state });
  assert.throws(
    () => createCommentaryScrollBinding({ viewport, indicator, follow: exact, newerStepsLabel: '' }),
    /must be a non-empty string/
  );
});

test('malformed follow state fails closed before indicator or scroll mutation', () => {
  const viewport = new FakeViewport({ scrollHeight: 300, clientHeight: 100 });
  const indicator = new FakeButton();
  const malformed = Object.freeze({ following: true, newerStepsAvailable: true, latestVisibleStepId: 'step-01' });
  const follow = Object.freeze({ read: () => malformed, suspend: () => malformed, resume: () => malformed });

  assert.throws(
    () => createCommentaryScrollBinding({ viewport, indicator, follow, newerStepsLabel: 'Newer steps' }),
    /cannot report newer steps while following/
  );
  assert.equal(viewport.scrollCalls.length, 0);
  assert.equal(indicator.textContent, 'prior');
  assert.equal(indicator.hidden, false);
  assert.equal(viewport.listenerCount('scroll'), 0);
  assert.equal(indicator.listenerCount('click'), 0);
});

test('construction rolls back a partially installed listener set', () => {
  const viewport = new FakeViewport();
  const indicator = new FakeButton();
  indicator.failAddType = 'click';
  const state = Object.freeze({ following: true, newerStepsAvailable: false, latestVisibleStepId: null });
  const follow = Object.freeze({ read: () => state, suspend: () => state, resume: () => state });

  assert.throws(
    () => createCommentaryScrollBinding({ viewport, indicator, follow, newerStepsLabel: 'Newer steps' }),
    /add click failed/
  );
  assert.equal(viewport.listenerCount('scroll'), 0);
});

test('dispose removes only owned listeners, is idempotent after success, and blocks later refresh', () => {
  const h = harness();
  const foreign = () => {};
  h.viewport.addEventListener('scroll', foreign);
  h.indicator.addEventListener('click', foreign);

  h.binding.dispose();
  assert.equal(h.viewport.listenerCount('scroll'), 1);
  assert.equal(h.indicator.listenerCount('click'), 1);
  h.binding.dispose();
  assert.throws(() => h.binding.refresh(), /after disposal begins/);
});

test('dispose remains retryable when one listener removal fails', () => {
  const h = harness();
  h.viewport.failRemoveTypeOnce = 'scroll';
  assert.throws(() => h.binding.dispose(), /remove scroll failed/);
  assert.doesNotThrow(() => h.binding.refresh());
  assert.doesNotThrow(() => h.binding.dispose());
  assert.equal(h.viewport.listenerCount('scroll'), 0);
  assert.equal(h.indicator.listenerCount('click'), 0);
});

test('scroll binding owns no navigation Runtime Transport renderer or semantic event authority', () => {
  const binding = harness().binding;
  for (const key of ['seek', 'play', 'pause', 'marker', 'runtime', 'transport', 'renderer', 'events', 'emit', 'snapshot']) {
    assert.equal(key in binding, false);
  }
});
