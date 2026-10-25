// WordPress consumer for admitted cim.lesson-pack/v2 panes/v1 lessons (ADR 0061 step 7 Part C).
// PHP verified every pack file; the browser re-verifies the bytes it receives, then admits the
// lesson through the same boundary the Admin check uses. Media serving arrives in Part D, so
// Motion receives a verified-media service with no bindings and shows its standard fallback.
import {admitPanesLesson} from '../../src/multipane/admission.mjs';
import {mountComposedPlayer} from '../../src/multipane/composition.mjs';
import {createVerifiedMediaAccess} from '../../src/multipane/motion-media.mjs';
import {createPanesDriver} from './panes-driver.mjs';

export const PANES_AGREEMENT='cim.lesson-pack/v2';
export const MAX_PANES_JSON_BYTES=2*1024*1024;
const STYLESHEETS=['controls.css','composition.css','engineering.css','motion.css'];

export function isPanesRoot(root){return root?.getAttribute?.('data-cim-pack-agreement')===PANES_AGREEMENT;}

/** A stalled lesson or capture response ends in the static fallback instead of holding the page. */
export const PANES_FETCH_TIMEOUT_MS=15000;

/** Same-origin JSON whose bytes must equal the SHA-256 PHP projected into its URL, read within the deadline. */
export async function readVerifiedPackJSON(href,{baseURI,fetch,crypto=globalThis.crypto,signal,timeoutMs=PANES_FETCH_TIMEOUT_MS,setTimeout=globalThis.setTimeout,clearTimeout=globalThis.clearTimeout}){
 const base=new URL(baseURI),url=new URL(href,base),expected=url.searchParams.get('cim-sha256');
 if(!['http:','https:'].includes(url.protocol)||url.origin!==base.origin||!url.pathname.endsWith('.json')||!/^[a-f0-9]{64}$/.test(expected??''))throw new TypeError('Pack JSON must be a same-origin JSON URL carrying its SHA-256.');
 const controller=new AbortController();let reader=null,expire;
 const expired=new Promise((_,reject)=>{expire=()=>{const error=new Error('Pack JSON did not arrive within '+(timeoutMs/1000)+' seconds.');controller.abort(error);reject(error);reader?.cancel(error).catch(()=>{});};});
 expired.catch(()=>{});
 let timer=setTimeout(expire,timeoutMs);const stop=()=>expire();
 if(signal?.aborted)stop();else signal?.addEventListener?.('abort',stop,{once:true});
 const within=promise=>Promise.race([promise,expired]);
 try{
  const response=await within(fetch(url.href,{credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal}));
  if(!response.ok||response.redirected||!response.body)throw new TypeError('Pack JSON is unavailable.');
  if(Number(response.headers?.get?.('content-length'))>MAX_PANES_JSON_BYTES)throw new RangeError('Pack JSON exceeds 2 MiB.');
  reader=response.body.getReader();const parts=[];let count=0;
  try{for(;;){const {value,done}=await within(reader.read());if(done)break;count+=value.byteLength;if(count>MAX_PANES_JSON_BYTES){await reader.cancel();throw new RangeError('Pack JSON exceeds 2 MiB.');}parts.push(value);}}finally{try{reader.releaseLock();}catch{}}
  const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==expected)throw new TypeError('Pack JSON differs from its verified fingerprint.');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);signal?.removeEventListener?.('abort',stop);}
}

/** Fetch, verify and admit one panes root's lesson. Throws with the admission reason on refusal. */
export async function admitPanesRoot(root,{baseURI,fetch,identity,crypto,signal}){
 const lessonUrl=root.getAttribute('data-cim-pack-url'),captureUrl=root.getAttribute('data-cim-pack-capture-url');
 if(!lessonUrl||!captureUrl)throw new TypeError('Multi-pane lesson roots need lesson and capture URLs.');
 const [experience,capture]=await Promise.all([readVerifiedPackJSON(lessonUrl,{baseURI,fetch,crypto,signal}),readVerifiedPackJSON(captureUrl,{baseURI,fetch,crypto,signal})]);
 const admitted=admitPanesLesson({experience,capture,identity});
 if(admitted.experience.id!==root.getAttribute('data-cim-experience'))throw new TypeError('Lesson ID does not match its shortcode.');
 return admitted;
}

function ensureStylesheets(document,moduleUrl){
 for(const name of STYLESHEETS){
  const href=new URL('../../src/multipane/'+name,moduleUrl).href;
  if([...document.querySelectorAll('link[data-cim-panes-style]')].some(link=>link.href===href))continue;
  const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute('data-cim-panes-style','');document.head.append(link);
 }
}

/** Mount an admitted lesson in place of the root's static fallback. Returns a disposable player. */
/**
 * Stable, page-unique accessibility namespaces for panes roots, in document order.
 * A valid shortcode instance gives cim-<instance>, otherwise cim-panes-<ordinal>. Names that occur once
 * are reserved first; repeated names are then allocated in order against every name already taken, so
 * a generated suffix can never equal another root's final name.
 */
export function panesNamespaces(roots){
 const bases=roots.map((root,i)=>{const explicit=root.getAttribute('data-cim-instance');return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(explicit??'')?'cim-'+explicit:'cim-panes-'+(i+1);});
 const count=new Map();for(const base of bases)count.set(base,(count.get(base)??0)+1);
 const taken=new Set(bases.filter(base=>count.get(base)===1));
 return bases.map(base=>{
  if(count.get(base)===1)return base;
  let name=base,n=1;while(taken.has(name))name=base+'-'+(++n);
  taken.add(name);return name;
 });
}

export function mountPanesRoot(root,admitted,{document,location,reducedMotion,moduleUrl,instanceId}){
 ensureStylesheets(document,moduleUrl);
 const host=root.querySelector('[data-cim-renderer-root]')??root;
 const access=createVerifiedMediaAccess(admitted.media,{origin:location.origin,bindings:{}});
 const player=mountComposedPlayer({root:host,experience:admitted.experience,media:admitted.media,engineering:admitted.engineering,access,createDriver:createPanesDriver,reducedMotion,admission:admitted.token,instanceId});
 root.setAttribute('data-cim-state','ready');
 const applyFragment=fragment=>{if(typeof fragment==='string'&&fragment.startsWith('#cim/'))player.session.dispatch({type:'deepLink',fragment});};
 applyFragment(location.hash);
 return Object.freeze({applyFragment,dispose(){root.removeAttribute('data-cim-state');player.dispose();}});
}
