import {createMultiPaneFixtureDriver} from './multipane-test-driver.mjs';
import {createMotionAdapter} from '../src/multipane/motion.mjs';
export function createMotionFixtureDriver(experience,slots,options){
 const adapter=createMotionAdapter({access:options.access});
 const driver=createMultiPaneFixtureDriver(experience,slots,{...options,paneFactories:{motion:()=>{adapter.pane.mount(slots.motion,options.media,{id:'motion',type:'motion/v1'});return adapter.pane;}}});
 return {...driver,adapter};
}
