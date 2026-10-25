import {readonlyPaneData} from '../contracts/pane.mjs';

import {isAdmittedExperience} from './admission.mjs';
import {panesModelProblem} from './projection.mjs';

// Fixture entry point, or production with a Part C admission token bound to this exact lesson.
export function createMultiPaneModel({experience,testFixture,admission}) {
  if(testFixture!==true&&!isAdmittedExperience(admission,readonlyPaneData(experience)))throw new TypeError('Multi-pane transport requires an explicit test fixture or a matching admission token.');
  const problem=panesModelProblem(experience);
  if(problem)throw new TypeError(problem.message);
  const doc=readonlyPaneData(experience);
  const declarations=doc.renderer_config.panes,consoleId=declarations.find(p=>p.type==='console/v1').id,motionId=declarations.find(p=>p.type==='motion/v1').id;
  const tabs=[consoleId,motionId],ids=declarations.map(p=>p.id);
  const present=s=>Object.freeze({...s,status:s.index<0?`Start · ${doc.steps.length} beats`:`Beat ${s.index+1} / ${doc.steps.length} · ${s.playing?'playing':'paused'}`});
  const initial=present({index:-1,progress:'initial',playing:false,tab:consoleId,generation:0,panelOpen:false,panes:doc.initial_state.panes,waiting:doc.initial_state.waiting,failures:Object.freeze([])});
  function enter(s,index,mode,active=false){
    if(!Number.isInteger(index)||index< -1||index>=doc.steps.length)throw new RangeError('Unknown multi-pane beat.');
    const snapshot=index<0?doc.initial_state:doc.steps[index].state;
    const contextOnly=index>=0&&snapshot.actions.length===0;
    const tab=mode==='sequential'&&contextOnly?s.tab:snapshot.action_tab;
    return present({...s,index,progress:index<0?'initial':active?'active':'settled',playing:index>=0&&active,tab,generation:s.generation+1,panes:snapshot.panes,waiting:snapshot.waiting,failures:Object.freeze([])});
  }
  function reduce(s,event){
    switch(event.type){
      case 'tab':
        if(!tabs.includes(event.tab))throw new RangeError('Unknown action tab.');
        return event.tab===s.tab?s:present({...s,tab:event.tab});
      case 'pause':return s.playing?present({...s,playing:false}):s;
      case 'play':
        if(s.progress==='active')return s.playing?s:present({...s,playing:true});
        return s.index+1<doc.steps.length?enter(s,s.index+1,'sequential',true):s;
      case 'next':
        if(s.progress==='active')return present({...s,progress:'settled',playing:false,generation:s.generation+1});
        return s.index+1<doc.steps.length?enter(s,s.index+1,'sequential'):s;
      case 'previous':return enter(s,Math.max(-1,s.index-1),'direct');
      case 'end':return enter(s,doc.steps.length-1,'direct');
      case 'jump':return enter(s,event.index,'direct');
      case 'start':return enter(s,-1,'direct');
      case 'restart':return enter(s,0,'direct',true);
      case 'deepLink':{
        let parts;try{parts=event.fragment.slice(1).split('/').map(decodeURIComponent);}catch{return s;}
        if(!event.fragment.startsWith('#')||parts.length!==3||parts[0]!=='cim'||parts[1]!==doc.id)return s;
        const index=doc.steps.findIndex(step=>step.id===parts[2]);return index<0?s:enter(s,index,'direct');
      }
      case 'panelOpen':return s.panelOpen?s:present({...s,panelOpen:true});
      case 'panelClose':return s.panelOpen?present({...s,panelOpen:false}):s;
      case 'complete':
        if(event.generation!==s.generation||s.progress!=='active')return s;
        return present({...s,progress:'settled',playing:false,failures:Object.freeze([...(event.failures??[])])});
      default:throw new TypeError('Unknown multi-pane event.');
    }
  }
  return Object.freeze({initial:()=>initial,reduce});
}
