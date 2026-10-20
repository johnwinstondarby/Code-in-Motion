// Trusted fixture coordinator owns holds. Panes receive only clock, never this controller.
export function createMediaBarrier(driver){
 const holds=new Set(),listeners=new Set();let intent=true,disposed=false,running=true;
 const announce=()=>{if(disposed)return;const next=intent&&holds.size===0;if(next!==running){running=next;if(running)driver.resume();else driver.pause();for(const fn of [...listeners])fn(Object.freeze({running}));}};
 const clock=Object.freeze({now:()=>driver.clock.now(),schedule:(fn,ms)=>driver.clock.schedule(fn,ms),cancel:id=>driver.clock.cancel(id),observe(fn){if(disposed)return()=>{};listeners.add(fn);fn(Object.freeze({running}));return()=>listeners.delete(fn);}});
 return Object.freeze({clock,hold(key){holds.add(key);announce();},release(key){holds.delete(key);announce();},pause(){intent=false;announce();},resume(){intent=true;announce();},dispose(){disposed=true;listeners.clear();holds.clear();}});
}
