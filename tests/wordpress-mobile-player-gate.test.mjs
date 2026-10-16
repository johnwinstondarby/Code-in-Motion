import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../wordpress/assets/bootstrap.js', import.meta.url), 'utf8');

test('mobile boot never reads the module URL and replaces every Player with a desktop notice', () => {
  const roots = [];
  const makeRoot = () => ({
    state: null,
    getAttribute() { return this.state; },
    setAttribute(name, value) { assert.equal(name, 'data-cim-state'); this.state = value; },
    textContent: 'static lesson fallback'
  });
  roots.push(makeRoot(), makeRoot());
  let observed;
  let refresh;
  runInNewContext(source, {
    window: { matchMedia(query) {
      assert.equal(query, '(max-width: 767px), (hover: none) and (pointer: coarse)');
      return { matches: true };
    } },
    document: {
      get currentScript() { assert.fail('mobile must not enter the module-loading path'); },
      documentElement: {},
      querySelectorAll(selector) { assert.equal(selector, '[data-cim-experience]'); return roots; }
    },
    MutationObserver: class {
      constructor(callback) { refresh = callback; }
      observe(target, options) { observed = options; }
    }
  });
  for (const root of roots) {
    assert.equal(root.state, 'desktop-required');
    assert.equal(root.textContent, 'The interactive Player needs a desktop or laptop with a wider window. Widen this window and reload, or open the lesson on a larger screen.');
  }
  assert.equal(observed.childList, true);
  roots.push(makeRoot());
  refresh();
  assert.equal(roots[2].state, 'desktop-required');
});

test('desktop boot retains the existing module entry path', () => {
  let readEntry = false;
  runInNewContext(source, {
    window: { matchMedia() { return { matches: false }; } },
    document: { querySelector() { return {}; }, get currentScript() { readEntry = true; return null; } },
    MutationObserver: class { constructor() { assert.fail('desktop must not install the mobile observer'); } }
  });
  assert.equal(readEntry, true);
});
