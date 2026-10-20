import {createMultiPaneModel} from './model.mjs';
// Tests-first stub: commands have no effect and no pane is started.
export function createMultiPaneSession(options) {
  const model=createMultiPaneModel(options);let state=model.initial();
  return Object.freeze({read:()=>state,dispatch:event=>{state=model.reduce(state,event);return state;},subscribe:()=>()=>{},dispose(){}});
}
