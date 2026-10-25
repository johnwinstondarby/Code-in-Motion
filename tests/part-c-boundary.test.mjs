import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkProductionAdmissionBoundary} from '../tools/check-production-admission-boundary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('[PC-B-01] the repository has no production path to development admission, fixtures or tools',async()=>{
 const result=await checkProductionAdmissionBoundary(root);
 assert.ok(result.filesChecked>50,'both src/ and wordpress/ are scanned');
 assert.deepEqual(result.violations,[]);
});

test('[PC-B-02] the check catches each forbidden route',async t=>{
 const cases=[
  ['wordpress/assets/x.mjs',"import {createDevelopmentAdmission} from '../../authoring/v3/admission.mjs';",'production-to-authoring'],
  ['src/multipane/x.mjs',"import {proveEnvelope} from '../../authoring/v3/prove-envelope.mjs';",'production-to-authoring'],
  ['wordpress/assets/x.mjs',"import {createMotionFixtureDriver} from '../../harness/motion-test-driver.mjs';",'production-to-harness'],
  ['wordpress/assets/x.mjs',"import {createPreviewDriver} from '../../tools/pack-preview-driver.mjs';",'production-to-tools'],
  ['src/multipane/x.mjs',"export const s=createMultiPaneSession({experience,testFixture:true});",'production-test-fixture'],
  ['wordpress/assets/x.mjs',"export const s=createMultiPaneSession({experience, testFixture : true });",'production-test-fixture'],
  ['wordpress/assets/x.mjs',"export const c={fixtureOnly:true,records:[]};",'production-fixture-data']
 ];
 for(const [file,source,rule] of cases){
  const work=await mkdtemp(resolve(root,'../part-c-boundary-'));t.after(()=>rm(work,{recursive:true,force:true}));
  await mkdir(resolve(work,'src/multipane'),{recursive:true});await mkdir(resolve(work,'wordpress/assets'),{recursive:true});
  await writeFile(resolve(work,'src/multipane/ok.mjs'),'export const ok=1;\n');await writeFile(resolve(work,'wordpress/assets/ok.mjs'),'export const ok=1;\n');
  await writeFile(resolve(work,file),source+'\n');
  const result=await checkProductionAdmissionBoundary(work);
  assert.ok(result.violations.some(v=>v.rule===rule&&v.file===file),rule+': '+JSON.stringify(result.violations));
 }
});

test('[PC-B-03] comments mentioning fixtures are not violations',async t=>{
 const work=await mkdtemp(resolve(root,'../part-c-boundary-'));t.after(()=>rm(work,{recursive:true,force:true}));
 await mkdir(resolve(work,'src/multipane'),{recursive:true});await mkdir(resolve(work,'wordpress/assets'),{recursive:true});
 await writeFile(resolve(work,'src/multipane/ok.mjs'),"// The harness passes testFixture:true; production never does.\nexport const ok=1;\n");
 await writeFile(resolve(work,'wordpress/assets/ok.mjs'),'export const ok=1;\n');
 assert.deepEqual((await checkProductionAdmissionBoundary(work)).violations,[]);
});
