// Production real-time transition driver for admitted panes/v1 lessons.
// Uses the browser clock through the existing scoped capabilities; no harness or tools code.
import {createMultiPaneSession} from '../../src/multipane/session.mjs';
import {createRendererAbortCapability,createRendererClockCapability} from '../../src/runtime/renderer-capabilities.mjs';

export function createPanesDriver(experience,slots,options){
 if(!options||options.admission===null||typeof options.admission!=='object')throw new TypeError('Production panes playback requires an admission token.');
 const tasks=new Map(),scheduler={now:()=>performance.now(),schedule(fn,ms){const handle=Symbol('cim-delay'),id=setTimeout(()=>{tasks.delete(handle);fn(performance.now());},ms);tasks.set(handle,()=>clearTimeout(id));return handle;},cancel(handle){const cancel=tasks.get(handle);tasks.delete(handle);cancel?.();},onFrame(fn){const handle=Symbol('cim-frame');let id;const tick=now=>{if(!tasks.has(handle))return;fn(now);if(tasks.has(handle))id=requestAnimationFrame(tick);};tasks.set(handle,()=>cancelAnimationFrame(id));id=requestAnimationFrame(tick);return handle;}};
 const panes=Object.fromEntries(experience.renderer_config.panes.map(p=>[p.id,options.paneFactories[p.id]()]));
 const openTransition=generation=>{const abort=createRendererAbortCapability(),clock=createRendererClockCapability({transitionId:generation,scheduler});const base={clock:clock.facade,cancellation:abort.facade,pause:()=>clock.controller.pause(),resume:()=>clock.controller.resume(),cancel:reason=>abort.controller.abort(reason),close(){clock.controller.revoke();abort.controller.close();}};return options.wrapTransition?.(base,generation)??base;};
 const session=createMultiPaneSession({experience,admission:options.admission,panes,openTransition,reducedMotion:options.reducedMotion===true});
 return{session,dispose(){session.dispose();for(const handle of [...tasks.keys()])scheduler.cancel(handle);}};
}
