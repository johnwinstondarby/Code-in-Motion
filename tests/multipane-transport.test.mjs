import test from 'node:test';
import assert from 'node:assert/strict';
import {createMultiPaneModel} from '../src/multipane/model.mjs';
import {fixtureExperience} from './helpers/multipane-experience.mjs';
import {createMultiPaneFixtureDriver,flushMultiPane} from '../harness/multipane-test-driver.mjs';
import {isWordPressSourceModule} from '../tools/build-wordpress-release.mjs';

const experience=fixtureExperience();
const make=()=>createMultiPaneModel({experience,testFixture:true});
const move=(m,state,...events)=>events.reduce((s,e)=>m.reduce(s,e),state);

test('[MP-01] beat start selects its action once',()=>{
 const m=make();let s=move(m,m.initial(),{type:'jump',index:1},{type:'play'});assert.equal(s.tab,'motion');
 s=move(m,s,{type:'tab',tab:'console'},{type:'pause'},{type:'play'});assert.equal(s.tab,'console');
 s=m.reduce(s,{type:'complete',generation:s.generation});assert.equal(s.tab,'console');
 s=m.reduce(s,{type:'next'});assert.equal(s.tab,'console');
});
test('[MP-02] manual tabs change neither position nor shared clock and hidden work continues',async()=>{
 const d=createMultiPaneFixtureDriver(experience);d.session.dispatch({type:'play'});
 const before=d.session.read(),pending=d.scheduler.pending(),time=d.scheduler.time(),writes=d.log.length;
 d.session.dispatch({type:'tab',tab:'motion'});
 assert.equal(d.session.read().index,before.index);assert.equal(d.session.read().generation,before.generation);
 assert.equal(d.session.read().playing,true);assert.equal(d.scheduler.pending(),pending);assert.equal(d.scheduler.time(),time);
 assert.equal(d.log.length,writes);
 await d.advance(50);assert(d.log.some(x=>x.pane==='console'&&x.stage==='middle'));d.dispose();
});
test('[MP-03] pause and resume retain the manual tab and freeze the shared clock',async()=>{
 const d=createMultiPaneFixtureDriver(experience);d.session.dispatch({type:'play'});await d.advance(40);
 d.session.dispatch({type:'tab',tab:'motion'});d.session.dispatch({type:'pause'});const count=d.log.length;
 await d.advance(500);assert.equal(d.log.length,count);assert.equal(d.session.read().tab,'motion');
 d.session.dispatch({type:'play'});assert.equal(d.session.read().tab,'motion');await d.advance(10);
 assert(d.log.length>count);d.dispose();
});
test('[MP-04] Next completes the current beat then advances paused without resetting a manual choice on completion',()=>{
 const m=make();let s=move(m,m.initial(),{type:'play'},{type:'tab',tab:'motion'},{type:'next'});
 assert.equal(s.index,0);assert.equal(s.progress,'settled');assert.equal(s.playing,false);assert.equal(s.tab,'motion');
 s=m.reduce(s,{type:'next'});assert.equal(s.index,1);assert.equal(s.progress,'settled');assert.equal(s.tab,'console');
});
test('[MP-05] context-only beats hold the last completed action and final states',()=>{
 const m=make(),index=experience.steps.findIndex(s=>s.id==='review-run-metadata');
 const s=m.reduce(m.initial(),{type:'jump',index});
 assert.equal(s.tab,'console');assert.equal(s.waiting.console,true);assert.equal(s.waiting.motion,true);
 assert.deepEqual(s.panes.console,experience.steps[index-1].state.panes.console);
 assert.deepEqual(s.panes.motion,experience.steps[index-1].state.panes.motion);
});
test('[MP-06] context before any action shows Console in its initial state',()=>{
 const e=fixtureExperience({leadingContext:true}),m=createMultiPaneModel({experience:e,testFixture:true});
 const s=m.reduce(m.initial(),{type:'jump',index:0});assert.equal(s.index,0);assert.equal(s.tab,'console');
 assert.deepEqual(s.panes.console,e.initial_state.panes.console);
});
test('[MP-07] sequential context beats preserve override but direct arrival selects deterministic default',()=>{
 const m=make(),i=experience.steps.findIndex(s=>s.id==='review-run-metadata');
 let s=move(m,m.initial(),{type:'jump',index:i-1},{type:'tab',tab:'motion'},{type:'next'},{type:'next'});
 assert.equal(s.index,i+1);assert.equal(s.tab,'motion');
 s=m.reduce(s,{type:'jump',index:i+1});assert.equal(s.tab,'console');
});
test('[MP-08] Previous End jumps and deep links reconstruct every absolute pane state',()=>{
 const m=make();let s=move(m,m.initial(),{type:'end'},{type:'previous'});
 assert.equal(s.index,experience.steps.length-2);assert.deepEqual(s.panes,experience.steps[s.index].state.panes);
 for(let i=0;i<experience.steps.length;i++){
   s=m.reduce(s,{type:'deepLink',fragment:`#cim/${experience.id}/${experience.steps[i].id}`});
   assert.equal(s.index,i);assert.deepEqual(s.panes,experience.steps[i].state.panes);assert.equal(s.tab,experience.steps[i].state.action_tab);
 }
 const unchanged=m.reduce(s,{type:'deepLink',fragment:'#cim/other/unknown'});assert.deepEqual(unchanged,s);
});
test('[MP-09] Start restores every initial state and waits',()=>{
 const m=make(),s=move(m,m.initial(),{type:'end'},{type:'start'});
 assert.equal(s.index,-1);assert.equal(s.playing,false);assert.equal(s.tab,'console');assert.deepEqual(s.panes,experience.initial_state.panes);
});
test('[MP-10] Restart cancels prior work and plays beat one from initial states',async()=>{
 const d=createMultiPaneFixtureDriver(experience);d.session.dispatch({type:'jump',index:2});d.session.dispatch({type:'play'});await d.advance(20);
 const old=d.session.read().generation,cut=d.log.length;d.session.dispatch({type:'restart'});
 assert(d.session.read().generation>old);assert.equal(d.session.read().index,0);assert.equal(d.session.read().playing,true);
 assert.equal(d.transitions[0].cancellation.aborted,true);
 assert(d.log.some(x=>x.pane==='motion'&&x.stage==='settled'&&x.state.frame===null));
 for(const id of Object.keys(experience.initial_state.panes))assert.deepEqual(d.log.slice(cut).find(x=>x.pane===id&&x.stage==='settled').state,experience.initial_state.panes[id]);
 await d.advance(160);assert.equal(d.session.read().playing,false);d.dispose();
});
test('[MP-11] opening Beats leaves position intent and clock untouched and tracks current beat',()=>{
 const m=make();const before=m.reduce(m.initial(),{type:'play'}),s=m.reduce(before,{type:'panelOpen'});
 assert.equal(s.panelOpen,true);assert.equal(s.index,before.index);assert.equal(s.playing,true);assert.equal(s.generation,before.generation);
});
test('[MP-12] closing Beats changes only panel visibility',()=>{
 const m=make(),before=move(m,m.initial(),{type:'play'},{type:'tab',tab:'motion'},{type:'panelOpen'}),s=m.reduce(before,{type:'panelClose'});
 assert.equal(s.panelOpen,false);assert.deepEqual({...s,panelOpen:true},before);
});
test('[MP-13] status distinguishes initial view from playing and paused beats',()=>{
 const m=make();assert.equal(m.initial().status,`Start · ${experience.steps.length} beats`);
 let s=m.reduce(m.initial(),{type:'play'});assert.equal(s.status,`Beat 1 / ${experience.steps.length} · playing`);
 s=m.reduce(s,{type:'pause'});assert.equal(s.status,`Beat 1 / ${experience.steps.length} · paused`);
});
test('[MP-17] cancelled partial work cannot complete a different destination',async()=>{
 const d=createMultiPaneFixtureDriver(experience);d.session.dispatch({type:'play'});const generation=d.session.read().generation;
 await d.advance(30);d.session.dispatch({type:'jump',index:2});d.session.dispatch({type:'play'});const current=d.session.read();
 d.session.dispatch({type:'complete',generation,failures:['console']});assert.deepEqual(d.session.read(),current);
 await d.advance(1000);assert.equal(d.session.read().index,3);assert.equal(d.session.read().tab,'console');
 assert.equal(d.scheduler.pending(),0);assert.deepEqual(d.session.read().panes,experience.steps[3].state.panes);d.dispose();
});
test('[MP-18] rapid navigation invalidates stale work and settles all panes to the last destination',async()=>{
 const d=createMultiPaneFixtureDriver(experience);d.session.dispatch({type:'play'});
 for(const index of [7,0,6,2,4])d.session.dispatch({type:'jump',index});
 assert.equal(d.session.read().index,4);assert.equal(d.scheduler.pending(),0);
 for(const id of Object.keys(d.session.read().panes))assert.deepEqual(d.log.filter(x=>x.pane===id).at(-1).state,experience.steps[4].state.panes[id]);
 d.session.dispatch({type:'restart'});await flushMultiPane();d.session.dispatch({type:'pause'});const held=d.log.length;
 await d.advance(80);assert.equal(d.log.length,held);d.session.dispatch({type:'play'});await d.advance(1000);
 assert.equal(d.session.read().index,0);assert.equal(d.session.read().playing,false);assert.equal(d.session.read().progress,'settled');d.dispose();
});
test('[MP-19] reduced motion settles without scheduling work',async()=>{
 const d=createMultiPaneFixtureDriver(experience,{}, {reducedMotion:true});d.session.dispatch({type:'play'});await flushMultiPane();
 assert.equal(d.session.read().index,0);assert.equal(d.session.read().progress,'settled');assert.equal(d.session.read().playing,false);assert.equal(d.scheduler.counts.schedule,0);d.dispose();
});
test('[MP-20] activation requires a v3 projected fixture and never admits legacy lessons',()=>{
 assert.throws(()=>createMultiPaneModel({experience}),/fixture/);
 assert.throws(()=>createMultiPaneModel({experience:{...experience,renderer:'console/v1'},testFixture:true}),/panes/);
 // Part C deliberately ships these modules; activation still needs a fixture opt-in or a Part C admission token.
 for(const file of ['model','session','controls'])assert.equal(isWordPressSourceModule(`src/multipane/${file}.mjs`),true);
 assert.throws(()=>createMultiPaneModel({experience,admission:Object.freeze({})}),/fixture|admission/);
 assert.equal(isWordPressSourceModule('src/renderers/subjects/console/renderer.mjs'),true);
});
test('[MP-21] dispose cancels work and withdraws subscribers',async()=>{
 const d=createMultiPaneFixtureDriver(experience);let calls=0;d.session.subscribe(()=>calls++);d.session.dispatch({type:'play'});d.dispose();const before=calls;
 assert.equal(d.transitions[0].cancellation.aborted,true);
 await d.advance(1000);assert.equal(calls,before);assert.equal(d.scheduler.pending(),0);assert.throws(()=>d.session.dispatch({type:'play'}),/disposed/);
});
test('[MP-22] completion waits for every pane and classified failure releases participation',async()=>{
 const d=createMultiPaneFixtureDriver(experience,{}, {failPane:'console'});d.session.dispatch({type:'play'});
 await d.advance(120);assert.equal(d.session.read().playing,true);
 await d.advance(40);assert.equal(d.session.read().playing,false);assert.equal(d.session.read().progress,'settled');
 assert(d.session.read().failures.includes('console'));d.dispose();
});
