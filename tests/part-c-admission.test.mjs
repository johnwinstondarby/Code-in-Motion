import test from 'node:test';
import assert from 'node:assert/strict';
import * as admission from '../src/multipane/admission.mjs';
import * as motion from '../src/multipane/motion.mjs';
import * as coordinator from '../src/multipane/motion-coordinator.mjs';
import {createMultiPaneModel} from '../src/multipane/model.mjs';
import {createEngineeringPane} from '../src/multipane/engineering.mjs';
import {validateMediaMap} from '../src/multipane/media-map.mjs';
import {compiledPlaceholder} from './helpers/part-c-pack.mjs';
import {capacityFixture} from './helpers/diagram-capacity-fixture.mjs';
import {virtualScheduler} from './conformance/console-test-support.mjs';

// Minimal DOM that records attributes, matching the existing Engineering unit tests.
class Element{constructor(tag='section'){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.ownerDocument={createElement:t=>new Element(t)};this._text='';}set textContent(v){this.children=[];this._text=String(v);}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}setAttribute(k,v){this.attributes[k]=String(v);}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this._text='';this.children=nodes;}}
const walk=(node,fn)=>{fn(node);for(const child of node.children??[])walk(child,fn);};
const fresh=async()=>structuredClone(await compiledPlaceholder());
const development=()=>admission.createHostIdentity({developmentAdmission:true});
const release=()=>admission.createHostIdentity();

test('[PC-01] a released host identity refuses 1.1.0 multi-pane lessons with an actionable reason',async()=>{
 const {experience,capture}=await fresh();
 assert.equal(typeof admission.createHostIdentity,'function');
 const identity=release();
 assert.equal(identity.version,'1.0.1');
 assert.throws(()=>admission.admitPanesLesson({experience,capture,identity}),/1\.1\.0/);
});

test('[PC-02] the explicit development identity admits the real placeholder pack and builds Engineering data',async()=>{
 const {experience,capture}=await fresh();
 const admitted=admission.admitPanesLesson({experience,capture,identity:development()});
 assert.ok(admitted.token);
 assert.equal(admitted.media.status,'pack');
 assert.equal(admitted.engineering.fixtureOnly,undefined,'production Engineering data is not disguised as a fixture');
 assert.deepEqual(admitted.engineering.beats.map(b=>b.id),experience.steps.map(s=>s.id));
 assert.equal(admission.isAdmittedExperience(admitted.token,admitted.experience),true);
});

test('[PC-03] development admission cannot be claimed by data, strings or forged identity objects',async()=>{
 const {experience,capture}=await fresh();
 for(const identity of ['1.1.0-dev','1.1.0',{version:'1.1.0-dev',channel:'development'},{version:'1.1.0',channel:'release'},null,undefined]){
  assert.throws(()=>admission.admitPanesLesson({experience,capture,identity}),undefined,JSON.stringify(identity));
 }
 const forgedLesson=structuredClone(experience);forgedLesson.development_admission=true;
 assert.throws(()=>admission.admitPanesLesson({experience:forgedLesson,capture,identity:release()}));
});

test('[PC-04] non-placeholder lessons, captures and media are refused in 1.1.0',async()=>{
 const changes=[
  ({experience})=>{experience.renderer_config.placeholder={enabled:false,label:null};},
  ({experience})=>{experience.initial_state.placeholder=false;for(const s of experience.steps)s.state.placeholder=false;},
  ({capture})=>{capture.placeholder=false;},
  ({capture})=>{for(const r of capture.records)r.provenance='captured';},
  ({experience})=>{experience.renderer_config.media.placeholder=false;}
 ];
 for(const change of changes){
  const data=await fresh();change(data);
  assert.throws(()=>admission.admitPanesLesson({experience:data.experience,capture:data.capture,identity:development()}),/placeholder|Placeholder|captured/i,change.toString());
 }
});

test('[PC-05] invalid envelopes, captures and media are refused before any token is issued',async()=>{
 const changes=[
  ({experience})=>{experience.renderer='console/v1';},
  ({experience})=>{experience.engine_min='1.2.0';},
  ({experience})=>{delete experience.presentation;},
  ({capture})=>{capture.schema='unknown';},
  ({experience,capture})=>{capture.id='other-capture';},
  ({capture})=>{capture.records.splice(0,1);},
  ({experience})=>{delete experience.renderer_config.media.assets[0].codec;},
  ({experience})=>{experience.renderer_config.media.assets[0].source={type:'attachment',id:10};}
 ];
 for(const change of changes){
  const data=await fresh();change(data);
  assert.throws(()=>admission.admitPanesLesson({experience:data.experience,capture:data.capture,identity:development()}),undefined,change.toString());
 }
});

test('[PC-06] the session model accepts a bound admission token and still refuses everything else',async()=>{
 const {experience,capture}=await fresh();
 const admitted=admission.admitPanesLesson({experience,capture,identity:development()});
 assert.throws(()=>createMultiPaneModel({experience:admitted.experience}),/test fixture|admission/i);
 assert.doesNotThrow(()=>createMultiPaneModel({experience:admitted.experience,admission:admitted.token}));
 const other=structuredClone(admitted.experience);other.presentation.title='Changed after admission';
 assert.throws(()=>createMultiPaneModel({experience:other,admission:admitted.token}),/admission/i);
 assert.throws(()=>createMultiPaneModel({experience:admitted.experience,admission:{...admitted.token}}),/admission/i);
 assert.throws(()=>createMultiPaneModel({experience:admitted.experience,admission:Object.freeze({})}),/admission/i);
});

test('[PC-07] Engineering mounts production data only with a valid admission token',async()=>{
 const {experience,capture}=await fresh();
 const admitted=admission.admitPanesLesson({experience,capture,identity:development()});
 assert.throws(()=>createEngineeringPane().mount(new Element(),admitted.engineering,{id:'engineering',type:'diagram/v1'}),/fixture/);
 assert.throws(()=>createEngineeringPane({admission:{}}).mount(new Element(),admitted.engineering,{id:'engineering',type:'diagram/v1'}),/fixture|admission/i);
 const root=new Element(),pane=createEngineeringPane({admission:admitted.token});
 pane.mount(root,admitted.engineering,{id:'engineering',type:'diagram/v1'});
 pane.settle(admitted.experience.steps[2].state.panes.engineering,{stepId:admitted.experience.steps[2].id});
 assert.match(root.textContent,/Placeholder content/);
});

test('[PC-08] the pack media form requires declared codecs and keeps the fixture form unchanged',async()=>{
 const {experience}=await fresh(),media=experience.renderer_config.media;
 assert.deepEqual(validateMediaMap(media),[]);
 const missing=structuredClone(media);delete missing.assets[0].webm.codec;
 assert.ok(validateMediaMap(missing).some(d=>d.id==='CIM-MEDIA-CODEC'));
 const crossed=structuredClone(media);crossed.assets[0].codec='vp8';
 assert.ok(validateMediaMap(crossed).some(d=>d.id==='CIM-MEDIA-CODEC'));
 const attachment=structuredClone(media);attachment.assets[0].source={type:'attachment',id:10};
 assert.ok(validateMediaMap(attachment).some(d=>d.id==='CIM-MEDIA-SOURCE'));
 const fixture=structuredClone(media);fixture.status='fixture';
 assert.ok(validateMediaMap(fixture).length>0,'the fixture form still rejects codec fields');
});

test('[PC-09] Motion probes each copy with its declared codec string',()=>{
 assert.equal(typeof motion.copyMimeType,'function');
 assert.equal(motion.copyMimeType({type:'video/mp4',codec:'avc1.640028'}),'video/mp4; codecs="avc1.640028"');
 assert.equal(motion.copyMimeType({type:'video/webm',codec:'vp09.00.10.08'}),'video/webm; codecs="vp09.00.10.08"');
 assert.equal(motion.copyMimeType({type:'video/mp4'}),'video/mp4; codecs="avc1.42E01E"');
 assert.equal(motion.copyMimeType({type:'video/webm'}),'video/webm; codecs="vp8, vorbis"');
});

test('[PC-10] the coordinator clock trace is opt-in and bounded',()=>{
 assert.equal(typeof coordinator.createClockTrace,'function');
 const off=coordinator.createClockTrace({enabled:false});
 off.record({running:true});assert.equal(off.events.length,0);
 const on=coordinator.createClockTrace({enabled:true});
 for(let i=0;i<1000;i++)on.record({running:i%2===0,time:i});
 assert.equal(on.events.length,256);assert.equal(on.events.at(-1).time,999);
});

test('[PC-11] the capacity note is a live region once per beat, not on every frame',async()=>{
 const config=capacityFixture('five').engineering,root=new Element(),pane=createEngineeringPane({graphical:true});
 pane.mount(root,config,{id:'engineering',type:'diagram/v1'});
 const scheduler=virtualScheduler(),notes=new Set();const count=()=>walk(root,n=>{if(n.attributes?.role==='status'&&n.attributes?.['data-diagram-capacity-note']!==undefined)notes.add(n);});
 const beat=config.beats.find(b=>b.id==='placed');
 pane.settle(beat.state,{stepId:beat.id});count();
 const context={stepId:beat.id,animate:true,reducedMotion:false,fromState:config.initial,clock:{now:scheduler.now,schedule:scheduler.schedule,cancel:scheduler.cancel},cancellation:{aborted:false,onAbort(){return()=>{};}}};
 const played=pane.play(beat.state,context);
 for(let t=0;t<=2000;t+=10){scheduler.advanceTo(t);count();}
 await played;count();
 assert.equal(notes.size,1,'one live-region announcement for the beat');
 assert.match(root.textContent,/too large to draw here/);
});
