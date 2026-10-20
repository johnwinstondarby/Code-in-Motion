// Tests-first stub. No production entry point imports this module.
export function createMultiPaneModel({experience}) {
  const initial=Object.freeze({index:-1,progress:'initial',playing:false,tab:'console',generation:0,panelOpen:false,
    panes:experience.initial_state.panes,waiting:experience.initial_state.waiting,status:`Start · ${experience.steps.length} beats`});
  return Object.freeze({initial:()=>initial,reduce:state=>state});
}
