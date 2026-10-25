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
