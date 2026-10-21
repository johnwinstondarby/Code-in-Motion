import {readonlyPaneData} from '../contracts/pane.mjs';
import {validateMediaMap} from './media-map.mjs';
const unavailable=()=>new Error('CIM-PANE-MEDIA-UNAVAILABLE: GUI recording unavailable. Check the declared file, permissions and fingerprint.');
export function createVerifiedMediaAccess(input,options={}){
 const map=readonlyPaneData(input);const diagnostics=validateMediaMap(map);if(diagnostics.length)throw new Error(diagnostics[0].id+': '+diagnostics[0].message);
 const origin=new URL(options.origin).origin,bindings=new Map(),request=options.fetch??globalThis.fetch,crypto=options.crypto??globalThis.crypto,urls=options.urls??URL;
 for(const[key,value]of Object.entries(options.bindings??{})){const url=new URL(value,origin);if(url.origin!==origin||!url.pathname.startsWith('/__cim_fixture_media/')||url.username||url.password||url.search||url.hash)throw new Error('CIM-MEDIA-SOURCE: Fixture binding must be a fixed same-origin media address.');bindings.set(key,url.href);}
 const live=new Set(),controllers=new Set();let disposed=false;
 const timeoutMs=options.timeoutMs??3000;if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new TypeError('Invalid fixture I/O deadline.');
 async function verified(descriptor,signal){
  const key=descriptor.source.type==='pack'?'pack:'+descriptor.source.path:'attachment:'+descriptor.source.id,url=bindings.get(key);if(!url)throw unavailable();
  const response=await request(url,{signal,redirect:'error',credentials:'omit',mode:'same-origin',cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok||response.redirected||(response.url&&response.url!==url)||!response.body)throw unavailable();
  const reader=response.body.getReader(),parts=[];let count=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>descriptor.size){await reader.cancel();throw unavailable();}parts.push(value);}}finally{reader.releaseLock();}
  if(count!==descriptor.size)throw unavailable();const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==descriptor.sha256)throw unavailable();return bytes;
 }
 async function load(id,{signal}={}){
  if(disposed)throw unavailable();const clip=map.assets.find(a=>a.id===id);if(!clip)throw unavailable();
  const controller=new AbortController();controllers.add(controller);let timer,finished=false;const onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)controller.abort();
  try{
   const work=(async()=>{const video=await verified(clip,controller.signal),captions=await verified(clip.captions,controller.signal);if(disposed||controller.signal.aborted||finished)throw unavailable();const videoURL=urls.createObjectURL(new Blob([video],{type:clip.type})),captionURL=urls.createObjectURL(new Blob([captions],{type:clip.captions.type}));live.add(videoURL);live.add(captionURL);return Object.freeze({videoURL,captionURL,duration:clip.duration,alt:clip.alt,captions:clip.captions,type:clip.type,release(){for(const url of[videoURL,captionURL])if(live.delete(url))urls.revokeObjectURL(url);}});})();
   const bounded=new Promise((_,reject)=>{timer=setTimeout(()=>{finished=true;controller.abort();reject(unavailable());},timeoutMs);});
   return await Promise.race([work,bounded]);
  }catch{throw unavailable();}finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controllers.delete(controller);}
 }
 return Object.freeze({load,dispose(){disposed=true;for(const controller of controllers)controller.abort();controllers.clear();for(const url of live)urls.revokeObjectURL(url);live.clear();}});
}
