# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/motion-pane.spec.mjs >> 1536x864 >> [MOT-07] verified Blob playback captions pause resume completion and hold
- Location: tests/e2e/motion-pane.spec.mjs:37:2

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
  10 |   window.__motionVideoSnapshot=state;
  11 |   window.__motionCompleted=result=>{const session=window.fixture.session.read();record('motion-completion',{result:{status:result.status},index:session.index,generation:session.generation,video:state(document.querySelector('.motion-pane video'))});};
  12 |   window.__motionObserveSession=session=>session.subscribe(next=>record('session',{index:next.index,generation:next.generation,progress:next.progress,playing:next.playing,failures:next.failures,video:state(document.querySelector('.motion-pane video'))}));
  13 |   window.__motionDiagnosticSnapshot=()=>({events:[...events],dropped});
  14 |  });return true;
  15 | }
  16 | export async function observeMotionSession(page,{enabled=motionDiagnosticsEnabled()}={}){
  17 |  if(enabled!==true)return false;
  18 |  await page.evaluate(()=>window.__motionObserveSession(fixture.session));return true;
  19 | }
  20 | export async function recordMotionCheck(page,video,info,{enabled=motionDiagnosticsEnabled()}={}){
  21 |  if(enabled!==true)return video.evaluate(v=>v.ended||v.currentTime>=v.duration-0.15);
> 22 |  const record=await video.evaluate(v=>({check:{...window.__motionVideoSnapshot(v),index:fixture.session.read().index,generation:fixture.session.read().generation,ok:v.ended||v.currentTime>=v.duration-0.15},session:fixture.session.read(),clock:fixture.clockEvents,...window.__motionDiagnosticSnapshot()}));
     |                           ^ Error: locator.evaluate: Test timeout of 30000ms exceeded.
  23 |  const text=JSON.stringify(record,null,2),path=info.outputPath('motion-diagnostics.json');await writeFile(path,text);await info.attach('motion-diagnostics',{path,contentType:'application/json'});
  24 |  if(!record.check.ok)console.log('MOT-07_DIAGNOSTICS '+JSON.stringify(record));return record.check.ok;
  25 | }
  26 | 
```