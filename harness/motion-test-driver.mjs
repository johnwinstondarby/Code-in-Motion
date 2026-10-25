import {createMultiPaneFixtureDriver} from './multipane-test-driver.mjs';
import {createMotionCoordinator} from '../src/multipane/motion-coordinator.mjs';
export {attachMotionFixtureSurface} from '../src/multipane/action-surface.mjs';
export function createMotionFixtureDriver(experience,slots,options){return createMotionCoordinator(experience,slots,{...options,traceClock:true,createDriver(experience,slots,driverOptions){
 if(typeof options.observeMotionCompletion!=='function')return createMultiPaneFixtureDriver(experience,slots,driverOptions);
 const factory=driverOptions.paneFactories.motion;
 return createMultiPaneFixtureDriver(experience,slots,{...driverOptions,paneFactories:{...driverOptions.paneFactories,motion(){
  const pane=factory();return {...pane,play(...args){const result=pane.play(...args);Promise.resolve(result).then(value=>options.observeMotionCompletion(value),error=>options.observeMotionCompletion({status:'failed',error:String(error)})).catch(error=>console.error('Motion observation failed',error));return result;}};
 }}});
}});}
