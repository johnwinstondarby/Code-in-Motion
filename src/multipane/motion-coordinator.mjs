import {createMotionAdapter} from './motion.mjs';
import {createMediaBarrier} from './media-barrier.mjs';
export function createMotionCoordinator(experience,slots,options){
 const adapter=createMotionAdapter({access:options.access,showHeading:options.showMotionHeading!==false});let scope;const clockEvents=[];
 const motion={mount:adapter.pane.mount,settle:adapter.pane.settle,dispose:adapter.pane.dispose,
  async play(state,context){const current=scope;try{await adapter.prepare(state);}catch(error){current.barrier.release('preparation');return{status:'failed',error};}if(current!==scope||context.cancellation.aborted)return{status:'cancelled'};current.barrier.release('preparation');const clock=Object.freeze({...current.barrier.clock,observe(fn){return current.barrier.clock.observe(event=>{clockEvents.push({...event,time:current.barrier.clock.now(),intent:driver.session.read().playing});fn(event);});}});return adapter.pane.play(state,Object.freeze({...context,clock}));}};
 const driver=options.createDriver(experience,slots,{...options,paneFactories:{...options.paneFactories,motion:()=>{motion.mount(slots.motion,options.media,{id:'motion',type:'motion/v1'});return motion;}},wrapTransition(base){
  const barrier=createMediaBarrier(base);scope={barrier};barrier.hold('preparation');
  const off=adapter.observe(({buffering})=>{if(driver.session.read().waiting.motion)return;if(buffering)barrier.hold('buffering');else barrier.release('buffering');});
  // Non-GUI beats have no media preparation: waiting Motion is settled synchronously.
  queueMicrotask(()=>{const state=driver.session.read();if(state.waiting.motion)barrier.release('preparation');});
  return{clock:base.clock,cancellation:base.cancellation,pause:barrier.pause,resume:barrier.resume,cancel:base.cancel,close(){off();barrier.dispose();base.close();}};
 }});
 return{...driver,adapter,clockEvents};
}

