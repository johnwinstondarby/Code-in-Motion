// Composed Player: fixtures, local preview, or WordPress with a Part C admission token.
import {createMotionCoordinator} from './motion-coordinator.mjs';
import {attachMotionFixtureSurface} from './action-surface.mjs';
import {mountMultiPaneControls} from './controls.mjs';
import {createEngineeringPane} from './engineering.mjs';
import {createConsolePane} from '../renderers/subjects/console/renderer.mjs';
import {createExplanationPane} from '../commentary/native-binding.mjs';
import {readonlyPaneData} from '../contracts/pane.mjs';
const consoleState=(state,stepId)=>({transcript:state.lines?.length?[{beat:stepId,command:state.lines[0],copy:state.lines[0],output:state.lines.slice(1).map(text=>({text,tone:'normal'}))}]:[],focus:[]});
function consoleAdapter(slot){const pane=createConsolePane();pane.mount(slot,{title:'Placeholder CLI',prompt:'lab@inspire:~$'},{id:'console',type:'console/v1'});return Object.freeze({mount(){},settle(s,c){pane.settle(consoleState(s,c.stepId),c);},play(s,c){return pane.play(consoleState(s,c.stepId),Object.freeze({...c,fromState:consoleState(c.fromState,c.stepId)}));},dispose:pane.dispose});}
function explanationAdapter(slot){const doc=slot.ownerDocument,root=doc.createElement('div'),text=doc.createElement('p');root.append(text);slot.append(root);const pane=createExplanationPane();pane.mount([{root,text,select:doc.createElement('button'),links:[]}],{entryCount:1},{id:'explanation',type:'explanation/v1'});const project=(s,c)=>readonlyPaneData({revealFrontier:c.stepId,currentStepId:c.stepId,selectedStepId:null,entryCount:1,entries:[{stepId:c.stepId,index:1,text:s.text,links:[],selected:false,active:c.stepId!=='initial'}]});return Object.freeze({mount(){},settle(s,c){pane.settle(project(s,c),c);},play(s,c){return pane.play(project(s,c),c);},dispose:pane.dispose});}
// Each mounted Player gets its own accessibility namespace so tabs never point at another Player's panels.
let mounted=0;
export function mountComposedPlayer({root,experience,media,engineering,access,createDriver,reducedMotion=false,admission=null,traceClock=false}){
 const instanceId='cim-player-'+(++mounted);
 if(experience.renderer!=='panes/v1'||!experience.renderer_config.placeholder.enabled)throw new TypeError('Composition requires the validated placeholder fixture.');
 const slots=Object.fromEntries(experience.renderer_config.panes.map(p=>[p.id,root.ownerDocument.createElement('div')]));
 const driver=createMotionCoordinator(experience,slots,{access,media,createDriver,reducedMotion,admission,traceClock,showMotionHeading:false,paneFactories:{console:()=>consoleAdapter(slots.console),explanation:()=>explanationAdapter(slots.explanation),engineering:()=>{const pane=createEngineeringPane({graphical:true,admission});pane.mount(slots.engineering,engineering,{id:'engineering',type:'diagram/v1'});return pane;}}});
 const view=mountMultiPaneControls({root,session:driver.session,experience,slots,instanceId,composed:true}),surface=attachMotionFixtureSurface(root,driver.session);root.setAttribute('data-composed-player','');
 return {...driver,slots,view,dispose(){surface.dispose();view.dispose();driver.dispose();access.dispose();root.removeAttribute('data-composed-player');}};
}
