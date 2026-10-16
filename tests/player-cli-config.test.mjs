import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAuthoringSource} from '../authoring/v2/compile-authoring.mjs';
import {compileAuthoringSource as compileV1} from '../authoring/v1/compile-authoring.mjs';
import {ingestExperience} from '../src/experience/ingest-experience.mjs';
import {createPlayerContent} from '../src/host/player-content.mjs';
const source=JSON.parse(readFileSync(new URL('../experiences/git/git-repository-practice.authoring.json',import.meta.url),'utf8'));
test('CLI metadata belongs only to authoring v2; frozen v1 rejects it',()=>{
  assert.equal(source.schema,'localis.cim/authoring/v2');
  const v1=structuredClone(source);v1.schema='localis.cim/authoring/v1';
  assert.throws(()=>compileV1(JSON.stringify(v1)),error=>error.diagnostics[0].causes.some(cause=>cause.id==='CIM-AUTH-UNKNOWN-FIELD'));
  assert.throws(()=>compileAuthoringSource(JSON.stringify(v1)),/Source schema/);
  const v3=structuredClone(source);v3.schema='localis.cim/authoring/v3';assert.throws(()=>compileAuthoringSource(JSON.stringify(v3)),/Source schema/);
  const limn=structuredClone(source);limn.beats[0].explanation.segments[0].limn=['future'];assert.throws(()=>compileAuthoringSource(JSON.stringify(limn)),error=>error.diagnostics[0].causes.some(cause=>cause.id==='CIM-AUTH-UNKNOWN-FIELD'));
});
test('v2 output is invariant under authored key order and preserves runtime Console state',()=>{
  const reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reverse(item)])):value;
  const compiled=compileAuthoringSource(JSON.stringify(source));
  assert.equal(compileAuthoringSource(JSON.stringify(reverse(source))).text,compiled.text);
  const legacy=JSON.parse(readFileSync(new URL('./fixtures/authoring-v1-compat/git-repository-practice.authoring.json',import.meta.url),'utf8'));
  const before=compileV1(JSON.stringify(legacy)).document;
  assert.deepEqual(compiled.document.steps.map(step=>step.state),before.steps.map(step=>step.state));assert.deepEqual(compiled.document.initial_state,before.initial_state);
});
for(const kind of ['powershell','windows-cli','bash']) test(`CLI ${kind} compiles independent visible text and immutable Player configuration`,()=>{
  const specimen=structuredClone(source);specimen.presentation.command_window={cli:{kind,label:'A custom shell'}};
  const experience=ingestExperience(compileAuthoringSource(JSON.stringify(specimen)).document);
  const content=createPlayerContent(experience,['initial',...experience.steps.map(step=>step.id)]);
  assert.deepEqual(content.commandWindow,{cli:{kind,label:'A custom shell'}});
  assert.ok(Object.isFrozen(content.commandWindow.cli));
});
test('invalid CLI configuration is rejected by authoring and runtime validation',()=>{
  for(const cli of [{kind:'zsh',label:'Zsh'},{kind:'bash'}, {kind:'bash',label:''},{kind:'bash',label:'two\nlines'},{kind:'bash',label:'Bash',color:'red'}]) {
    const specimen=structuredClone(source);specimen.presentation.command_window={cli};
    assert.throws(()=>compileAuthoringSource(JSON.stringify(specimen)));
    const runtime=JSON.parse(readFileSync(new URL('../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));
    runtime.presentation.command_window={cli};assert.throws(()=>ingestExperience(runtime));
  }
});
test('omitted CLI metadata stays optional and no renderer state is inspected',()=>{
  const specimen=structuredClone(source);delete specimen.presentation.command_window;
  const experience=ingestExperience(compileAuthoringSource(JSON.stringify(specimen)).document);
  assert.equal(experience.engine_min,'0.2.0');
  assert.equal(createPlayerContent(experience,['initial',...experience.steps.map(step=>step.id)]).commandWindow,null);
});
test('CLI metadata declares its actual engine minimum and cannot compile with an older requested engine',()=>{
  assert.equal(compileAuthoringSource(JSON.stringify(source)).document.engine_min,'1.0.1');
  for(const engineMin of ['0.2.0','1.0.0','1.0.1-alpha']) assert.throws(()=>compileAuthoringSource(JSON.stringify(source),{engineMin}),/CLI identity requires engine 1.0.1/);
  assert.equal(compileAuthoringSource(JSON.stringify(source),{engineMin:'2.0.0'}).document.engine_min,'2.0.0');
});
