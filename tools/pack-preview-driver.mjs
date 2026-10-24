// Tools-only real-time adapter. No harness imports, WordPress admission or host clock.
import {createMultiPaneSession} from '../src/multipane/session.mjs';
import {createRendererAbortCapability,createRendererClockCapability} from '../src/runtime/renderer-capabilities.mjs';
export function createPreviewDriver(experience,slots,options){
 const tasks=new Map(),scheduler={now:()=>performance.now(),schedule(fn,ms){const handle=Symbol('preview-delay'),id=setTimeout(()=>{tasks.delete(handle);fn(performance.now());},ms);tasks.set(handle,()=>clearTimeout(id));return handle;},cancel(handle){const cancel=tasks.get(handle);tasks.delete(handle);cancel?.();},onFrame(fn){const handle=Symbol('preview-frame');let id;const tick=now=>{if(!tasks.has(handle))return;fn(now);if(tasks.has(handle))id=requestAnimationFrame(tick);};tasks.set(handle,()=>cancelAnimationFrame(id));id=requestAnimationFrame(tick);return handle;}};
 const panes=Object.fromEntries(experience.renderer_config.panes.map(p=>[p.id,options.paneFactories[p.id]() ]));
 const openTransition=generation=>{const abort=createRendererAbortCapability(),clock=createRendererClockCapability({transitionId:generation,scheduler});const base={clock:clock.facade,cancellation:abort.facade,pause:()=>clock.controller.pause(),resume:()=>clock.controller.resume(),cancel:reason=>abort.controller.abort(reason),close(){clock.controller.revoke();abort.controller.close();}};return options.wrapTransition?.(base,generation)??base;};
 // Existing experimental opt-in is supplied only by the preflighted, explicitly
 // marked local development preview. Experience/capture/media are actual pack data.
 const session=createMultiPaneSession({experience,testFixture:true,panes,openTransition,reducedMotion:options.reducedMotion===true});
 return{session,dispose(){session.dispose();for(const handle of [...tasks.keys()])scheduler.cancel(handle);}};
}
