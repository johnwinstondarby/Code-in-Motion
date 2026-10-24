import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionAdapter} from '../src/multipane/motion.mjs';
import {motionFixture} from './helpers/motion-fixture.mjs';
import {virtualScheduler} from './conformance/console-test-support.mjs';
import {createRendererAbortCapability} from '../src/runtime/renderer-capabilities.mjs';
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
async function setup({finalOffset=0}={}){
 const videos=[];let document;
 class Element extends EventTarget{
  constructor(tag){super();this.tag=tag;this.children=[];this.attrs={};this.ownerDocument=document;}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  append(...children){for(const c of children){c.parent=this;this.children.push(c);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  set textContent(v){this.text=v;this.children=[];}
  get textContent(){return (this.text??'')+this.children.map(c=>c.textContent).join('');}
 }
 class Video extends Element{
  constructor(){super('video');this.duration=1.2;this.readyState=4;this.seeking=false;this.paused=true;this._time=0;this.ended=false;videos.push(this);}
  canPlayType(){return 'probably';}load(){}
  get currentTime(){return this._time;}
  set currentTime(v){this.seekWrites=(this.seekWrites??0)+1;this.seekTargets??=[];this.seekTargets.push(v);this._time=v===this.duration?v-finalOffset:v;this.seeking=true;this.ended=false;}
  finishSeek(position=this._time){this._time=position;this.seeking=false;this.ended=this.currentTime===this.duration;this.dispatchEvent(new Event('seeked'));}
  pause(){this.paused=true;}
  play(){this.paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();}
 }
 document={createElement(tag){if(tag==='video')return new Video();const e=new Element(tag);if(tag==='track'){e.track={mode:'disabled'};e.readyState=2;}return e;}};
 const root=new Element('root'),map=motionFixture({format:'mp4'}).map;map.assets.push({...structuredClone(map.assets[0]),id:'second'});
 const adapter=createMotionAdapter({timeoutMs:100,access:{async load(id){return {videoURL:'blob:'+id,captionURL:'blob:captions',captions:map.assets[0].captions,release(){}};}}});
 adapter.pane.mount(root,map,{id:'motion',type:'motion/v1'});await adapter.prepare({asset:'gpu-memory'});
 const video=videos.at(-1),scheduler=virtualScheduler(),listeners=new Set();let running=true;
 const clock={now:()=>scheduler.time(),schedule:(fn,ms)=>scheduler.schedule(fn,ms),cancel:id=>scheduler.cancel(id),observe(fn){listeners.add(fn);fn({running});return()=>listeners.delete(fn);}};
 const cancellation=createRendererAbortCapability();let done=false,result;
 const promise=adapter.pane.play({asset:'gpu-memory'},{clock,cancellation:cancellation.facade,reducedMotion:false}).then(v=>{done=true;result=v;return v;});
 video.finishSeek();await flush();
 return {root,adapter,video,videos,promise,clock,cancellation:cancellation.facade,cancel(reason){cancellation.controller.abort(reason);},advance(ms){scheduler.advanceTo(ms);},pause(){running=false;for(const fn of [...listeners])fn({running});},resume(){running=true;for(const fn of [...listeners])fn({running});},get done(){return done;},get result(){return result;}};
}
async function finish(s){s.video.finishSeek();await flush();assert.equal((await s.promise).status,'settled');assert.equal(s.video.currentTime,s.video.duration);assert.equal(s.video.seeking,false);}
test('[ORDER-01] final seek must resolve after its first pending check',async()=>{const s=await setup();s.advance(1200);await flush();assert.equal(s.done,false);assert.equal(s.video.seeking,true);await finish(s);s.adapter.pane.dispose();});
test('[ORDER-02] early seeked and ended never complete ahead of the clock',async()=>{const s=await setup();s.video.currentTime=s.video.duration;s.video.finishSeek();s.video.dispatchEvent(new Event('ended'));await flush();assert.equal(s.done,false);s.advance(1200);await finish(s);s.adapter.pane.dispose();});
test('[ORDER-03] pause and resume while finalising preserve the final frame',async()=>{const s=await setup();s.advance(1200);await flush();s.pause();s.resume();await flush();assert.equal(s.done,false);await finish(s);assert.equal(s.video.paused,true);s.adapter.pane.dispose();});
test('[ORDER-04] a later absolute settle can replace a completed video; identities differ',async()=>{const s=await setup();s.advance(1200);await finish(s);const completed=s.video;s.adapter.pane.settle({asset:'second'});await flush();const replacement=s.videos.at(-1);assert.notEqual(replacement,completed);assert.notEqual(replacement.src,completed.src);assert.equal(completed.currentTime,completed.duration);replacement.finishSeek();await flush();s.adapter.pane.dispose();});
test('[ORDER-05] a late native play cannot restart completed media',async()=>{const s=await setup();s.advance(1200);await finish(s);await s.video.play();await flush();assert.equal(s.video.paused,true);assert.equal(s.video.currentTime,s.video.duration);s.adapter.pane.dispose();});
test('[ORDER-06] native late play rewinding an ended video restores the final hold immediately',async()=>{
 const s=await setup();s.advance(1200);await finish(s);assert.equal(s.video.ended,true);
 // Native play from the ended state rewinds before dispatching play/playing.
 s.video._time=0;s.video.ended=false;s.video.paused=false;s.video.dispatchEvent(new Event('play'));s.video.dispatchEvent(new Event('playing'));
 assert.equal(s.video.currentTime,s.video.duration,'a completed video must not remain rewound after an unauthorized native play');assert.equal(s.video.paused,true);s.video.finishSeek();await flush();s.adapter.pane.dispose();
});

test('[ORDER-07] a genuine new transition clears the previous final hold',async()=>{
 const s=await setup();s.advance(1200);await finish(s);
 const next=s.adapter.pane.play({asset:'gpu-memory'},{clock:s.clock,cancellation:s.cancellation,reducedMotion:false});s.video.finishSeek();await flush();s.pause();void s.video.play();assert.equal(s.video.currentTime,0,'a paused new transition must not restore the preceding final frame');s.adapter.pane.dispose();assert.equal((await next).status,'cancelled');
});

test('[ORDER-08] repeated unauthorized playback cannot cause an unbounded restore loop',async()=>{
 const s=await setup();s.advance(1200);await finish(s);const writes=s.video.seekWrites;
 for(let i=0;i<10;i++){s.video._time=0;s.video.ended=false;s.video.paused=false;s.video.dispatchEvent(new Event('play'));s.video.dispatchEvent(new Event('playing'));s.video.finishSeek();await flush();}
 assert.ok(s.video.seekWrites-writes<=2,'at most two corrective seeks per completed hold');assert.equal(s.result.status,'settled');assert.match(s.root.textContent,/GUI recording unavailable/);s.adapter.pane.dispose();
});

test('[ORDER-09] harmless final-frame events do not consume corrective-seek budget',async()=>{
 const s=await setup();s.advance(1200);await finish(s);const writes=s.video.seekWrites;
 for(let i=0;i<3;i++){for(const event of ['play','playing','seeking','seeked','timeupdate']){s.video.paused=false;s.video.dispatchEvent(new Event(event));await flush();}}
 assert.equal(s.video.seekWrites,writes);
 for(let i=0;i<2;i++){s.video._time=0;s.video.ended=false;s.video.paused=false;s.video.dispatchEvent(new Event('play'));assert.equal(s.video.currentTime,s.video.duration,'both corrective seeks remain available after harmless events');s.video.finishSeek();await flush();}
 assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);s.adapter.pane.dispose();
});

test('[ORDER-10] completed hold restores a rewind without any play event',async()=>{
 for(const event of ['seeking','seeked','timeupdate']){
  const s=await setup();s.advance(1200);await finish(s);let plays=0;s.video.addEventListener('play',()=>plays++);
  s.video._time=0;s.video.ended=false;s.video.dispatchEvent(new Event(event));
  assert.equal(s.video.currentTime,s.video.duration,`${event} must restore the completed frame without play/playing`);assert.equal(plays,0);assert.equal(s.result.status,'settled');s.video.finishSeek();await flush();s.adapter.pane.dispose();
 }
});


test('[ORDER-11] seek events neither restore nor spend budget in the next round or own final seek',async()=>{
 const s=await setup();s.advance(1200);await finish(s);
 const next=s.adapter.pane.play({asset:'gpu-memory'},{clock:s.clock,cancellation:s.cancellation,reducedMotion:false});s.video.finishSeek();await flush();const writes=s.video.seekWrites;
 for(const event of ['seeking','seeked','timeupdate']){s.video._time=0.3;s.video.ended=false;s.video.paused=false;s.video.dispatchEvent(new Event(event));await flush();assert.equal(s.video.currentTime,0.3,event+' must not restore during the next playback round');assert.equal(s.video.seekWrites,writes);assert.equal(s.video.paused,false);}
 s.advance(2400);await flush();assert.equal(s.video.currentTime,s.video.duration);assert.equal(s.video.seeking,true);const finalWrites=s.video.seekWrites;
 for(const event of ['seeking','timeupdate']){s.video.dispatchEvent(new Event(event));await flush();assert.equal(s.video.seekWrites,finalWrites,'own final seek must not trigger a corrective seek');}
 s.video.finishSeek();await flush();assert.equal((await next).status,'settled');assert.equal(s.video.seekWrites,finalWrites);
 for(let i=0;i<2;i++){s.video._time=0;s.video.ended=false;s.video.dispatchEvent(new Event('seeking'));assert.equal(s.video.currentTime,s.video.duration,'normal playback and final-seek events must leave both corrective seeks available');s.video.finishSeek();await flush();}
 assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);s.adapter.pane.dispose();
});


test('[ORDER-12] completed hold preserves the browser-reported exact or short final position',async()=>{
 for(const finalOffset of [0,0.033]){
  const s=await setup({finalOffset});s.advance(1200);await flush();s.video.finishSeek();await flush();
  assert.equal((await s.promise).status,'settled');assert.equal(s.video.seeking,false);
  const position=s.video.currentTime,writes=s.video.seekWrites;
  assert.equal(position,s.video.duration-finalOffset);
  for(let i=0;i<4;i++)for(const event of ['seeking','seeked','timeupdate']){s.video.dispatchEvent(new Event(event));await flush();}
  assert.equal(s.video.seekWrites,writes,'ordinary events must not spend the restore budget');
  assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);
  for(let i=0;i<2;i++){
   s.video._time=0;s.video.ended=false;s.video.dispatchEvent(new Event('timeupdate'));
   assert.equal(s.video.seekTargets.at(-1),position,'restore must seek the actual settled position');
   s.video.finishSeek();await flush();assert.equal(s.video.currentTime,position);
  }
  assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);s.adapter.pane.dispose();
 }
});


test('[ORDER-13] a final seek landing away retries once and preserves both completed-hold restores',async()=>{
 const s=await setup();try{s.advance(1200);await flush();const writes=s.video.seekWrites;s.video.finishSeek(0.467);await flush();assert.equal(s.done,false);assert.equal(s.video.seekWrites,writes+1);assert.equal(s.video.seekTargets.at(-1),1.2);await finish(s);
 for(let i=0;i<2;i++){s.video._time=0;s.video.ended=false;s.video.dispatchEvent(new Event('timeupdate'));assert.equal(s.video.seekTargets.at(-1),1.2);s.video.finishSeek();await flush();}assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);
 }finally{s.adapter.pane.dispose();}
});

test('[ORDER-14] repeated wrong seek landings exhaust two re-seeks and fail safely',async()=>{
 const s=await setup();try{s.advance(1200);await flush();const writes=s.video.seekWrites;for(let i=0;i<8;i++){s.video.finishSeek(0.467);await flush();}assert.equal(s.video.seekWrites-writes,2);assert.equal(s.done,true);assert.equal((await s.promise).status,'failed');assert.match(s.root.textContent,/GUI recording unavailable/);}finally{s.adapter.pane.dispose();}
});

test('[ORDER-15] a wrong landing during hold restore retries the recorded short position without spending another restore',async()=>{
 const s=await setup({finalOffset:0.033});try{s.advance(1200);await flush();s.video.finishSeek();await flush();assert.equal((await s.promise).status,'settled');const position=s.video.currentTime;
 for(let i=0;i<2;i++){s.video._time=0;s.video.ended=false;s.video.dispatchEvent(new Event('timeupdate'));const writes=s.video.seekWrites;s.video.finishSeek(0.467);await flush();assert.equal(s.video.seekWrites,writes+1);assert.equal(s.video.seekTargets.at(-1),position);s.video.finishSeek();await flush();assert.equal(s.video.currentTime,position);assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);}
 }finally{s.adapter.pane.dispose();}
});

test('[ORDER-16] Restart Previous jump and deep-link cancellation retire a pending re-seek before the next transition',async()=>{
 for(const navigation of ['Restart','Previous','jump','deep-link']){const s=await setup();try{s.advance(1200);await flush();s.video.finishSeek(0.467);await flush();assert.equal(s.video.seeking,true,navigation);s.cancel(navigation);assert.equal((await s.promise).status,'cancelled');const nextAbort=createRendererAbortCapability(),next=s.adapter.pane.play({asset:'gpu-memory'},{clock:s.clock,cancellation:nextAbort.facade,reducedMotion:false});const writes=s.video.seekWrites;s.video.finishSeek(0.467);await flush();assert.equal(s.video.seekWrites,writes,'old attempt must not re-seek during '+navigation);s.advance(2400);await flush();s.video.finishSeek();await flush();assert.equal((await next).status,'settled');assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);}finally{s.adapter.pane.dispose();}}
});

test('[ORDER-17] a re-seek uses the original final-settle deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const s=await setup();try{s.advance(1200);await flush();t.mock.timers.tick(60);s.video.finishSeek(0.467);await flush();assert.equal(s.video.seeking,true);t.mock.timers.tick(39);await flush();assert.equal(s.done,false);t.mock.timers.tick(1);await flush();assert.equal(s.done,true,'the original deadline must finish the attempt');assert.equal((await s.promise).status,'failed');assert.match(s.root.textContent,/GUI recording unavailable/);}finally{s.adapter.pane.dispose();}
});

test('[ORDER-18] cancelling an absolute hold settle cannot turn the new playback into a fallback',async()=>{
 const s=await setup();try{s.advance(1200);await finish(s);s.video._time=0;s.video.ended=false;s.adapter.pane.settle({asset:'gpu-memory'});assert.equal(s.video.seeking,true);const next=s.adapter.pane.play({asset:'gpu-memory'},{clock:s.clock,cancellation:s.cancellation,reducedMotion:false});await flush();assert.doesNotMatch(s.root.textContent,/GUI recording unavailable/);s.video.finishSeek();s.advance(2400);await flush();s.video.finishSeek();assert.equal((await next).status,'settled');}finally{s.adapter.pane.dispose();}
});
