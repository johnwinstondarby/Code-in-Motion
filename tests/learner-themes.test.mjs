import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { THEME_PRESETS, generateThemeCSS, resolveLearnerTheme } from '../wordpress/assets/theme-presets.mjs';
import { createLearnerThemeCoordinator, createWordPressThemeBinding, LEARNER_THEME_STORAGE_KEY } from '../wordpress/assets/theme-binding.mjs';

function environment(stored = null, unavailable = false) {
  const queries = new Map();
  const writes = [];
  const view = {
    localStorage: {
      getItem: () => { if (unavailable) throw new Error('blocked'); return stored; },
      setItem: (key, value) => { if (unavailable) throw new Error('blocked'); writes.push([key, value]); stored = value; }
    },
    matchMedia(query) {
      if (!queries.has(query)) queries.set(query, {
        matches: false, listeners: new Set(),
        addEventListener(type, listener) { this.listeners.add(listener); if (this.failAdd) throw new Error('install failed'); },
        removeEventListener(type, listener) { if (this.failRemove) { this.failRemove = false; throw new Error('withdraw failed'); } this.listeners.delete(listener); }
      });
      return queries.get(query);
    }
  };
  function media(query, value) {
    const result = view.matchMedia(query); result.matches = value;
    for (const listener of result.listeners) listener();
  }
  return { view, queries, media, writes };
}
const contrastQuery = '(prefers-contrast: more)';
const lightQuery = '(prefers-color-scheme: light)';
const forcedQuery = '(forced-colors: active)';

test('learner themes follow explicit choice, contrast, light and Localis precedence', () => {
  assert.equal(resolveLearnerTheme({}), 'localis');
  assert.equal(resolveLearnerTheme({light:true}), 'light');
  assert.equal(resolveLearnerTheme({light:true,contrast:true}), 'high-contrast');
  for (const id of Object.keys(THEME_PRESETS)) assert.equal(resolveLearnerTheme({explicit:id,light:true,contrast:true}),id);
  assert.equal(resolveLearnerTheme({explicit:'__proto__'}),'localis');
});
test('learner themes synchronize subscribers, persist only explicit choices and follow device changes', () => {
  const f = environment(); const coordinator = createLearnerThemeCoordinator(f.view);
  const first = []; const second = [];
  const off = coordinator.subscribe(state => first.push(state));
  const off2 = coordinator.subscribe(state => second.push(state));
  f.media(lightQuery,true); assert.equal(first.at(-1).theme,'light');
  f.media(contrastQuery,true); assert.equal(first.at(-1).theme,'high-contrast');
  assert.equal(f.writes.length,0);
  coordinator.choose('localis');
  assert.deepEqual(f.writes,[[LEARNER_THEME_STORAGE_KEY,'localis']]);
  f.media(lightQuery,false); assert.equal(first.at(-1).theme,'localis');
  assert.deepEqual(first,second);
  off(); off2(); assert.ok([...f.queries.values()].every(query => query.listeners.size === 0));
});
test('learner themes respect stored choices and reject unknown stored values', () => {
  for (const stored of ['light','high-contrast','localis','bad',null]) {
    const f = environment(stored); f.media(lightQuery,true);
    const coordinator = createLearnerThemeCoordinator(f.view);
    assert.equal(coordinator.read().theme, stored && Object.hasOwn(THEME_PRESETS,stored) ? stored : 'light');
  }
});
test('learner themes keep explicit choice in memory when storage or its getter throws', () => {
  for (const getter of [false,true]) {
    const f = environment(null,true);
    if (getter) Object.defineProperty(f.view,'localStorage',{get() {throw new Error('blocked getter');}});
    const coordinator = createLearnerThemeCoordinator(f.view);
    const values = []; const off = coordinator.subscribe(state => values.push(state.theme));
    coordinator.choose('light'); f.media(contrastQuery,true);
    assert.equal(values.at(-1),'light'); off();
    const off2 = coordinator.subscribe(state => values.push(state.theme));
    assert.equal(values.at(-1),'light'); off2();
  }
});
test('learner themes forced colors hides preference UI without discarding explicit choice', () => {
  const f = environment('light'); const coordinator = createLearnerThemeCoordinator(f.view);
  const values = []; const off = coordinator.subscribe(state => values.push(state));
  f.media(forcedQuery,true);
  assert.equal(values.at(-1).forcedColors,true);
  coordinator.choose('localis'); assert.equal(coordinator.read().theme,'light');
  f.media(forcedQuery,false); assert.equal(values.at(-1).theme,'light'); off();
});
test('learner themes withdraw media listeners retryably and contain observer failures', () => {
  const f = environment(); const coordinator = createLearnerThemeCoordinator(f.view);
  const errors = []; const off = coordinator.subscribe(state => {if(state.theme === 'light') throw new Error('observer');},error => errors.push(error));
  const sibling = []; const off2 = coordinator.subscribe(state => sibling.push(state.theme));
  coordinator.choose('light'); assert.equal(errors.length,1); assert.equal(sibling.at(-1),'light');
  off(); f.queries.get(lightQuery).failRemove = true;
  assert.throws(off2,AggregateError); assert.equal(f.queries.get(lightQuery).listeners.size,1);
  off2(); assert.ok([...f.queries.values()].every(query => query.listeners.size === 0));
});
test('learner themes roll back partially installed media listeners', () => {
  const f = environment(); f.view.matchMedia(lightQuery).failAdd = true;
  const coordinator = createLearnerThemeCoordinator(f.view);
  assert.throws(() => coordinator.subscribe(() => {}), /install failed/);
  assert.ok([...f.queries.values()].every(query => query.listeners.size === 0));
});
test('learner themes resample device values on notification when existing query objects are stale', () => {
  const current = new Map(); const objects = [];
  const view = {localStorage:{getItem:()=>null},matchMedia(query) {
    const result = {matches:current.get(query) ?? false,listeners:new Set(),
      addEventListener(type,listener){this.listeners.add(listener);},
      removeEventListener(type,listener){this.listeners.delete(listener);}};
    objects.push({query,result}); return result;
  }};
  const coordinator=createLearnerThemeCoordinator(view); const states=[];
  const off=coordinator.subscribe(state=>states.push(state.theme));
  current.set(contrastQuery,true);
  for(const listener of objects.find(item=>item.query===lightQuery).result.listeners) listener();
  assert.equal(states.at(-1),'high-contrast');off();
});

class Element {
  constructor(document) { this.ownerDocument=document; this.children=[]; this.attributes=new Map(); this.listeners=new Set(); }
  setAttribute(key,value) {if(this.failAttribute) throw new Error('projection failed'); this.attributes.set(key,value);}
  getAttribute(key) {return this.attributes.get(key) ?? null;}
  removeAttribute(key) {this.attributes.delete(key);}
  appendChild(child) {this.children.push(child); child.parentNode=this;}
  removeChild(child) {this.children.splice(this.children.indexOf(child),1); child.parentNode=null;}
  addEventListener(type,listener) {this.listeners.add(listener);}
  removeEventListener(type,listener) {if(this.failRemove) {this.failRemove=false;throw new Error('withdrawal failed');} this.listeners.delete(listener);}
  change() {for(const listener of this.listeners) listener();}
}
function bindingFixture(view = environment().view) {
  const document={defaultView:view, elements:[], createElement() {const element=new Element(this);this.elements.push(element);return element;},createTextNode(text) {return {textContent:text};}};
  const transport=new Element(document); const root=new Element(document); root.querySelector=()=>transport;
  return {document,transport,root,select:()=>document.elements.find(element=>element.attributes.has('data-cim-theme-select'))};
}
test('learner theme binding labels one select, synchronizes roots and restores attributes on teardown', () => {
  const f=environment(); const a=bindingFixture(f.view); const b=bindingFixture(f.view);
  const first=createWordPressThemeBinding({root:a.root}); const second=createWordPressThemeBinding({root:b.root});
  assert.deepEqual(a.select().children.map(child=>child.textContent),['Localis','High Contrast','Light']);
  a.select().value='light';a.select().change();assert.equal(b.select().value,'light');
  a.select().failRemove=true;assert.throws(()=>first.dispose(),AggregateError);
  a.select().value='localis';a.select().change();assert.equal(b.select().value,'light');
  first.dispose();first.dispose();assert.equal(a.select().listeners.size,0);
  assert.equal(a.root.getAttribute('data-cim-theme'),null);assert.equal(a.transport.children.length,0);
  second.dispose();assert.ok([...f.queries.values()].every(query=>query.listeners.size===0));
});
test('learner theme binding rolls back DOM, listeners and root projection after failed construction', () => {
  const f=bindingFixture();f.root.failAttribute=true;
  assert.throws(()=>createWordPressThemeBinding({root:f.root}),/projection failed/);
  assert.equal(f.transport.children.length,0);assert.equal(f.select().listeners.size,0);
});

function luminance(hex) {
  const values=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return values.reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
}
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);
test('learner theme palettes are complete and all instructional and interactive contrast pairings pass', () => {
  const roles=Object.keys(THEME_PRESETS.localis.colors).sort();
  for(const [id,{colors}] of Object.entries(THEME_PRESETS)) {
    assert.deepEqual(Object.keys(colors).sort(),roles);
    for(const value of Object.values(colors)) assert.match(value,/^#[0-9A-F]{6}$/);
    const pairs=[['console-text','console-background',7],['console-quiet','console-background',4.5],
      ['explanation-prose','explanation-background',7],['explanation-heading','explanation-background',7],
      ['explanation-control','explanation-background',4.5],['wayfinding','explanation-background',4.5],['wayfinding','frame-background',4.5],
      ['risk-free','console-background',4.5],['risk-trace','console-background',4.5],['risk-final','console-background',4.5],
      ['cli-powershell','console-background',4.5],['cli-windows','console-background',4.5],['cli-bash','console-background',4.5],
      ['limn','console-background',3],['limn','console-text',1.5],['frame-text','frame-background',4.5],
      ['control-text','frame-background',4.5],['control-text','control-hover',4.5],
      ['control-border','frame-background',3],['control-border','control-hover',3],
      ['focus','frame-background',3],['focus','control-hover',3],['pane-focus','explanation-background',3],['pane-focus','console-background',3]];
    for(const [text,background,min] of pairs) assert.ok(ratio(colors[text],colors[background])>=min,`${id}: ${text}/${background}`);
  }
});
test('learner theme CSS declares every root role from the same tested palette source', async () => {
  const css=await readFile(new URL('../wordpress/assets/cim.css',import.meta.url),'utf8');
  assert.ok(css.includes(generateThemeCSS()));
  for(const role of Object.keys(THEME_PRESETS.localis.colors)) assert.ok(css.includes(`--cim-${role}:`));
  assert.ok(!/var\(--cim-[^)]*,/.test(css));
});
