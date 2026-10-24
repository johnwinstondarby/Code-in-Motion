# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/motion-pane.spec.mjs >> 1536x864 >> [MOT-07] verified Blob playback captions pause resume completion and hold
- Location: tests/e2e/motion-pane.spec.mjs:38:2

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.motion-pane').locator('video')

```

# Test source

```ts
  1  | import {writeFile} from 'node:fs/promises';
  2  | export const motionDiagnosticsEnabled=(env=process.env)=>env.CIM_MOTION_DIAGNOSTICS==='1';
  3  | export async function installMotionDiagnostics(page,{enabled=motionDiagnosticsEnabled()}={}){
  4  |  if(enabled!==true)return false;
  5  |  await page.addInitScript(()=>{
  6  |   const events=[],ids=new WeakMap();let dropped=0,nextId=0;
  7  |   const state=v=>{if(!v)return null;if(!ids.has(v))ids.set(v,'video-'+(++nextId));return {identity:ids.get(v),src:v.currentSrc||v.src,time:v.currentTime,duration:v.duration,ended:v.ended,seeking:v.seeking,readyState:v.readyState,paused:v.paused};};
  8  |   const record=(event,data)=>{if(events.length===512){events.shift();dropped++;}events.push({event,data,stamp:performance.now()});};
  9  |   for(const event of ['seeking','seeked','timeupdate','ended','pause','play','playing','waiting','canplay'])document.addEventListener(event,e=>{if(e.target instanceof HTMLMediaElement)record('native-'+event,state(e.target));},true);
  10 |   const wrapped=new WeakSet();let callId=0;
  11 |   const wrapMotionVideos=()=>{for(const video of document.querySelectorAll('.motion-pane video')){
  12 |    if(wrapped.has(video)||typeof video.play!=='function')continue;wrapped.add(video);const nativePlay=video.play;
  13 |    video.play=function(...args){const id=++callId;record('play-call',{id,stack:new Error('Motion play call').stack,video:state(this),session:window.fixture?.session.read()??null});
  14 |     let result;try{result=nativePlay.apply(this,args);}catch(error){record('play-throw',{id,error:String(error)});throw error;}
  15 |     result.then(()=>record('play-resolved',{id,video:state(video)}),error=>record('play-rejected',{id,error:String(error),video:state(video)}));return result;
  16 |    };
  17 |   }};
  18 |   new MutationObserver(wrapMotionVideos).observe(document,{childList:true,subtree:true});wrapMotionVideos();
  19 |   window.__motionVideoSnapshot=state;
  20 |   window.__motionCompleted=result=>{const session=window.fixture.session.read();record('motion-completion',{result:{status:result.status},index:session.index,generation:session.generation,video:state(document.querySelector('.motion-pane video'))});};
  21 |   window.__motionObserveSession=session=>session.subscribe(next=>record('session',{index:next.index,generation:next.generation,progress:next.progress,playing:next.playing,failures:next.failures,video:state(document.querySelector('.motion-pane video'))}));
  22 |   window.__motionDiagnosticSnapshot=()=>({events:[...events],dropped});
  23 |  });return true;
  24 | }
  25 | export async function observeMotionSession(page,{enabled=motionDiagnosticsEnabled()}={}){
  26 |  if(enabled!==true)return false;
  27 |  await page.evaluate(()=>window.__motionObserveSession(fixture.session));return true;
  28 | }
  29 | export async function recordMotionCheck(page,video,info,{enabled=motionDiagnosticsEnabled()}={}){
  30 |  if(enabled!==true)return video.evaluate(v=>v.ended||v.currentTime>=v.duration-0.15);
> 31 |  const record=await video.evaluate(v=>({check:{...window.__motionVideoSnapshot(v),index:fixture.session.read().index,generation:fixture.session.read().generation,ok:v.ended||v.currentTime>=v.duration-0.15},session:fixture.session.read(),clock:fixture.clockEvents,...window.__motionDiagnosticSnapshot()}));
     |                           ^ Error: locator.evaluate: Test timeout of 30000ms exceeded.
  32 |  const text=JSON.stringify(record,null,2),path=info.outputPath('motion-diagnostics.json');await writeFile(path,text);await info.attach('motion-diagnostics',{path,contentType:'application/json'});
  33 |  if(!record.check.ok)console.log('MOT-07_DIAGNOSTICS '+JSON.stringify(record));return record.check.ok;
  34 | }
  35 | export async function recordMotionFailure(page,info,{enabled=motionDiagnosticsEnabled()}={}){
  36 |  if(enabled!==true)return false;
  37 |  let record;
  38 |  try{record=await page.evaluate(()=>({video:window.__motionVideoSnapshot?.(document.querySelector('.motion-pane video'))??null,session:window.fixture?.session.read()??null,clock:window.fixture?.clockEvents??[],...(window.__motionDiagnosticSnapshot?.()??{})}));}
  39 |  catch(error){record={snapshotError:String(error)};}
  40 |  record.failure={status:info.status,message:info.error?.message??''};
  41 |  const path=info.outputPath('motion-failure.json');await writeFile(path,JSON.stringify(record,null,2));await info.attach('motion-failure',{path,contentType:'application/json'});console.log('MOT-07_FAILURE_DIAGNOSTICS '+JSON.stringify(record));return true;
  42 | }
  43 | 
```