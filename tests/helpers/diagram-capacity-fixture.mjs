import {readFileSync} from 'node:fs';
import {assertValid,validateBundle} from '../../authoring/v3/validate.mjs';
import {proveEnvelope} from '../../authoring/v3/prove-envelope.mjs';
export function capacityFixture(name='nine') {
 const base=new URL('../../authoring/v3/fixtures/valid/context-chain/',import.meta.url);
 const lesson=JSON.parse(readFileSync(new URL('lesson.json',base),'utf8')),capture=JSON.parse(readFileSync(new URL('capture.json',base),'utf8'));
 const counts={nine:[9,1],height:[9,1],five:[1,5],long:[1,1],limit:[12,1],over:[13,1],four:[1,4],label:[1,1],'label-over':[1,1],maximum:[64,128]};
 const [locations,artifacts]=counts[name];const long=(prefix)=>prefix+'x'.repeat(100-prefix.length);
 lesson.id='capacity-'+name;lesson.title='Placeholder diagram capacity: '+name;lesson.description='Simulated capacity records only, not lab evidence.';lesson.hosts=[name==='long'?long('host'):'h'];
 lesson.services=Array.from({length:locations},(_,i)=>({id:name==='long'?long('location'):name==='label'?'s'.repeat(52):name==='label-over'?'s'.repeat(53):'s'+i,host:lesson.hosts[0]}));
 lesson.artifacts=Array.from({length:artifacts},(_,i)=>name==='long'?long('artifact'):'a'+i);lesson.media={status:'deferred',asset_ids:[]};
 const initial={artifacts:Object.fromEntries(lesson.artifacts.map(id=>[id,{location:null,status:'absent'}]))};lesson.panes.find(p=>p.type==='diagram/v1').initial_state=structuredClone(initial);
 const state=structuredClone(initial),template=structuredClone(lesson.beats[0]);lesson.beats=[];capture.records=[];
 if(name==='long')capture.archive.files[0].id=long('evidence');
 const placements=Math.ceil(artifacts/32);
 for(let b=0;b<=placements;b++) {
  const moving=b===placements;
  const beat=structuredClone(template);beat.id=moving?'transfer':b?'placed-'+b:'placed';beat.title=moving?'Simulated transfer':'Simulated placement';beat.explanation.text='Placeholder capacity example; every identifier comes from simulated capture records.';beat.engineering.records=[];
  const ids=moving?[lesson.artifacts[0]]:lesson.artifacts.slice(b*32,(b+1)*32);
  ids.forEach((artifact,i)=>{const prior=state.artifacts[artifact],service=lesson.services[moving?locations-1:0].id,action=moving?(locations>1?(name==='height'?'publish':'fail'):'verify'):'pin';const id=name==='long'&&moving?long('record'):(moving?'move':'place-'+b)+'-'+i;
   const result={location:service,status:moving?(locations>1?(name==='height'?'published':'failed'):'verified'):'pinned'};
   capture.records.push({id,beat:beat.id,pane:'engineering',host:lesson.hosts[0],service,artifact,action,from:prior.location,result:structuredClone(result),evidence:capture.archive.files[0].id,provenance:'placeholder'});state.artifacts[artifact]=result;beat.engineering.records.push(id);});
  beat.engineering.state=structuredClone(state);lesson.beats.push(beat);
 }
 const bundle=assertValid(validateBundle(lesson,capture));
 const engineering={fixtureOnly:true,placeholder:true,hosts:lesson.hosts,services:lesson.services,artifacts:lesson.artifacts,initial,archive:{id:capture.archive.id,root:capture.archive.root},records:capture.records,evidence:capture.archive.files,beats:lesson.beats.map((b,i)=>({id:b.id,records:b.engineering.records,state:bundle.states[i]}))};
 return {lesson,capture,engineering};
}
export function capacityExperience(name){const f=capacityFixture(name);return {...f,experience:proveEnvelope(f.lesson,f.capture).document};}
