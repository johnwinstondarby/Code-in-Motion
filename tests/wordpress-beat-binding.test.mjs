import test from 'node:test';
import assert from 'node:assert/strict';
import {createWordPressBeatBinding} from '../wordpress/assets/beat-binding.mjs';

class Element {
  constructor(document) { this.ownerDocument = document; this.children = []; this.attributes = new Map(); this.listeners = new Set(); }
  setAttribute(key,value) { this.attributes.set(key,value); }
  removeAttribute(key) { this.attributes.delete(key); }
  appendChild(child) { this.children.push(child); child.parentNode = this; }
  removeChild(child) { this.children.splice(this.children.indexOf(child),1); child.parentNode = null; }
  addEventListener(type,listener) { this.listeners.add(listener); }
  removeEventListener(type,listener) {
    if (this.failRemoval) { this.failRemoval = false; throw new Error('withdrawal failed'); }
    this.listeners.delete(listener);
  }
  click() { for (const listener of this.listeners) listener({defaultPrevented:false}); }
}
function fixture(seek = () => Promise.resolve()) {
  const document = {elements:[],createElement() { const element = new Element(this); this.elements.push(element); return element; }};
  const transport = new Element(document);
  const root = new Element(document); root.querySelector = () => transport;
  let canonical = Object.freeze({currentStepId:'a',revealFrontier:'b'});
  const beats = Object.freeze(['a','b'].map((id,index) => Object.freeze({id,ordinal:index+1,heading:id,finalStepId:id,boundaryIds:Object.freeze([id])})));
  const errors = [];
  const options = {root,beats,boundaryIds:Object.freeze(['initial','a','b']),observation:{snapshot:() => ({canonical})},seek,onError:error => errors.push(error)};
  return {document,transport,options,errors,setCanonical:value => { canonical = value; }};
}
test('beat controls validate fresh committed position before presentation mutation', () => {
  const f = fixture(); const binding = createWordPressBeatBinding(f.options);
  const progress = f.document.elements.find(element => element.attributes.has('data-cim-beat-progress'));
  assert.equal(progress.textContent,'1 / 2 · a');
  for (const invalid of [{currentStepId:'b',revealFrontier:'a'}, {currentStepId:'missing',revealFrontier:'b'}]) {
    f.setCanonical(Object.freeze(invalid)); assert.throws(() => binding.refresh(),/canonical identities/);
    assert.equal(progress.textContent,'1 / 2 · a');
  }
  f.setCanonical({currentStepId:'a',revealFrontier:'b'}); assert.throws(() => binding.refresh(),/canonical identities/);
  binding.dispose();
});
test('beat controls withdraw listeners with retryable inert teardown', () => {
  const calls = []; const f = fixture((...args) => { calls.push(args); });
  const binding = createWordPressBeatBinding(f.options);
  const buttons = f.document.elements.filter(element => element.attributes.has('data-cim-beat-marker'));
  buttons[0].setAttribute('data-cim-beat-marker','b'); buttons[0].click();
  assert.deepEqual(calls,[['a','marker']]);
  buttons[0].failRemoval = true;
  assert.throws(() => binding.dispose(),AggregateError);
  buttons[0].click(); assert.equal(calls.length,1);
  binding.dispose(); binding.dispose();
  assert.equal(f.transport.children.length,0);
  assert.equal(buttons[0].listeners.size,0); assert.equal(buttons[1].listeners.size,0);
});
test('beat controls roll back installed listeners after construction rejection', () => {
  const f = fixture(); f.setCanonical(Object.freeze({currentStepId:'bad',revealFrontier:'b'}));
  assert.throws(() => createWordPressBeatBinding(f.options),/canonical identities/);
  assert.equal(f.transport.children.length,0);
  for (const element of f.document.elements) assert.equal(element.listeners.size,0);
});
test('beat controls report synchronous and asynchronous seek failures', async () => {
  for (const seek of [() => { throw new Error('sync'); }, () => Promise.reject(new Error('async'))]) {
    const f = fixture(seek); const binding = createWordPressBeatBinding(f.options);
    f.document.elements.find(element => element.attributes.has('data-cim-beat-marker')).click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.errors.length,1); binding.dispose();
  }
});
