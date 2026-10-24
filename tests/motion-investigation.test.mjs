import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {installMotionDiagnostics} from './helpers/motion-diagnostics.mjs';
test('opt-in play observer preserves receiver, arguments and the native promise',async()=>{
 let init;await installMotionDiagnostics({async addInitScript(fn){init=fn;}},{enabled:true});
 let receiver,args;const promise=Promise.resolve();const video={src:'blob:observed',play(...values){receiver=this;args=values;return promise;}};
 const window={};runInNewContext('('+init.toString()+')()',{window,document:{addEventListener(){},querySelectorAll:()=>[video]},MutationObserver:class{observe(){}},performance:{now:()=>10},HTMLMediaElement:class{}});
 assert.equal(video.play('sentinel'),promise);assert.equal(receiver,video);assert.deepEqual(args,['sentinel']);await promise;await Promise.resolve();
 const events=window.__motionDiagnosticSnapshot().events;assert.equal(events[0].event,'play-call');assert.match(events[0].data.stack,/Motion play call/);assert.equal(events[1].event,'play-resolved');assert.equal(events[0].data.id,events[1].data.id);
});
test('identity diagnostics distinguish elements even when the blob URL is reused',async()=>{
 let init;await installMotionDiagnostics({async addInitScript(fn){init=fn;}},{enabled:true});
 const first={src:'blob:one',currentTime:1.2,duration:1.2,ended:true,seeking:false,readyState:4,paused:true};let current=first;
 const window={fixture:{session:{read:()=>({index:2,generation:7})}}};
 runInNewContext('('+init.toString()+')()',{window,document:{addEventListener(){},querySelector:()=>current,querySelectorAll:()=>[]},MutationObserver:class{observe(){}},performance:{now:()=>10},HTMLMediaElement:class{}});
 window.__motionCompleted({status:'settled'});const completed=window.__motionDiagnosticSnapshot().events[0].data;
 assert.equal(completed.video.identity,window.__motionVideoSnapshot(first).identity);assert.equal(completed.video.src,'blob:one');assert.equal(completed.index,2);assert.equal(completed.generation,7);
 current={...first,currentTime:0};const replaced=window.__motionVideoSnapshot(current);assert.notEqual(completed.video.identity,replaced.identity);assert.equal(completed.video.src,replaced.src);
 first.currentTime=0;assert.equal(window.__motionVideoSnapshot(first).identity,completed.video.identity);
});
test('manual MOT-07 workflow is optional, dispatch-only and preserves reviewed installation steps',async()=>{
 const manual=parse(await readFile('.github/workflows/mot07-investigation.yml','utf8')),base=parse(await readFile('.github/workflows/wordpress-e2e.yml','utf8'));
 assert.deepEqual(Object.keys(manual.on),['workflow_dispatch']);assert.equal(Object.keys(manual.jobs).length,1);const job=manual.jobs['mot07-load'];assert.equal(job['timeout-minutes'],30);assert.deepEqual(job.strategy.matrix.browser,['webkit']);
 const run=job.steps.find(s=>s.name==='Run only WebKit MOT-07 fixed repetitions');assert.equal(run.run,'npx playwright test tests/e2e/motion-pane.spec.mjs --grep MOT-07 --repeat-each=20 --workers=4 --retries=0 --reporter=line,json');
 for(const step of job.steps.filter(s=>s.id?.startsWith('webkit-')))assert.deepEqual(step,base.jobs['browser-family-matrix'].steps.find(s=>s.id===step.id));
});
