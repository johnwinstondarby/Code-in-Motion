import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../wordpress/assets/bootstrap.js', import.meta.url), 'utf8');

test('desktop without CiM roots never reads currentScript or imports modules', () => {
  runInNewContext(source, {
    window: {matchMedia() {return {matches:false};}},
    document: {
      querySelector(selector) {assert.equal(selector, '[data-cim-experience]'); return null;},
      get currentScript() {assert.fail('empty pages must stop before module entry lookup');}
    }
  });
});

test('desktop with an embed preserves the versioned module handoff and motion policy', () => {
  const imported = [];
  assert.equal(source.split('import(moduleUrl.href)').length, 2);
  // Replace only the native import boundary; execute the actual URL/policy logic.
  runInNewContext(source.replace('import(moduleUrl.href)', 'loadModule(moduleUrl.href)'), {
    URL,
    window: {matchMedia() {return {matches:false};}},
    document: {
      querySelector() {return {};},
      baseURI:'https://example.test/lesson/',
      currentScript:{src:'https://example.test/plugin/bootstrap.js?ver=0.2.3', getAttribute(){return 'reduce';}}
    },
    loadModule(url) {imported.push(url); return Promise.resolve();}
  });
  assert.deepEqual(imported, ['https://example.test/plugin/bootstrap-module.mjs?ver=0.2.3&cim-motion-policy=reduce']);
});
