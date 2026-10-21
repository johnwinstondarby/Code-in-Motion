import {createMultiPaneFixtureDriver} from './multipane-test-driver.mjs';
import {createMotionCoordinator} from '../src/multipane/motion-coordinator.mjs';
export {attachMotionFixtureSurface} from '../src/multipane/action-surface.mjs';
export function createMotionFixtureDriver(experience,slots,options){return createMotionCoordinator(experience,slots,{...options,createDriver:createMultiPaneFixtureDriver});}
