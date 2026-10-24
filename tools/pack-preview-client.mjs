import {mountComposedPlayer} from '../src/multipane/composition.mjs';
import {createVerifiedMediaAccess} from '../src/multipane/motion-media.mjs';
import {projectPreviewMedia} from '../authoring/v3/production-media.mjs';
import {createPreviewDriver} from './pack-preview-driver.mjs';
const root=document.querySelector('#preview-player'),error=document.querySelector('#preview-error');let player,access;
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function verifiedJSON(path,descriptor){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);try{
  const expected=new URL(path,location.origin).href,response=await fetch(expected,{signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',mode:'same-origin'});if(!response.ok||response.redirected||response.url!==expected||!response.body)throw new Error('CIM-V3-PREVIEW: pack JSON unavailable. Fix: validate and refresh the local source.');
  const reader=response.body.getReader(),parts=[];let count=0;try{for(;;){const r=await reader.read();if(r.done)break;count+=r.value.byteLength;if(count>(descriptor.size??2097152)){await reader.cancel();throw new Error('CIM-V3-PREVIEW: pack JSON exceeds its size declaration. Fix: rebuild and validate the source.');}parts.push(r.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  if(descriptor.size!==undefined&&count!==descriptor.size||await sha(bytes)!==descriptor.sha256)throw new Error('CIM-V3-PREVIEW: pack JSON fingerprint mismatch. Fix: validate and refresh the original source.');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);}
}
try{
 const base=root.dataset.cimPackBase,manifest=await verifiedJSON(base+'cim-lesson-pack.json',{sha256:root.dataset.cimManifestSha});
 const entry=manifest.lessons[0],file=path=>{const d=manifest.files.find(f=>f.path===path);if(!d)throw new Error('CIM-V3-PREVIEW: undeclared pack file. Fix: validate the source manifest.');return d;};
 const experience=await verifiedJSON(base+entry.file,file(entry.file)),capture=await verifiedJSON(base+entry.capture,file(entry.capture));
 const media=projectPreviewMedia(experience.renderer_config.media),bindings={};
 for(const clip of media.assets)for(const d of [clip,clip.captions,...(clip.webm?[clip.webm,clip.webm.captions]:[])])bindings['pack:'+d.source.path]='/__cim_fixture_media/'+base.split('/')[2]+'/'+d.source.path;
 access=createVerifiedMediaAccess(media,{origin:location.origin,bindings});
 const config=experience.renderer_config,engineering={fixtureOnly:true,placeholder:manifest.placeholder,hosts:config.architecture.hosts,services:config.architecture.services,artifacts:config.architecture.artifacts,initial:experience.initial_state.panes.engineering,archive:{id:capture.archive.id,root:capture.archive.root},records:capture.records,evidence:capture.archive.files,beats:experience.steps.map(s=>({id:s.id,records:s.state.engineering_records.map(r=>r.id),state:s.state.panes.engineering}))};
 player=mountComposedPlayer({root,experience,media,engineering,access,createDriver:createPreviewDriver,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});root.dataset.cimPreview='ready';
 addEventListener('pagehide',()=>player.dispose(),{once:true});
}catch(reason){try{player?.dispose();access?.dispose();}catch{}root.replaceChildren();root.removeAttribute('data-composed-player');root.dataset.cimPreview='failed';error.textContent=reason.message;}
