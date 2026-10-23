import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {dependencyPackages,aptCacheKey,verifyCapture} from '../tools/ci/webkit-apt-key.mjs';
const identity={version:'1.63.0',os:'Linux',arch:'X64',imageOS:'ubuntu24',imageVersion:'20261012.334.1'};
const frozen=JSON.parse(await readFile('tools/ci/webkit-apt-packages.json','utf8'));
test('APT key binds exact pinned WebKit package list and runner image',async()=>{
 const source=await readFile('tests/fixtures/ci/playwright-1.63.0-ubuntu24-deps.txt','utf8');
 const packages=dependencyPackages(source,frozen);assert.deepEqual(packages,frozen.packages);
 const key=aptCacheKey({...identity,packages});assert.match(key,/^webkit-apt-v1-playwright-1\.63\.0-Linux-X64-ubuntu24-20261012\.334\.1-[a-f0-9]{64}$/);
 assert.notEqual(key,aptCacheKey({...identity,imageVersion:'new-image',packages}));assert.notEqual(key,aptCacheKey({...identity,packages:[...packages,'other']}));
 for(const change of [{version:'1.64.0'},{arch:'ARM64'},{imageVersion:''}])assert.throws(()=>aptCacheKey({...identity,packages,...change}));
 assert.throws(()=>dependencyPackages(source.slice(source.indexOf('"ubuntu24.04-x64": {')).replace('"xvfb"','"changed"'),frozen));assert.throws(()=>dependencyPackages('unknown bundle',frozen));
});
test('APT cache never skips install, saves only after success, and verifies before dpkg',async()=>{
 const w=parse(await readFile('.github/workflows/wordpress-e2e.yml','utf8')),steps=w.jobs['browser-family-matrix'].steps;
 const restore=steps.find(s=>s.id==='webkit-apt-cache'),save=steps.find(s=>s.id==='webkit-apt-cache-save'),hook=steps.find(s=>s.id==='webkit-apt-cache-guard');
 assert(restore&&save&&hook,'missing authenticated package cache steps');
 assert(restore.uses.startsWith('actions/cache/restore@'));assert(save.uses.startsWith('actions/cache/save@'));
 assert(restore.with.path.endsWith('/*.deb'));assert(!restore.with['restore-keys']);assert(restore.with.key.includes('webkit-apt-key.outputs.key'));assert.equal(save.with.key,restore.with.key);
 assert(save.if.includes("steps.webkit-apt-cache.outputs.cache-hit != 'true'"));assert(save.if.includes("steps.webkit-deps-first.outcome == 'success'"));assert(save.if.includes("steps.webkit-deps-retry.outcome == 'success'"));
 assert(steps.indexOf(hook)<steps.findIndex(s=>s.id==='webkit-deps-first'));assert(steps.indexOf(save)>steps.findIndex(s=>s.id==='webkit-deps-retry'));assert(steps.indexOf(save)<steps.findIndex(s=>s.name==='Run R20 browser-family smoke suite'));
 assert(hook.run.includes('/usr/bin/python3 -I tools/ci/webkit-apt-cache.py configure'));
 for(const id of ['webkit-deps-first','webkit-deps-retry'])assert(!steps.find(s=>s.id===id).if.includes('apt-cache.outputs'));
 const proof=steps.find(s=>s.id==='webkit-apt-proof');assert(proof&&!proof['continue-on-error']);assert(proof.run.includes('webkit-apt-key.mjs proof'));assert(steps.indexOf(proof)<steps.indexOf(save));assert(save.if.includes("steps.webkit-apt-proof.outcome == 'success'"));
 const units=steps.find(s=>s.id==='webkit-apt-cache-tests');assert(units);assert(!units['continue-on-error']);assert(units.run.includes('test_webkit_apt_cache.py'));
});

test('cache save requires a nonempty current-job pre-install verification record',()=>{
 const good={files:[{name:'demo_1.0_amd64.deb',size:6,sha256:'a'.repeat(64),trusted:true}],bytes:6};
 assert.deepEqual(verifyCapture(good,['demo_1.0_amd64.deb']),{selectedFiles:1,selectedBytes:6,stagedFiles:1});
 for(const value of [null,{files:[],bytes:0},{...good,bytes:7},{files:[{...good.files[0],trusted:false}],bytes:6}])assert.throws(()=>verifyCapture(value,['demo_1.0_amd64.deb']));
 assert.throws(()=>verifyCapture(good,[]));
});
