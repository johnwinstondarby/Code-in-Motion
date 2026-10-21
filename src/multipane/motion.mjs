import {readonlyPaneData} from '../contracts/pane.mjs';
import {validateMediaMap} from './media-map.mjs';
const code='CIM-PANE-MEDIA-UNAVAILABLE';
export const motionLabel=placeholder=>placeholder?'Placeholder GUI · simulated':'Recorded in the lab';
export function createMotionAdapter({access,timeoutMs=2500,showHeading=true}={}){
 if(!access||typeof access.load!=='function')throw new TypeError('Motion requires restricted verified-media access.');
 let root,config,video,media,asset=null,failed=false,disposed=false,revision=0,loading=null,io=null,active=null,authorizedPlayback=false;
 const observers=new Set(),offEvents=[];
 const emit=buffering=>{for(const fn of [...observers])fn(Object.freeze({buffering}));};
 function cancelPlay(reason='cancelled'){active?.finish({status:'cancelled',reason});}
 function clear(){authorizedPlayback=false;cancelPlay();io?.abort();io=null;for(const off of offEvents.splice(0))off();if(video)retireMediaElement(video);video=null;media?.release();media=null;}
 function element(tag,text,attrs={}){const node=root.ownerDocument.createElement(tag);if(text!==null)node.textContent=text;for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;}
 function frame(alt){const section=element('section',null,{class:'motion-pane','aria-label':'Motion recording and text alternative'});if(showHeading)section.append(element('h4',motionLabel(config.placeholder)));if(config.placeholder)section.append(element('strong','Placeholder content'));section.append(element('p',alt));root.replaceChildren(section);return section;}
 function fallback(alt){if(disposed)return;failed=true;video?.pause();const section=frame(alt??'No recording is available for this beat.');const details=element('details',null,{'data-media-details':''});details.append(element('summary','Show details'),element('p',code));section.append(element('p','GUI recording unavailable'),details);emit(false);}
 function requireMounted(){if(!root||disposed)throw new Error('Motion is not mounted.');}
 function on(target,name,fn){target.addEventListener(name,fn);const off=()=>target.removeEventListener(name,fn);offEvents.push(off);return off;}
 function waitReady(target,events,check,signal,budget=timeoutMs){return new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);for(const e of events)target.removeEventListener(e,inspect);target.removeEventListener('error',bad);signal?.removeEventListener('abort',bad);};const bad=()=>{clean();reject(new Error(code));};const inspect=()=>{if(check()){clean();resolve();}};for(const e of events)target.addEventListener(e,inspect);target.addEventListener('error',bad);signal?.addEventListener('abort',bad,{once:true});timer=setTimeout(bad,budget);if(signal?.aborted)bad();else inspect();});}
 async function prepare(state){
  requireMounted();const next=readonlyPaneData(state);if(!next?.asset)return;
  const descriptor=config.assets.find(a=>a.id===next.asset);if(!descriptor){fallback(next.alt);throw new Error(code);}
  if(asset===next.asset){if(failed)throw new Error(code);if(loading)return loading;if(media&&video?.readyState>=2)return;}
  const token=++revision;clear();asset=next.asset;failed=false;io=new AbortController();const signal=io.signal;
  const section=frame(descriptor.alt),message=element('p','Preparing verified recording');section.append(message);emit(true);
  const requestController=io,deadline=performance.now()+timeoutMs;let expiry,timedOut=false;
  const remaining=()=>Math.max(1,deadline-performance.now());
  const probe=element('video',null),mime=type=>type==='video/mp4'?'video/mp4; codecs="avc1.42E01E"':'video/webm; codecs="vp8, vorbis"';
  const choices=[['primary',descriptor],...(descriptor.webm?[['webm',descriptor.webm]]:[])].filter(([,d])=>probe.canPlayType(mime(d.type))!=='');
  const work=(async()=>{
   if(!choices.length)throw new Error(code);
   for(let index=0;index<choices.length;index++){
    const [copy,selected]=choices[index];
    // Verification failures are terminal. Only subsequent native decoding can authorize a retry.
    const loaded=await access.load(asset,{signal,copy,deadlineMs:remaining()});
    if(disposed||revision!==token||signal.aborted||performance.now()>=deadline){loaded.release();throw new Error(code);}media=loaded;
    const nextVideo=element('video',null,{'aria-label':descriptor.alt,playsinline:'',preload:'auto'});nextVideo.muted=true;nextVideo.controls=false;
    if(!loaded.videoURL.startsWith('blob:')||!loaded.captionURL.startsWith('blob:'))throw new Error(code);
    const track=element('track',null,{kind:'captions',srclang:loaded.captions.language,label:loaded.captions.label,default:'',src:loaded.captionURL});nextVideo.append(track);nextVideo.src=loaded.videoURL;video=nextVideo;
    for(const event of ['play','playing'])on(nextVideo,event,()=>{if(!authorizedPlayback)nextVideo.pause();});section.append(video);track.track.mode='showing';
    try{
     const ready=waitReady(nextVideo,['loadeddata','canplay'],()=>nextVideo.readyState>=2,signal,remaining());nextVideo.load();await ready;
     await waitReady(track,['load'],()=>track.readyState===2,signal,remaining());
     if(disposed||revision!==token||signal.aborted||performance.now()>=deadline)throw new Error(code);
     if(!Number.isFinite(nextVideo.duration)||Math.abs(nextVideo.duration-selected.duration)>0.2)throw new Error(code);
     message.remove();emit(false);return;
    }catch(error){
     retireMediaElement(nextVideo);nextVideo.remove();loaded.release();if(media===loaded)media=null;if(video===nextVideo)video=null;
     if(index+1>=choices.length||signal.aborted||performance.now()>=deadline)throw error;
    }
   }
  })();
  const bounded=new Promise((_,reject)=>{expiry=setTimeout(()=>{timedOut=true;requestController.abort();reject(new Error(code));},timeoutMs);});
  loading=Promise.race([work,bounded]).catch(error=>{if(!disposed&&revision===token&&(!signal.aborted||timedOut)){fallback(descriptor.alt);media?.release();media=null;}throw error;}).finally(()=>{clearTimeout(expiry);if(revision===token)loading=null;});
  return loading;
 }
 async function finalStill(){if(!video||failed)return;authorizedPlayback=false;video.pause();const target=video;const ready=waitReady(target,['seeked','ended'],()=>!target.seeking&&target.readyState>=2&&Math.abs(target.currentTime-target.duration)<0.15,io?.signal);target.currentTime=target.duration;await ready;}
 function settle(state){requireMounted();cancelPlay();const next=readonlyPaneData(state);const version=revision;
  if(!next?.asset){++revision;clear();asset=null;failed=false;frame('No GUI recording has played yet.');return;}
  if(next.asset===asset&&(failed||media&&!loading)){if(video&&!failed)finalStill().catch(()=>{if(!disposed&&revision===version)fallback(next.alt);});return;}
  prepare(next).then(()=>{if(!disposed&&asset===next.asset)return finalStill();}).catch(()=>{});
 }
 function play(state,context){
  requireMounted();cancelPlay();const descriptor=config.assets.find(a=>a.id===state?.asset);
  if(!descriptor||failed||!media||!video){fallback(descriptor?.alt??state?.alt);return Promise.resolve({status:'failed',error:new Error(code)});}
  if(context.cancellation.aborted)return Promise.resolve({status:'cancelled'});
  if(context.reducedMotion)return finalStill().then(()=>({status:'settled'}),()=>{fallback(descriptor.alt);return{status:'failed',error:new Error(code)};});
  return new Promise(resolve=>{
   let scheduled=null,offClock=()=>{},offAbort=()=>{},done=false,bufferTimer=null,finalising=false,clockRunning=false;const removers=[];const current=video,start=context.clock.now();
   const task={finish(result){if(done)return;done=true;authorizedPlayback=false;if(active===task)active=null;if(scheduled!==null)try{context.clock.cancel(scheduled);}catch{}clearTimeout(bufferTimer);offClock();offAbort();for(const off of removers)off();current.pause();emit(false);resolve(Object.freeze(result));}};active=task;
   const fail=()=>{if(done)return;fallback(descriptor.alt);task.finish({status:'failed',error:new Error(code)});};
   const listen=(event,fn)=>{current.addEventListener(event,fn);removers.push(()=>current.removeEventListener(event,fn));};
   const pinPause=()=>{authorizedPlayback=false;current.pause();const held=Math.min(current.duration,Math.max(0,(context.clock.now()-start)/1000));if(Number.isFinite(held))current.currentTime=held;};
   const playNative=()=>{if(done||finalising||!clockRunning)return;authorizedPlayback=true;current.play().then(()=>{if(!done&&!clockRunning)pinPause();},error=>{if(done)return;if(!clockRunning)pinPause();else if(error.name!=='AbortError')fail();});};
   listen('waiting',()=>{if(done||finalising)return;emit(true);clearTimeout(bufferTimer);bufferTimer=setTimeout(fail,timeoutMs);});
   listen('canplay',()=>{clearTimeout(bufferTimer);emit(false);});listen('error',fail);
   listen('ended',()=>{if(context.clock.now()-start>=descriptor.duration*1000)task.finish({status:'settled'});});
   offAbort=context.cancellation.onAbort(reason=>task.finish({status:'cancelled',reason}));
   if(done)return;current.currentTime=0;
   if(typeof context.clock.observe!=='function'){fail();return;}
   offClock=context.clock.observe(({running})=>{clockRunning=running;if(running)playNative();else pinPause();});
   function tick(){if(done)return;const elapsed=context.clock.now()-start;
    if(elapsed>=descriptor.duration*1000){finalising=true;finalStill().then(()=>task.finish({status:'settled'}),fail);return;}
    if(Math.abs(current.currentTime-elapsed/1000)>0.15)current.currentTime=elapsed/1000;
    scheduled=context.clock.schedule(tick,Math.min(40,descriptor.duration*1000-elapsed));
   }
   tick();
  });
 }
 const pane=Object.freeze({mount(target,data,identity){if(root||disposed)throw new Error('Motion cannot mount twice or after disposal.');identity=readonlyPaneData(identity);if(typeof identity?.id!=='string'||!identity.id||identity?.type!=='motion/v1'||Object.keys(identity).some(k=>!['id','type'].includes(k)))throw new TypeError('Restricted Motion identity required.');config=readonlyPaneData(data);const diagnostics=validateMediaMap(config);if(diagnostics.length)throw new Error(diagnostics[0].message);root=target;frame('No GUI recording has played yet.');},settle,play,dispose(){if(disposed)return;disposed=true;++revision;clear();observers.clear();root?.replaceChildren();}});
 return Object.freeze({pane,prepare,observe(fn){if(typeof fn!=='function')throw new TypeError('Readiness observer must be a function.');observers.add(fn);return()=>observers.delete(fn);}});
}

// A pending native seek must not be synchronously reset: WebKit can block inside load().
// Paused, detached elements and revoked Blob URLs can be released by the browser without that reset.
export function retireMediaElement(target){target.pause();target.removeAttribute('src');if(target.readyState===4&&!target.seeking)target.load();}
