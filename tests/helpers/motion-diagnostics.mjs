import {writeFile} from 'node:fs/promises';
export const motionDiagnosticsEnabled=(env=process.env)=>env.CIM_MOTION_DIAGNOSTICS==='1';
export async function installMotionDiagnostics(page,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return false;
 await page.addInitScript(()=>{
  const events=[];let dropped=0;
  const state=v=>v?{time:v.currentTime,duration:v.duration,ended:v.ended,seeking:v.seeking,readyState:v.readyState,paused:v.paused}:null;
  const record=(event,data)=>{if(events.length===512){events.shift();dropped++;}events.push({event,data,stamp:performance.now()});};
  for(const event of ['seeking','seeked','timeupdate','ended','pause','play','playing','waiting','canplay'])document.addEventListener(event,e=>{if(e.target instanceof HTMLMediaElement)record('native-'+event,state(e.target));},true);
  window.__motionObserveSession=session=>session.subscribe(next=>record('session',{progress:next.progress,playing:next.playing,failures:next.failures,video:state(document.querySelector('.motion-pane video'))}));
  window.__motionDiagnosticSnapshot=()=>({events:[...events],dropped});
 });return true;
}
export async function observeMotionSession(page,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return false;
 await page.evaluate(()=>window.__motionObserveSession(fixture.session));return true;
}
export async function recordMotionCheck(page,video,info,{enabled=motionDiagnosticsEnabled()}={}){
 if(enabled!==true)return video.evaluate(v=>v.ended||v.currentTime>=v.duration-0.15);
 const record=await video.evaluate(v=>({check:{time:v.currentTime,duration:v.duration,ended:v.ended,seeking:v.seeking,readyState:v.readyState,paused:v.paused,ok:v.ended||v.currentTime>=v.duration-0.15},session:fixture.session.read(),clock:fixture.clockEvents,...window.__motionDiagnosticSnapshot()}));
 const text=JSON.stringify(record,null,2),path=info.outputPath('motion-diagnostics.json');await writeFile(path,text);await info.attach('motion-diagnostics',{path,contentType:'application/json'});
 if(!record.check.ok)console.log('MOT-07_DIAGNOSTICS '+JSON.stringify(record));return record.check.ok;
}
