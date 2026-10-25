import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildV3Pack} from '../../authoring/v3/pack.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
let built;
// The real eight-beat placeholder pack, built through the Part B compiler.
export async function placeholderPack(){
 built??=buildV3Pack(resolve(root,'examples/packs/run-custody-placeholder/lesson.json'),await readFile(resolve(root,'LICENSE'),'utf8'));
 return built;
}
export async function compiledPlaceholder(){
 const pack=await placeholderPack();
 return {experience:JSON.parse(pack.entries.get('lesson.json').toString('utf8')),capture:JSON.parse(pack.entries.get('capture.json').toString('utf8')),manifest:pack.manifest,pack};
}
export async function installPack(directory,{entries}={}){
 const pack=await placeholderPack();
 for(const [path,bytes] of entries??pack.entries){const file=resolve(directory,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);}
 return pack;
}

// Pilgrim's four reproductions (PR #111 review R1), each re-fingerprinted so only the semantic rule can refuse it.
export const PILGRIM_ROWS={
 'Console declaration type becomes unknown/v1':[l=>{l.renderer_config.panes.find(p=>p.id==='console').type='unknown/v1';},/Console, Motion, Explanation and Diagram panes/],
 'first beat loses its Explanation state':[l=>{delete l.steps[0].state.panes.explanation;},/Beat 1 \(name-run\) is missing the Explanation state/],
 'GUI beat also carries a copied CLI action':[l=>{const g=l.steps.find(s=>s.state.actions.some(a=>a.kind==='gui')),c=l.steps.find(s=>s.state.actions.some(a=>a.kind==='cli'));g.state.actions.push(structuredClone(c.state.actions[0]));g.state.waiting.console=false;},/Beat 3 \(submit-fail\)/],
 'GUI beat action tab becomes Console':[l=>{l.steps.find(s=>s.state.actions.some(a=>a.kind==='gui')).state.action_tab='console';},/Beat 3 \(submit-fail\): the action tab/]
};

// Append consistent context-only beats until the lesson has `total` beats (review round 3 count cases).
export function extendBeats(experience,total){
 const last=experience.steps.at(-1);
 for(let n=experience.steps.length+1;n<=total;n++){
  const id=`context-${n}`,text=`Placeholder · simulated. Context-only beat ${n}.`,state=structuredClone(last.state);
  state.actions=[];state.engineering_records=[];state.panes.explanation={text};
  state.waiting={console:true,engineering:true,explanation:false,motion:true};
  experience.steps.push({id,label:`Context ${n}`,beat:{final:true,heading:`Context ${n}`,id,ordinal:n,segment_count:1,segment_ordinal:1},commentary:{links:[],text},dwell_ms:0,state});
 }
 experience.presentation.beat_count=experience.steps.length;
 return experience;
}

// Pilgrim's round-2 reproductions of model preconditions that admission must share.
export const PILGRIM_ROUND2_ROWS={
 'unsupported layout':[l=>{l.renderer_config.layout='unsupported';},/layout/i],
 'engine_min 1.0.1':[l=>{l.engine_min='1.0.1';},/1\.1\.0/],
 '129 consistent beats':[l=>{extendBeats(l,129);},/128 beats/]
};
