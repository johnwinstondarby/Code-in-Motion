import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileAuthoringSource as compileV1} from '../authoring/v1/compile-authoring.mjs';
import {compileAuthoringSource as dispatch} from '../tools/compile-authoring.mjs';
const root=new URL('../',import.meta.url);
const frozen=JSON.parse(readFileSync(new URL('./fixtures/authoring-v1-compat/frozen-files.json',import.meta.url),'utf8'));
test('frozen authoring v1 files and normative specs remain byte-identical to pre-PR main',()=>{
  for(const [path,hash] of Object.entries(frozen)) assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash,path);
  const walk=path=>readdirSync(new URL(path,root),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${path}/${entry.name}`):[`${path}/${entry.name}`]);
  assert.deepEqual(walk('authoring/v1').sort(),Object.keys(frozen).filter(path=>path.startsWith('authoring/v1/')).sort());
});
test('version-dispatching compiler preserves exact frozen v1 fixture outputs and provenance',()=>{
  for(const file of readdirSync(new URL('../authoring/v1/fixtures/valid/',import.meta.url))) {
    const text=readFileSync(new URL(`../authoring/v1/fixtures/valid/${file}`,import.meta.url),'utf8');
    const before=compileV1(text);const after=dispatch(text);
    assert.equal(after.text,before.text,file);assert.equal(after.provenanceText,before.provenanceText,file);
  }
});
