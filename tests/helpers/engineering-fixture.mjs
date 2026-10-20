import {readFileSync} from 'node:fs';
import {assertValid,validateBundle} from '../../authoring/v3/validate.mjs';
export function engineeringFixture(){
 const base=new URL('../../authoring/v3/fixtures/valid/context-chain/',import.meta.url);
 const lesson=JSON.parse(readFileSync(new URL('lesson.json',base))),capture=JSON.parse(readFileSync(new URL('capture.json',base)));
 const bundle=assertValid(validateBundle(lesson,capture));
 return {fixtureOnly:true,placeholder:lesson.placeholder,hosts:lesson.hosts,services:lesson.services,artifacts:lesson.artifacts,
 initial:lesson.panes.find(p=>p.type==='diagram/v1').initial_state,
 records:capture.records,evidence:capture.archive.files,beats:lesson.beats.map((b,i)=>({id:b.id,records:b.engineering.records,state:bundle.states[i]}))};
}
