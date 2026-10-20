import {createPaneLifecycle} from '../contracts/pane.mjs';
export function createMotionAdapter(){const pane=createPaneLifecycle({validate(){},settle(){}});return Object.freeze({pane,prepare:async()=>{},observe:()=>()=>{}});}
