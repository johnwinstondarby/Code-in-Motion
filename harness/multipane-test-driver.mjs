// Test-only instrumented text panes, not the Engineering or Motion implementation.
import {createPaneLifecycle} from '../src/contracts/pane.mjs';
import {createRendererAbortCapability,createRendererClockCapability} from '../src/runtime/renderer-capabilities.mjs';
import {createMultiPaneSession} from '../src/multipane/session.mjs';
import {virtualScheduler} from '../tests/conformance/console-test-support.mjs';

export const flushMultiPane=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
export function createMultiPaneFixtureDriver(experience,slots={},options={}) {
  const scheduler=virtualScheduler(),log=[],transitions=[];
  const durations={console:100,motion:140,explanation:120,engineering:160};
  const panes=Object.fromEntries(experience.renderer_config.panes.map(p=>{
    const write=(stage,state)=>{
      log.push({pane:p.id,stage,state,time:scheduler.time()});
      const slot=slots[p.id],text=stage==='settled'?JSON.stringify(state):`Placeholder ${stage}: ${JSON.stringify(state)}`;
      if(slot&&slot.textContent!==text)slot.textContent=text;
    };
    const pane=createPaneLifecycle({validate(){},
      frames:()=>[{delayMs:0,stage:'begin'},{delayMs:durations[p.id]/2,stage:'middle'},{delayMs:durations[p.id]/2}],
      settle:(_,state)=>write('settled',state),frame:(_,frame,state)=>{
        if(options.failPane===p.id)throw new Error('Test pane failure');
        write(frame.stage,state);
      }});
    pane.mount(slots[p.id]??{}, {}, {id:p.id,type:p.type});return[p.id,pane];
  }));
  const openTransition=generation=>{
    const abort=createRendererAbortCapability(),clock=createRendererClockCapability({transitionId:generation,scheduler});
    const transition={clock:clock.facade,cancellation:abort.facade,
      pause:()=>clock.controller.pause(),resume:()=>clock.controller.resume(),
      cancel:reason=>abort.controller.abort(reason),close:()=>{clock.controller.revoke();abort.controller.close();}};
    transitions.push(transition);return transition;
  };
  const session=createMultiPaneSession({experience,testFixture:true,panes,openTransition,reducedMotion:options.reducedMotion===true});
  return {session,scheduler,log,transitions,async advance(ms){scheduler.advanceTo(scheduler.time()+ms);await flushMultiPane();},dispose(){session.dispose();}};
}
