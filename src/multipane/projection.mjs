// Mount-readiness for compiled panes/v1 lessons (ADR 0061 step 7 Part C, PR #111 review).
// Admission replays the compiled beats exactly as the step-3 projection builds them and
// requires every stored snapshot to equal the replay, so a lesson the Player cannot settle
// is refused with a reason instead of showing Ready and failing at mount.
import {readonlyPaneData} from '../contracts/pane.mjs';
import {validateExperience} from '../experience/validate-experience.mjs';

export const MAX_PANES_BEATS=128;
/**
 * Every precondition the Player model places on a lesson, shared with admission so the two cannot drift.
 * Returns null, or {message} (the model's existing error) and {reason} (the Admin/author explanation).
 */
export function panesModelProblem(experience){
  const problem=(message,reason)=>Object.freeze({message,reason});
  if(experience?.renderer!=='panes/v1')return problem('Only placeholder v3 panes/v1 projections are accepted.','The 1.1.0 Player shows panes/v1 lessons only.');
  if(experience?.engine_min!=='1.1.0')return problem('Only placeholder v3 panes/v1 projections are accepted.',`The 1.1.0 Player shows lessons built for engine_min 1.1.0 only; this lesson declares ${JSON.stringify(experience?.engine_min)}.`);
  if(experience?.renderer_config?.layout!=='action-context')return problem('Only placeholder v3 panes/v1 projections are accepted.',`The 1.1.0 Player supports the action-context layout only; this lesson declares layout ${JSON.stringify(experience?.renderer_config?.layout)}.`);
  if(experience?.initial_state?.placeholder!==true)return problem('Only placeholder v3 panes/v1 projections are accepted.','Only placeholder multi-pane lessons are admitted in 1.1.0.');
  let doc;try{doc=readonlyPaneData(experience);}catch{return problem('Invalid frozen v2 fixture envelope.','The lesson must be plain JSON data.');}
  if(validateExperience(doc).length)return problem('Invalid frozen v2 fixture envelope.','The lesson envelope is invalid.');
  const declarations=doc.renderer_config.panes,consoleId=declarations?.find?.(p=>p.type==='console/v1')?.id,motionId=declarations?.find?.(p=>p.type==='motion/v1')?.id;
  if(!Array.isArray(declarations)||!consoleId||!motionId||declarations.length!==4||new Set(declarations.map(p=>p.id)).size!==4||new Set(declarations.map(p=>p.type)).size!==4||declarations.some(p=>!['console/v1','motion/v1','explanation/v1','diagram/v1'].includes(p.type)))return problem('Invalid pane fixture declarations.','The 1.1.0 Player needs one Console, Motion, Explanation and Diagram pane with distinct IDs.');
  if(doc.steps.length>MAX_PANES_BEATS)return problem('Invalid pane fixture declarations.',`The 1.1.0 Player shows at most ${MAX_PANES_BEATS} beats; this lesson has ${doc.steps.length}. Split it into smaller lessons.`);
  const tabs=[consoleId,motionId],ids=declarations.map(p=>p.id);
  for(const snapshot of [doc.initial_state,...doc.steps.map(s=>s.state)]){
    if(!tabs.includes(snapshot?.action_tab)||ids.some(id=>!Object.hasOwn(snapshot.panes??{},id)||typeof snapshot.waiting?.[id]!=='boolean'))return problem('Invalid pane fixture absolute state.','Every state needs a Console or Motion action tab, all four pane states and boolean waiting flags.');
  }
  return null;
}


const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max=16384)=>typeof x==='string'&&/\S/.test(x)&&x.length<=max;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const same=(a,b)=>stable(a)===stable(b);
const exactKeys=(o,keys)=>object(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

// The 1.1.0 composed Player binds these four pane IDs; other IDs are refused, not half-mounted.
export const PANES_LAYOUT=Object.freeze({console:'console/v1',motion:'motion/v1',explanation:'explanation/v1',engineering:'diagram/v1'});
const NAMES=Object.freeze({console:'Console',motion:'Motion',explanation:'Explanation',engineering:'Diagram'});
const ACTION_PANES=Object.freeze(['console','motion']);
const GUI_LABEL='Placeholder GUI · simulated';

function action(a,where){
 if(!object(a)||a.provenance!=='placeholder')return where+' must be a placeholder action.';
 if(a.kind==='cli'){
  if(a.pane!=='console')return where+' is a CLI action that must name the Console pane.';
  if(!exactKeys(a,['command','kind','output','pane','provenance'])||!text(a.command)||!Array.isArray(a.output)||a.output.length>128||!a.output.every(line=>text(line)))return where+' has invalid CLI fields.';
  return null;
 }
 if(a.kind==='gui'){
  if(a.pane!=='motion')return where+' is a GUI action that must name the Motion pane.';
  if(!exactKeys(a,['alt','asset','kind','label','pane','provenance'])||!text(a.asset,100)||!text(a.alt)||a.label!==GUI_LABEL)return where+' has invalid GUI fields.';
  return null;
 }
 return where+' has an unknown action kind.';
}

/** Returns null when every snapshot equals the replay, otherwise the first reason. */
export function panesProjectionProblem(doc){
 const panes=doc?.renderer_config?.panes;
 if(!Array.isArray(panes)||panes.length!==4||!Object.entries(PANES_LAYOUT).every(([id,type])=>panes.filter(p=>p?.id===id).length===1&&panes.find(p=>p.id===id).type===type))
  return 'The 1.1.0 Player needs exactly the Console, Motion, Explanation and Diagram panes with IDs console, motion, explanation and engineering.';
 const initial=Object.fromEntries(panes.map(p=>[p.id,p.initial_state]));
 if(!exactKeys(initial.console,['lines'])||!Array.isArray(initial.console.lines)||!initial.console.lines.every(l=>typeof l==='string'))return 'The Console pane starting state is invalid.';
 if(!exactKeys(initial.explanation,['text'])||!text(initial.explanation.text))return 'The Explanation pane needs starting text.';
 if(!exactKeys(initial.motion,['frame'])||initial.motion.frame!==null)return 'The Motion pane must start with no frame.';
 if(!exactKeys(initial.engineering,['artifacts'])||!object(initial.engineering.artifacts))return 'The Diagram pane starting state is invalid.';
 const ids=Object.keys(PANES_LAYOUT);
 const compare=(snapshot,expected,where)=>{
  if(!object(snapshot)||!object(snapshot.panes))return where+' has no pane states.';
  const missing=ids.filter(id=>!Object.hasOwn(snapshot.panes,id)),extra=Object.keys(snapshot.panes).filter(id=>!ids.includes(id));
  if(missing.length||extra.length)return where+(missing.length?' is missing the '+missing.map(id=>NAMES[id]).join(', ')+' state':'')+(extra.length?(missing.length?' and':'')+' has unknown pane states '+extra.join(', '):'')+'.';
  for(const id of ['console','motion','explanation'])if(!same(snapshot.panes[id],expected.panes[id]))return `${where}: the ${NAMES[id]} state does not follow from the lesson's actions and commentary.`;
  if(!object(snapshot.panes.engineering))return where+': the Diagram state is missing.';
  if(snapshot.action_tab!==expected.action_tab)return where+': the action tab does not agree with the beat.';
  if(!exactKeys(snapshot.waiting,ids)||ids.some(id=>snapshot.waiting[id]!==expected.waiting[id]))return where+': the waiting flags do not agree with the beat.';
  return null;
 };
 const held={console:initial.console,motion:initial.motion,explanation:initial.explanation};
 let tab='console';
 const first=compare(doc.initial_state,{panes:held,action_tab:tab,waiting:Object.fromEntries(ids.map(id=>[id,true]))},'The initial state');
 if(first)return first;
 if(!Array.isArray(doc.initial_state.actions)||doc.initial_state.actions.length!==0||!Array.isArray(doc.initial_state.engineering_records)||doc.initial_state.engineering_records.length!==0)return 'The initial state must have no actions or records.';
 for(const [i,step] of doc.steps.entries()){
  const where=`Beat ${i+1} (${step?.id})`,state=step?.state,actions=state?.actions;
  if(!Array.isArray(actions))return where+' has no action list.';
  for(const [j,a] of actions.entries()){const problem=action(a,`${where} action ${j+1}`);if(problem)return problem;}
  const cli=actions.filter(a=>a.kind==='cli').length,gui=actions.filter(a=>a.kind==='gui').length;
  if(cli>1||gui>1)return where+' repeats an action kind; one CLI or one GUI action per beat.';
  if(cli&&gui)return where+' has CLI and GUI actions at once; their simultaneous behavior is not specified.';
  if(!text(step.commentary?.text))return where+' needs Explanation text.';
  for(const a of actions){held[a.pane]=a.kind==='cli'?{lines:[a.command,...a.output]}:{asset:a.asset,alt:a.alt,label:a.label};tab=a.pane;}
  held.explanation={text:step.commentary.text};
  const records=Array.isArray(state.engineering_records)?state.engineering_records.length:0;
  const waiting={console:!actions.some(a=>a.pane==='console'),motion:!actions.some(a=>a.pane==='motion'),explanation:false,engineering:records===0};
  const problem=compare(state,{panes:held,action_tab:tab,waiting},where);
  if(problem)return problem;
 }
 if(!ACTION_PANES.includes(tab))return 'Invalid action tab.';
 return null;
}
