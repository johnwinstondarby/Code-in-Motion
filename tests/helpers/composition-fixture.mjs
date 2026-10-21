import {readFileSync} from 'node:fs';
import {proveEnvelope} from '../../authoring/v3/prove-envelope.mjs';
export function compositionFixture(){
 const base=new URL('../../authoring/v3/fixtures/valid/context-chain/',import.meta.url),lesson=JSON.parse(readFileSync(new URL('lesson.json',base),'utf8')),capture=JSON.parse(readFileSync(new URL('capture.json',base),'utf8'));
 // Explicit simulated capture: stage the job in Git before the recorded transfer to GPU.
 const sample=structuredClone(capture.records[0]);Object.assign(sample,{id:'stage-job',beat:'pin-code',service:'git',artifact:'job',from:null,action:'pin',result:{location:'git',status:'pinned'}});capture.records.splice(2,0,sample);capture.records.find(r=>r.beat==='submit-fail').from='git';lesson.beats[1].engineering.records.push('stage-job');lesson.beats[1].engineering.state.artifacts.job={location:'git',status:'pinned'};
 const proof=proveEnvelope(lesson,capture);
 return {experience:proof.document,engineering:{fixtureOnly:true,placeholder:true,hosts:lesson.hosts,services:lesson.services,artifacts:lesson.artifacts,initial:lesson.panes.find(p=>p.type==='diagram/v1').initial_state,archive:{id:capture.archive.id,root:capture.archive.root},records:capture.records,evidence:capture.archive.files,beats:lesson.beats.map((b,i)=>({id:b.id,records:b.engineering.records,state:proof.states[i]}))}};
}
