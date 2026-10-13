import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAuthoringSource} from '../authoring/v1/compile-authoring.mjs';
import {ingestExperience} from '../src/experience/ingest-experience.mjs';
import {createPlayerContent} from '../src/host/player-content.mjs';
const source=JSON.parse(readFileSync(new URL('../experiences/git/git-repository-practice.authoring.json',import.meta.url),'utf8'));
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
  assert.equal(createPlayerContent(experience,['initial',...experience.steps.map(step=>step.id)]).commandWindow,null);
});
