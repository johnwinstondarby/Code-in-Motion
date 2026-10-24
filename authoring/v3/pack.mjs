import {constants} from 'node:fs';
import {consoleRendererInputViolations} from '../../src/renderers/subjects/console/validate-console-input.mjs';
import {open,realpath,stat,writeFile,cp,access} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {assertValid,validateBundle,validateDocument,canonicalJSON,safePath,V3ValidationError,LIMITS} from './validate.mjs';
import {decodeJSON} from './files.mjs';
import {proveEnvelope} from './prove-envelope.mjs';
import {validateProductionMedia} from './production-media.mjs';
import {createPortableArchive} from '../../tools/lesson-pack-archive.mjs';
export const PACK_LIMITS=Object.freeze({files:256,total:33554432});
const digest=data=>createHash('sha256').update(data).digest('hex');
const inside=(root,path)=>{const part=relative(root,path);return part!==''&&!isAbsolute(part)&&part!=='..'&&!part.startsWith('../')&&!part.startsWith('..\\');};
const fail=(id,path,message,fix)=>{throw new V3ValidationError([{id,path,fix,message:message+' Fix: '+fix}]);};
const pathFail=(path,message)=>fail('CIM-V3-PACK-PATH',path,message,'Use an existing regular file inside the declared source folder, without traversal, collisions or escaping symlinks.');
export async function readPackFile(root,path,{max=LIMITS.bytes,size,sha256,at='$'}={}){
 if(!safePath(path))pathFail(at,'Unsafe source path.');
 const requested=resolve(root,path);let resolved,handle;
 try{
  resolved=await realpath(requested);if(!inside(root,resolved))pathFail(at,'Resolved path escapes its declared folder.');
  if(!(await stat(resolved)).isFile())pathFail(at,'Expected a regular file before opening.');
  handle=await open(resolved,constants.O_RDONLY|(constants.O_NONBLOCK??0));const before=await handle.stat({bigint:true});
  if(!before.isFile())pathFail(at,'Expected a regular file.');
  if(before.size>BigInt(max))fail('CIM-V3-PACK-LIMIT',at,'File exceeds the byte limit.','Split the content into smaller files within the documented limits.');
  const bytes=Buffer.alloc(max+1);let count=0;
  while(count<bytes.length){const r=await handle.read(bytes,count,bytes.length-count,null);if(!r.bytesRead)break;count+=r.bytesRead;}
  if(count>max||size!==undefined&&count!==size)fail('CIM-V3-PACK-LIMIT',at,'File size differs from its bounded declaration.','Record the actual byte size and keep it within the file limit.');
  const after=await handle.stat({bigint:true}),currentPath=await realpath(requested),current=await stat(currentPath,{bigint:true});
  if(!inside(root,currentPath)||before.dev!==current.dev||before.ino!==current.ino||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs)pathFail(at,'File changed while it was being read.');
  const result=bytes.subarray(0,count);
  if(sha256!==undefined&&digest(result)!==sha256)fail('CIM-V3-PACK-FINGERPRINT',at,'File fingerprint differs from its declaration.','Restore the intended bytes or record their correct SHA-256 before packing.');
  return result;
 }catch(error){if(error instanceof V3ValidationError)throw error;pathFail(at,'Referenced file is missing or cannot be read safely.');}
 finally{await handle?.close();}
}
function json(bytes,path){try{return JSON.parse(decodeJSON(bytes,path));}catch(error){if(error instanceof V3ValidationError)throw error;fail('CIM-V3-PARSE',path,'Malformed JSON.','Use valid UTF-8 JSON with double quotes and no trailing comma.');}}
export async function compileV3Source(source){
 let root;try{root=await realpath(dirname(resolve(source)));}catch{pathFail('$source','Source folder does not exist.');}
 const lesson=json(await readPackFile(root,basename(source)), '$');assertValid(validateDocument(lesson,'authoring'));
 if(lesson.media.status!=='pack')fail('CIM-V3-PACK-MEDIA','$.media.status','This source has no production pack media map.','Use media.status pack and a media.json file; deferred sources remain validation-only.');
 const capture=json(await readPackFile(root,lesson.capture.file,{at:'$.capture.file'}),'$capture');
 const bundle=assertValid(validateBundle(lesson,capture));
 for(const[i,b]of lesson.beats.entries())for(const[j,a]of b.actions.entries())if(a.kind==='cli'){
  const input={transcript:[{beat:b.id,command:a.command,copy:a.command,output:a.output.map(text=>({text,tone:'normal'}))}],focus:[]};
  const violations=consoleRendererInputViolations(input,{title:'Placeholder CLI',prompt:'lab@inspire:~$'},null);
  if(violations.length)fail('CIM-V3-PACK-CONSOLE',`$.beats[${i}].actions[${j}]`,violations.map(v=>v.path+': '+v.message).join('; '),'Keep commands on one line without tabs and split output into separate lines. For no visible output, use an empty output line [""].');
 }
 const consoleIndex=lesson.panes.findIndex(p=>p.type==='console/v1'),initialLines=lesson.panes[consoleIndex].initial_state.lines;
 const initialInput={transcript:initialLines.length?[{beat:'initial',command:initialLines[0],copy:initialLines[0],output:initialLines.slice(1).map(text=>({text,tone:'normal'}))}]:[],focus:[]};
 if(consoleRendererInputViolations(initialInput,{title:'Placeholder CLI',prompt:'lab@inspire:~$'},null).length)fail('CIM-V3-PACK-CONSOLE',`$.panes[${consoleIndex}].initial_state.lines`,'Initial Console state cannot be rendered.','Use an empty starting array or single-line command/output entries matching the Console contract.');

 const media=json(await readPackFile(root,lesson.media.file,{at:'$.media.file'}),'$media');
 const diagnostics=validateProductionMedia(media);if(diagnostics.length)throw new V3ValidationError(diagnostics);
 assertValid(validateDocument(media,'media'));
 if(media.placeholder!==lesson.placeholder)fail('CIM-V3-PLACEHOLDER','$.media.placeholder','Lesson and media provenance disagree.','Keep placeholder mode consistent across the lesson, capture and media.');
 const ids=media.assets.map(a=>a.id).sort(),declared=[...lesson.media.asset_ids].sort(),used=[...new Set(lesson.beats.flatMap(b=>b.actions.filter(a=>a.kind==='gui').map(a=>a.asset)))].sort();
 if(canonicalJSON(ids)!==canonicalJSON(declared)||canonicalJSON(ids)!==canonicalJSON(used))fail('CIM-V3-CAPTURE-REFERENCE','$.media.asset_ids','Media IDs do not match the GUI actions.','Declare exactly the assets used by the lesson and provide each in media.json.');
 const files=new Map(),seen=new Set();let total=0;
 const add=(path,bytes)=>{if(!safePath(path))pathFail('$files','Unsafe payload path.');const folded=path.toLowerCase();if(seen.has(folded))pathFail('$files','Duplicate or case-colliding payload path.');seen.add(folded);total+=bytes.length;if(files.size>=PACK_LIMITS.files||total>PACK_LIMITS.total)fail('CIM-V3-PACK-LIMIT','$files','Payload exceeds the file-count or aggregate byte limit.','Use at most 256 payload files and 32 MiB total.');files.set(path,bytes);};
 let archiveRoot;try{archiveRoot=await realpath(resolve(root,capture.archive.root));}catch{pathFail('$capture.archive.root','Evidence archive is missing.');}
 if(!inside(root,archiveRoot))pathFail('$capture.archive.root','Evidence archive escapes the source folder.');
 let evidenceTotal=0;
 for(const[i,f]of capture.archive.files.entries()){
  const bytes=await readPackFile(archiveRoot,f.path,{max:LIMITS.evidenceBytes,sha256:f.sha256,at:`$capture.archive.files[${i}]`});evidenceTotal+=bytes.length;
  if(evidenceTotal>LIMITS.archiveBytes)fail('CIM-V3-LIMIT','$capture.archive','Evidence exceeds 16 MiB.','Split the capture archive within the existing evidence limits.');
  add('raw/'+f.path,bytes);
 }
 const mediaFiles=[];
 for(const[i,a]of media.assets.entries())for(const[d,path,caption]of [[a,`$media.assets[${i}]`,false],[a.captions,`$media.assets[${i}].captions`,true],...(a.webm?[[a.webm,`$media.assets[${i}].webm`,false],[a.webm.captions,`$media.assets[${i}].webm.captions`,true]]:[])]){
  if(d.source.type!=='pack'||!d.source.path.startsWith(caption?'captions/':'media/'))pathFail(path+'.source','Use the fixed media/ or captions/ payload folder.');
  const bytes=await readPackFile(root,d.source.path,{max:caption?65536:4194304,size:d.size,sha256:d.sha256,at:path});
  if(caption&&(!/^WEBVTT(?:\r?\n|$)/.test(decodeJSON(bytes,path))||media.placeholder&&!decodeJSON(bytes,path).includes('Placeholder · simulated')))fail('CIM-V3-PLACEHOLDER',path,'Captions must be WebVTT and disclose simulated content.','Start with WEBVTT and include Placeholder · simulated in placeholder captions.');
  add(d.source.path,bytes);mediaFiles.push({path:d.source.path,size:bytes.length,sha256:d.sha256,type:d.type,...(!caption?{codec:d.codec}:{}),confined:true});
 }
 const proof=proveEnvelope(lesson,capture);proof.document.renderer_config.media=structuredClone(media);const text=canonicalJSON(proof.document);
 if(Buffer.byteLength(text)>LIMITS.bytes)fail('CIM-V3-PACK-LIMIT','$compiled','Compiled lesson exceeds 2 MiB.','Split the lesson into smaller packs.');
 const packedCapture={...capture,archive:{...capture.archive,root:'raw'}};
 return{document:proof.document,text,bundle,media,capture:packedCapture,files,mediaFiles};
}
export async function buildV3Pack(source,license,{uploadLimit=null}={}){
 const compiled=await compileV3Source(source),id=compiled.document.id;
 if(['git-basic-cycle','git-repository-practice','synthetic-wordpress','python-first-steps'].includes(id))fail('CIM-V3-PACK-ID','$.id','Built-in lessons cannot be replaced.','Choose a unique lesson ID.');
 const entries=new Map(compiled.files),add=(path,data)=>{if(entries.has(path)||[...entries.keys()].some(p=>p.toLowerCase()===path.toLowerCase()))pathFail('$files','Generated payload path collides with authored content.');entries.set(path,Buffer.from(data));};
 const php=`<?php\n/**\n * Plugin Name: Code in Motion lesson - ${id}\n * Description: Companion multi-pane lesson data for Code in Motion.\n * Version: ${compiled.document.experience_version}\n * CiM Lesson Pack: cim.lesson-pack/v2\n * Requires at least: 6.5\n * Requires PHP: 7.4\n * License: GPLv3\n * License URI: https://www.gnu.org/licenses/gpl-3.0.html\n */\nif ( ! defined( 'ABSPATH' ) ) { exit; }\n`;
 add('lesson.json',compiled.text);add('capture.json',canonicalJSON(compiled.capture));add('lesson-pack.php',php);add('LICENSE',license);add('README.txt',`Requires Code in Motion 1.1.0 or later, below 2.0.0.\nUse [cim experience="${id}"].\nThis is explicitly simulated placeholder content, not lab evidence.\nMedia is pack-local. Media Library attachments arrive in 1.2.\nPack files remain separate from CiM upgrades and rollback.\n`);
 const files=[...entries].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,bytes])=>({path,size:bytes.length,sha256:digest(bytes)}));
 const manifest={schema:'cim.lesson-pack/v2',cim_min:'1.1.0',cim_max_exclusive:'2.0.0',placeholder:compiled.bundle.lesson.placeholder,lessons:[{id,file:'lesson.json',capture:'capture.json'}],media:compiled.media,files};assertValid(validateDocument(manifest,'pack'));
 add('cim-lesson-pack.json',canonicalJSON(manifest));
 const total=[...entries.values()].reduce((n,b)=>n+b.length,0);
 if(entries.size>PACK_LIMITS.files||total>PACK_LIMITS.total)fail('CIM-V3-PACK-LIMIT','$files','Pack payload exceeds its aggregate limit.','Use at most 256 files and 32 MiB total, including generated data.');
 const root='cim-lesson-'+id,zip=createPortableArchive([...entries].map(([path,data])=>({path:root+'/'+path,data}))),sha256=digest(zip);
 if(zip.length>PACK_LIMITS.total)fail('CIM-V3-PACK-LIMIT','$zip','Complete ZIP exceeds 32 MiB.','Reduce the complete pack, including ZIP headers and metadata.');
 if(uploadLimit!==null&&(!Number.isSafeInteger(uploadLimit)||uploadLimit<1))fail('CIM-V3-PACK-UPLOAD','$uploadLimit','Invalid target upload limit.','Supply the target host upload limit as a positive integer byte count.');
 if(uploadLimit!==null&&zip.length>uploadLimit)fail('CIM-V3-PACK-UPLOAD','$uploadLimit','The whole ZIP exceeds the target host upload limit.','Reduce the pack ZIP or increase the host limit; per-file media limits do not guarantee installation.');
 const preflight={zipBytes:zip.length,payloadBytes:total,files:entries.size,media:compiled.mediaFiles,mediaBytes:compiled.mediaFiles.reduce((n,f)=>n+f.size,0),limits:{videoBytes:4194304,captionBytes:65536,mediaBytes:16777216,packBytes:PACK_LIMITS.total},placeholder:manifest.placeholder,versionInterval:{min:manifest.cim_min,maxExclusive:manifest.cim_max_exclusive},uploadLimit,uploadMessage:uploadLimit===null?'Target host upload limit is unknown; passing per-file checks does not guarantee installation.':`ZIP fits the stated ${uploadLimit}-byte upload limit; host policy and admission still apply.`};
 return{id,zip,sha256,manifest,preflight,entries,compiled};
}
export async function writeV3Pack(source,output,{license,uploadLimit=null}={}){
 const result=await buildV3Pack(source,license,{uploadLimit});
 for(const path of [output,output+'.sha256']){try{await access(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}fail('CIM-V3-PACK-EXISTS','$output','Output or checksum already exists.','Choose a new output filename instead of overwriting an earlier pack.');}
 try{await writeFile(output,result.zip,{flag:'wx'});await writeFile(output+'.sha256',result.sha256+'  '+basename(output)+'\n',{flag:'wx'});}catch(error){fail(error.code==='EEXIST'?'CIM-V3-PACK-EXISTS':'CIM-V3-PACK-OUTPUT','$output','Cannot create a new pack output: '+error.code,'Use a new filename in an existing writable folder; never overwrite an earlier pack.');}return result;
}
export async function initV3Source(destination){
 try{await access(destination);}catch(error){if(error.code!=='ENOENT')throw error;await cp(new URL('../../examples/packs/run-custody-placeholder/',import.meta.url),destination,{recursive:true,errorOnExist:true,force:false});return;}
 fail('CIM-V3-PACK-EXISTS','$output','Destination already exists.','Choose a new folder for your v3 lesson.');
}
