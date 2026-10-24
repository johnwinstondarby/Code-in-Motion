import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionAdapter} from '../src/multipane/motion.mjs';
import {motionFixture} from './helpers/motion-fixture.mjs';
import {virtualScheduler} from './conformance/console-test-support.mjs';
import {createRendererAbortCapability} from '../src/runtime/renderer-capabilities.mjs';
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
async function setup(){
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
  set currentTime(v){this._time=v;this.seeking=true;this.ended=false;}
  finishSeek(){this.seeking=false;this.ended=this.currentTime===this.duration;this.dispatchEvent(new Event('seeked'));}
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
 return {adapter,video,videos,promise,advance(ms){scheduler.advanceTo(ms);},pause(){running=false;for(const fn of [...listeners])fn({running});},resume(){running=true;for(const fn of [...listeners])fn({running});},get done(){return done;},get result(){return result;}};
}
async function finish(s){s.video.finishSeek();await flush();assert.equal((await s.promise).status,'settled');assert.equal(s.video.currentTime,s.video.duration);assert.equal(s.video.seeking,false);}
test('[ORDER-01] final seek must resolve after its first pending check',async()=>{const s=await setup();s.advance(1200);await flush();assert.equal(s.done,false);assert.equal(s.video.seeking,true);await finish(s);s.adapter.pane.dispose();});
test('[ORDER-02] early seeked and ended never complete ahead of the clock',async()=>{const s=await setup();s.video.currentTime=s.video.duration;s.video.finishSeek();s.video.dispatchEvent(new Event('ended'));await flush();assert.equal(s.done,false);s.advance(1200);await finish(s);s.adapter.pane.dispose();});
test('[ORDER-03] pause and resume while finalising preserve the final frame',async()=>{const s=await setup();s.advance(1200);await flush();s.pause();s.resume();await flush();assert.equal(s.done,false);await finish(s);assert.equal(s.video.paused,true);s.adapter.pane.dispose();});
test('[ORDER-04] a later absolute settle can replace a completed video; identities differ',async()=>{const s=await setup();s.advance(1200);await finish(s);const completed=s.video;s.adapter.pane.settle({asset:'second'});await flush();const replacement=s.videos.at(-1);assert.notEqual(replacement,completed);assert.notEqual(replacement.src,completed.src);assert.equal(completed.currentTime,completed.duration);replacement.finishSeek();await flush();s.adapter.pane.dispose();});
test('[ORDER-05] a late native play cannot restart completed media',async()=>{const s=await setup();s.advance(1200);await finish(s);await s.video.play();await flush();assert.equal(s.video.paused,true);assert.equal(s.video.currentTime,s.video.duration);s.adapter.pane.dispose();});
