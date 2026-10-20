import {readFileSync} from 'node:fs';
import {proveEnvelope} from '../../authoring/v3/prove-envelope.mjs';
export function fixtureExperience({leadingContext=false}={}) {
  const base=new URL('../../authoring/v3/fixtures/valid/context-chain/',import.meta.url);
  const lesson=JSON.parse(readFileSync(new URL('lesson.json',base),'utf8'));
  const capture=JSON.parse(readFileSync(new URL('capture.json',base),'utf8'));
  if(leadingContext) lesson.beats.unshift({id:'opening-context',title:'Before any action',actions:[],
    explanation:{pane:'explanation',text:'Placeholder introduction',links:[]},
    engineering:{pane:'engineering',records:[],state:structuredClone(lesson.panes.find(p=>p.type==='diagram/v1').initial_state)}});
  return proveEnvelope(lesson,capture).document;
}
