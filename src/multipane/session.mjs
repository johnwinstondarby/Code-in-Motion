import {createMultiPaneModel} from './model.mjs';
import {readonlyPaneData,paneTransition,PANE_METHODS} from '../contracts/pane.mjs';

// Composition owns transport. Panes receive only the existing restricted contract.
export function createMultiPaneSession(options) {
  const experience=readonlyPaneData(options.experience),model=createMultiPaneModel({...options,experience});
  const ids=experience.renderer_config.panes.map(p=>p.id),panes=options.panes,subscribers=new Set();
  if(typeof options.openTransition!=='function'||ids.some(id=>!panes[id]||PANE_METHODS.some(key=>typeof panes[id][key]!=='function')))throw new TypeError('Mounted pane contracts and a scoped transition driver are required.');
  let state=model.initial(),active=null,disposed=false;
  const snapshot=index=>index<0?experience.initial_state:experience.steps[index].state;
  const stepId=index=>index<0?'initial':experience.steps[index].id;
  function settleAll(target,index){for(const id of ids)panes[id].settle(target.panes[id],{stepId:stepId(index),stepRendererConfig:null});}
  function stop(reason){const prior=active;active=null;if(prior){try{prior.driver.cancel(reason);}finally{prior.driver.close();}}}
  function notify(){for(const fn of [...subscribers])fn(state);}
  function begin(from,fromIndex){
    settleAll(from,fromIndex);
    const generation=state.generation,driver=options.openTransition(generation),target=snapshot(state.index),index=state.index;
    active={generation,driver};
    const work=ids.map(id=>{
      if(target.waiting[id]){panes[id].settle(target.panes[id],{stepId:stepId(index),stepRendererConfig:null});return Promise.resolve({id,status:'settled'});}
      try{return Promise.resolve(panes[id].play(target.panes[id],paneTransition({stepId:stepId(index),stepRendererConfig:null,fromState:from.panes[id],animate:true,reducedMotion:options.reducedMotion===true,clock:driver.clock,abortSignal:driver.cancellation}))).then(result=>({id,...result}),error=>({id,status:'failed',error}));}
      catch(error){return Promise.resolve({id,status:'failed',error});}
    });
    Promise.all(work).then(results=>{
      if(disposed||active?.generation!==generation||state.generation!==generation)return;
      active=null;driver.close();
      dispatch({type:'complete',generation,failures:results.filter(r=>r.status==='failed').map(r=>r.id)});
    });
  }
  function dispatch(event){
    if(disposed)throw new Error('Multi-pane session is disposed.');
    const before=state,next=model.reduce(state,event);if(next===before)return state;
    state=next;
    if(next.generation!==before.generation){
      stop('navigation');
      if(next.progress==='active')begin(event.type==='restart'?experience.initial_state:snapshot(before.index),event.type==='restart'?-1:before.index);
      else settleAll(snapshot(next.index),next.index);
    }else if(active&&next.playing!==before.playing){
      if(next.playing)active.driver.resume();else active.driver.pause();
    }
    notify();return state;
  }
  function dispose(){
    if(disposed)return;disposed=true;const errors=[];
    try{stop('disposed');}catch(error){errors.push(error);}
    for(const id of ids)try{panes[id].dispose();}catch(error){errors.push(error);}
    subscribers.clear();if(errors.length)throw new AggregateError(errors,'Multi-pane disposal failed.');
  }
  settleAll(experience.initial_state,-1);
  return Object.freeze({read:()=>state,dispatch,subscribe(fn){if(disposed)throw new Error('Multi-pane session is disposed.');if(typeof fn!=='function')throw new TypeError('Subscriber must be a function.');subscribers.add(fn);return()=>subscribers.delete(fn);},dispose});
}
