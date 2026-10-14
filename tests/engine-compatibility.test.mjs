import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENGINE_IDENTITY } from '../src/contracts/engine-identity.mjs';
import { compareEngineVersions, assertEngineCompatibility } from '../src/experience/engine-compatibility.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { createWordPressExperienceLoader } from '../src/host/wordpress-browser-bindings.mjs';
import { createPlayerContent } from '../src/host/player-content.mjs';
import { assertWordPressExperienceAdmission, WORDPRESS_V2_RENDERERS } from '../src/host/wordpress-admission-policy.mjs';
import { wordPressPlayerMode } from '../wordpress/assets/player-binding.mjs';

const raw=JSON.parse(await readFile(new URL('../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));
test('engine identity is an explicit frozen capability identity independent of release metadata',()=>{
  assert.deepEqual(ENGINE_IDENTITY,{id:'localis.cim/engine',version:'1.0.1',schemas:['localis.cim/v1','localis.cim/v2']});
  assert.ok(Object.isFrozen(ENGINE_IDENTITY));assert.ok(Object.isFrozen(ENGINE_IDENTITY.schemas));
});
test('engine semantic version precedence is numeric, prerelease-aware and ignores build metadata',()=>{
  const ordered=['0.2.0','0.10.0','1.0.0-alpha','1.0.0-alpha.1','1.0.0-alpha.beta','1.0.0-beta','1.0.0-beta.2','1.0.0-beta.11','1.0.0-rc.1','1.0.0','1.0.1','1.1.0','2.0.0'];
  for(let i=0;i<ordered.length;i++) for(let j=0;j<ordered.length;j++) assert.equal(compareEngineVersions(ordered[i],ordered[j]),Math.sign(i-j));
  assert.equal(compareEngineVersions('1.0.0+build.2','1.0.0+other'),0);
  assert.equal(compareEngineVersions('9007199254740993.0.0','9007199254740992.99.99'),1);
});
test('engine versions reject ranges, malformed identifiers and numeric prerelease leading zeros',()=>{
  for(const version of ['v1.0.0','1.0','>=1.0.0','01.0.0','1.0.0-01','1.0.0-alpha.01','1.0.0+','1.0.0-','1.0.0-a..b',null]) assert.throws(()=>compareEngineVersions(version,'1.0.0'),TypeError);
});
test('engine admission preserves existing v1 minimum and compiled v2 minimum',()=>{
  for(const [schema,min] of [['localis.cim/v1','1.0.0'],['localis.cim/v2','0.2.0'],['localis.cim/v2','1.0.0+build']]) {
    const experience={schema,engine_min:min};assert.equal(assertEngineCompatibility(experience),experience);
  }
});
test('engine admission rejects newer requirements and carries a structured pre-runtime fault',()=>{
  for(const min of ['1.0.2','1.1.0','2.0.0','2.0.0-alpha','1.0.0-01']) assert.throws(()=>assertEngineCompatibility({...raw,engine_min:min}),error=>{
    assert.equal(error.code,'CIM-EXP-015');assert.equal(error.fault.component,'experience');assert.ok(Object.isFrozen(error.fault));return true;
  });
});
test('engine rejection is not cached and loader can retry a compatible asset',async()=>{
  let count=0;
  const loader=createWordPressExperienceLoader({fetch:async()=>({ok:true,json:async()=>({...raw,engine_min:++count===1?'1.0.2':'0.2.0'})}),experienceUrlFor:()=>'/lesson.json'});
  const first=loader.load(raw.id);assert.equal(loader.load(raw.id),first);
  await assert.rejects(first,error=>error.code==='CIM-EXP-015');
  const result=await loader.load(raw.id);assert.equal(result.engine_min,'0.2.0');assert.equal(count,2);
});
test('WordPress v2 admission requires a renderer with the complete Player consumer mode',()=>{
  for(const id of WORDPRESS_V2_RENDERERS) assert.equal(wordPressPlayerMode(id),'console-explanation');
  for(const renderer of ['synthetic/v1','git/v1','unknown/v1']) assert.throws(()=>assertWordPressExperienceAdmission({...raw,renderer}),error=>error.code==='CIM-EXP-016');
  assert.doesNotThrow(()=>assertWordPressExperienceAdmission({schema:'localis.cim/v1',engine_min:'1.0.0',renderer:'git/v1'}));
});
test('v2 Player instruction metadata is exact, frozen and aligned without inspecting opaque state',()=>{
  const experience=ingestExperience(raw);
  let inspected=0;
  const steps=experience.steps.map(step=>Object.freeze({...step,get state(){inspected++;throw new Error('opaque state');}}));
  const content=createPlayerContent(Object.freeze({...experience,steps:Object.freeze(steps)}),['initial',...steps.map(step=>step.id)]);
  assert.equal(content.instructions.length,18);
  for(const [i,info] of content.instructions.entries()) {
    assert.deepEqual(Object.keys(info),['anchor','evidence','risk']);
    assert.ok(Object.isFrozen(info));assert.ok(Object.isFrozen(info.evidence));
    assert.deepEqual(info.evidence,raw.steps[i].commentary.evidence??[]);
    assert.equal(info.anchor,raw.steps[i].commentary.anchor??null);
    if(info.risk){assert.ok(Object.isFrozen(info.risk));assert.equal(steps[i].beat.final,true);
      assert.deepEqual(info.risk,{level:raw.steps[i].commentary.risk.level,guidance:raw.steps[i].commentary.risk.guidance??null});}
  }
  assert.equal(inspected,0);
});
