import {writeFile} from 'node:fs/promises';
export const motionDiagnosticsEnabled=(env=process.env)=>env.CIM_MOTION_DIAGNOSTICS==='1';
export async function installMotionDiagnostics(page,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return false;
 await page.addInitScript(()=>{
  const events=[],ids=new WeakMap();let dropped=0,nextId=0;
  const state=v=>{if(!v)return null;if(!ids.has(v))ids.set(v,'video-'+(++nextId));return {identity:ids.get(v),src:v.currentSrc||v.src,time:v.currentTime,duration:v.duration,ended:v.ended,seeking:v.seeking,readyState:v.readyState,paused:v.paused};};
  const record=(event,data)=>{if(events.length===512){events.shift();dropped++;}events.push({event,data,stamp:performance.now()});};
  for(const event of ['seeking','seeked','timeupdate','ended','pause','play','playing','waiting','canplay'])document.addEventListener(event,e=>{if(e.target instanceof HTMLMediaElement)record('native-'+event,state(e.target));},true);
  window.__motionVideoSnapshot=state;
  window.__motionCompleted=result=>{const session=window.fixture.session.read();record('motion-completion',{result:{status:result.status},index:session.index,generation:session.generation,video:state(document.querySelector('.motion-pane video'))});};
  window.__motionObserveSession=session=>session.subscribe(next=>record('session',{index:next.index,generation:next.generation,progress:next.progress,playing:next.playing,failures:next.failures,video:state(document.querySelector('.motion-pane video'))}));
  window.__motionDiagnosticSnapshot=()=>({events:[...events],dropped});
 });return true;
}
export async function observeMotionSession(page,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return false;
 await page.evaluate(()=>window.__motionObserveSession(fixture.session));return true;
}
export async function recordMotionCheck(page,video,info,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return video.evaluate(v=>v.ended||v.currentTime>=v.duration-0.15);
 const record=await video.evaluate(v=>({check:{...window.__motionVideoSnapshot(v),index:fixture.session.read().index,generation:fixture.session.read().generation,ok:v.ended||v.currentTime>=v.duration-0.15},session:fixture.session.read(),clock:fixture.clockEvents,...window.__motionDiagnosticSnapshot()}));
 const text=JSON.stringify(record,null,2),path=info.outputPath('motion-diagnostics.json');await writeFile(path,text);await info.attach('motion-diagnostics',{path,contentType:'application/json'});
 if(!record.check.ok)console.log('MOT-07_DIAGNOSTICS '+JSON.stringify(record));return record.check.ok;
}
export async function recordMotionFailure(page,info,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return false;
 let record;
 try{record=await page.evaluate(()=>({video:window.__motionVideoSnapshot?.(document.querySelector('.motion-pane video'))??null,session:window.fixture?.session.read()??null,clock:window.fixture?.clockEvents??[],...(window.__motionDiagnosticSnapshot?.()??{})}));}
 catch(error){record={snapshotError:String(error)};}
 record.failure={status:info.status,message:info.error?.message??''};
 const path=info.outputPath('motion-failure.json');await writeFile(path,JSON.stringify(record,null,2));await info.attach('motion-failure',{path,contentType:'application/json'});console.log('MOT-07_FAILURE_DIAGNOSTICS '+JSON.stringify(record));return true;
}
