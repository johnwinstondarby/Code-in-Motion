import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkPackLesson} from '../wordpress/assets/lesson-pack-admin.mjs';
import {createHostIdentity} from '../src/multipane/admission.mjs';
import {placeholderPack,PILGRIM_ROWS,PILGRIM_ROUND2_ROWS,extendBeats} from './helpers/part-c-pack.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='https://school.test/wp-admin/admin.php?page=code-in-motion';
async function check({identity=createHostIdentity({developmentAdmission:true}),lessonBytes,captureBytes,lessonSha,captureSha}={}){
 const pack=await placeholderPack();
 const lesson=lessonBytes??pack.entries.get('lesson.json'),capture=captureBytes??pack.entries.get('capture.json');
 const url='/wp-content/plugins/pack/lesson.json?cim-sha256='+(lessonSha??sha(pack.entries.get('lesson.json')));
 const captureUrl='/wp-content/plugins/pack/capture.json?cim-sha256='+(captureSha??sha(pack.entries.get('capture.json')));
 const fetch=async href=>new Response(new URL(href).pathname.endsWith('capture.json')?capture:lesson);
 return checkPackLesson({id:'run-custody-placeholder',url,captureUrl,agreement:'cim.lesson-pack/v2',baseURI:base,fetch,identity});
}

test('[PC-ADMIN-01] Admin marks a v2 lesson Ready only through the Player admission boundary',async()=>{
 const result=await check();
 assert.equal(result.status,'Ready',result.reason);
 assert.match(result.reason,/placeholder/i);
});

test('[PC-ADMIN-02] Admin shows the same refusal reasons the Player would',async()=>{
 const pack=await placeholderPack(),lesson=JSON.parse(pack.entries.get('lesson.json'));
 const released=await check({identity:createHostIdentity()});
 assert.equal(released.status,'Rejected');assert.match(released.reason,/1\.1\.0/);
 const forged=structuredClone(lesson);forged.renderer_config.placeholder={enabled:false,label:null};const text=Buffer.from(JSON.stringify(forged));
 const real=await check({lessonBytes:text,lessonSha:sha(text)});
 assert.equal(real.status,'Rejected');assert.match(real.reason,/placeholder/i);
 const tampered=await check({lessonBytes:Buffer.from(JSON.stringify(lesson)+' ')});
 assert.equal(tampered.status,'Rejected');assert.match(tampered.reason,/fingerprint/i);
});

test('[PC-ADMIN-03] v1 lesson checks keep their existing path',async()=>{
 const result=await checkPackLesson({id:'x',url:'/a.json',baseURI:base,fetch:async()=>new Response('{}')});
 assert.equal(result.status,'Rejected');
 assert.doesNotMatch(result.reason,/CIM-PANES-ADMISSION/);
});

test('[PC-ADMIN-04] Admin does not mark a lesson Ready when its panes cannot be settled',async()=>{
 const pack=await placeholderPack(),lesson=JSON.parse(pack.entries.get('lesson.json'));
 delete lesson.steps[0].state.panes.explanation;
 const text=Buffer.from(JSON.stringify(lesson)),result=await check({lessonBytes:text,lessonSha:sha(text)});
 assert.equal(result.status,'Rejected',result.reason);
 assert.match(result.reason,/Explanation/);
});

test('[PC-ADMIN-05] Admin rejects each of Pilgrim\'s malformed lessons with the beat and rule, and keeps unchanged lessons Ready',async()=>{
 const pack=await placeholderPack();
 const control=await check();assert.equal(control.status,'Ready',control.reason);
 for(const [name,[change,reason]] of Object.entries(PILGRIM_ROWS)){
  const lesson=JSON.parse(pack.entries.get('lesson.json'));change(lesson);
  const text=Buffer.from(JSON.stringify(lesson)),result=await check({lessonBytes:text,lessonSha:sha(text)});
  assert.equal(result.status,'Rejected',name+': '+result.reason);
  assert.match(result.reason,reason,name);
  assert.doesNotMatch(result.reason,/fingerprint/i,name+' must fail its rule, not the checksum');
 }
});

test('[PC-ADMIN-06] Admin rejects lessons the Player model would refuse, with the layout, engine or count reason',async()=>{
 const pack=await placeholderPack();
 const ok=JSON.parse(pack.entries.get('lesson.json'));extendBeats(ok,128);const okText=Buffer.from(JSON.stringify(ok));
 const control=await check({lessonBytes:okText,lessonSha:sha(okText)});assert.equal(control.status,'Ready','128 beats: '+control.reason);
 for(const [name,[change,reason]] of Object.entries(PILGRIM_ROUND2_ROWS)){
  const lesson=JSON.parse(pack.entries.get('lesson.json'));change(lesson);
  const text=Buffer.from(JSON.stringify(lesson)),result=await check({lessonBytes:text,lessonSha:sha(text)});
  assert.equal(result.status,'Rejected',name+': '+result.reason);
  assert.match(result.reason,reason,name);
  assert.doesNotMatch(result.reason,/fingerprint/i,name);
 }
});
