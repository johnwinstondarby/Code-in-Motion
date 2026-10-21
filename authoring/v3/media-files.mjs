import {open,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {validateMediaMap} from '../../src/multipane/media-map.mjs';
const reject=(id,path,message)=>{const error=new Error(`${id} at ${path}: ${message} Fix: use a confined pack file with its exact declared size and SHA-256.`);error.rule=id;throw error;};
const inside=(root,path)=>{const part=relative(root,path);return part!==''&&!isAbsolute(part)&&part!=='..'&&!part.startsWith('../')&&!part.startsWith('..\\');};
export async function validateMediaFiles(map,directory){
 const diagnostics=validateMediaMap(map);if(diagnostics.length)throw new Error(diagnostics[0].id+' at '+diagnostics[0].path+': '+diagnostics[0].message);
 const root=await realpath(directory);
 for(const[i,clip]of map.assets.entries())for(const[descriptor,path]of [[clip,`$.assets[${i}]`],[clip.captions,`$.assets[${i}].captions`],...(clip.webm?[[clip.webm,`$.assets[${i}].webm`],[clip.webm.captions,`$.assets[${i}].webm.captions`]]:[])]){
  if(descriptor.source.type==='attachment')continue; // Site access/attachment validation is deliberately deferred.
  const requested=resolve(root,descriptor.source.path);let file;try{file=await realpath(requested);}catch{reject('CIM-MEDIA-SOURCE',path+'.source','Media file is missing.');}
  if(!inside(root,file))reject('CIM-MEDIA-SOURCE',path+'.source','Resolved media link escapes the pack.');
  const handle=await open(file,'r');
  try{
   const before=await handle.stat(),resolved=await realpath(requested),current=await stat(resolved);
   if(!inside(root,resolved)||!before.isFile()||before.dev!==current.dev||before.ino!==current.ino)reject('CIM-MEDIA-SOURCE',path+'.source','Media path changed or is not a confined regular file.');
   if(before.size!==descriptor.size)reject('CIM-MEDIA-LIMIT',path+'.size','Actual file size differs from the declared bounded size.');
   const bytes=Buffer.alloc(descriptor.size+1);let count=0;
   while(count<bytes.length){const result=await handle.read(bytes,count,bytes.length-count,null);if(!result.bytesRead)break;count+=result.bytesRead;}
   if(count!==descriptor.size)reject('CIM-MEDIA-LIMIT',path+'.size','File changed size while reading.');
   if(createHash('sha256').update(bytes.subarray(0,count)).digest('hex')!==descriptor.sha256)reject('CIM-MEDIA-FINGERPRINT',path+'.sha256','Actual media bytes do not match the recorded fingerprint.');
  }finally{await handle.close();}
 }
}
