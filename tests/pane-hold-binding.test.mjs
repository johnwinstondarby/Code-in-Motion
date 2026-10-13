import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaneHoldBinding } from '../wordpress/assets/pane-hold-binding.mjs';
import { createPaneScrollIntent } from '../wordpress/assets/pane-scroll-intent.mjs';

class Target {
  listeners = new Map();
  failAdd = null;
  failRemove = null;
  addEventListener(type, listener) {
    if (type === this.failAdd) throw new Error('installation failed');
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    if (type === this.failRemove) { this.failRemove = null; throw new Error('removal failed'); }
    this.listeners.get(type)?.delete(listener);
  }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
  count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}

function harness() {
  const document = new Target();
  const pane = new Target();
  const holds = new Set();
  let refreshes = 0;
  let selected = false;
  pane.ownerDocument = document;
  pane.matches = () => false;
  pane.contains = node => node === pane;
  document.activeElement = null;
  document.getSelection = () => ({isCollapsed:!selected, rangeCount:1,
    getRangeAt:() => ({intersectsNode:node => node === pane})});
  const options = {pane, follow:{hold:reason => holds.add(reason), release:reason => holds.delete(reason)},
    refresh:() => { refreshes += 1; }};
  return {pane, document, holds, options, refreshes:() => refreshes, select:value => { selected = value; }};
}

test('pane engagement listeners overlap and never claim scrolling or semantic authority', () => {
  const h = harness(); const binding = createPaneHoldBinding(h.options);
  h.pane.emit('pointerenter'); h.pane.emit('focusin');
  h.select(true); h.document.emit('selectionchange');
  assert.deepEqual([...h.holds], ['pointer','focus','selection']);
  h.pane.emit('pointerleave'); h.pane.emit('focusout', {relatedTarget:h.pane});
  assert.deepEqual([...h.holds], ['focus','selection']);
  h.pane.emit('focusout', {relatedTarget:null});
  h.select(false); h.document.emit('selectionchange');
  assert.equal(h.holds.size, 0);
  assert.equal(h.pane.listeners.has('keydown'), false);
  binding.dispose();
  assert.equal(h.pane.count(), 0); assert.equal(h.document.count(), 0);
});

test('pane hold construction rolls back all partially installed listeners', () => {
  const h = harness(); h.document.failAdd = 'selectionchange';
  assert.throws(() => createPaneHoldBinding(h.options), /installation failed/);
  assert.equal(h.pane.count(), 0); assert.equal(h.document.count(), 0);
});

test('pre-existing pointer presence acquires a hold before any pointer event', () => {
  const h = harness(); h.pane.matches = selector => selector === ':hover';
  const binding = createPaneHoldBinding(h.options);
  assert.deepEqual([...h.holds], ['pointer']);
  assert.equal(h.refreshes(),0);
  binding.dispose();
});

test('selection outside a pane does not acquire its selection hold', () => {
  const h = harness();
  h.document.getSelection = () => ({isCollapsed:false, rangeCount:1,
    getRangeAt:() => ({intersectsNode:() => false})});
  const binding = createPaneHoldBinding(h.options);
  h.document.emit('selectionchange');
  assert.equal(h.holds.has('selection'),false);
  binding.dispose();
});

test('pane hold disposal becomes inert immediately and remains retryable', () => {
  const h = harness(); const binding = createPaneHoldBinding(h.options);
  h.pane.failRemove = 'pointerenter';
  assert.throws(() => binding.dispose(), /disposal failed/);
  h.pane.emit('pointerenter');
  assert.equal(h.refreshes(), 0);
  binding.dispose(); binding.dispose();
  assert.equal(h.pane.count(), 0); assert.equal(h.document.count(), 0);
});

test('native scroll intent excludes focus and protected keys and expires after input ends', () => {
  const h = harness(); let now = 0;
  h.document.defaultView = {performance:{now:() => now}};
  const intent = createPaneScrollIntent({viewport:h.pane});
  assert.equal(intent.read(), false);
  h.pane.emit('wheel'); assert.equal(intent.read(), true);
  h.pane.emit('focusin'); assert.equal(intent.read(), false);
  h.pane.emit('keydown', {target:{}, key:'ArrowDown'}); assert.equal(intent.read(), false);
  h.pane.emit('keydown', {target:h.pane, key:'ArrowDown', shiftKey:true}); assert.equal(intent.read(), false);
  h.pane.emit('keydown', {target:h.pane, key:'ArrowDown'}); assert.equal(intent.read(), true);
  now = 1001; assert.equal(intent.read(), false);
  h.pane.emit('touchmove'); assert.equal(intent.read(), true);
  h.pane.emit('scrollend'); assert.equal(intent.read(), false);
  intent.dispose(); assert.equal(h.document.count(), 0); assert.equal(h.pane.count(), 0);
});

test('scroll intent listener construction and retryable teardown are scoped', () => {
  const h = harness(); h.document.defaultView = {performance:{now:() => 0}};
  h.pane.failAdd = 'keydown';
  assert.throws(() => createPaneScrollIntent({viewport:h.pane}), /installation failed/);
  assert.equal(h.pane.count(), 0);
  h.pane.failAdd = null;
  const intent = createPaneScrollIntent({viewport:h.pane});
  h.pane.emit('wheel');
  h.pane.failRemove = 'wheel';
  assert.throws(() => intent.dispose(), /disposal failed/);
  assert.equal(intent.read(), false);
  intent.dispose(); assert.equal(h.pane.count(), 0); assert.equal(h.document.count(), 0);
});
