import {validateMediaMap} from '../../src/multipane/media-map.mjs';
const diagnostic=(id,path,message,fix)=>({id,path,fix,message:message+' Fix: '+fix});
export function projectPreviewMedia(map){
 const copy=structuredClone(map);copy.status='fixture';
 for(const a of copy.assets??[]){delete a.codec;if(a.webm)delete a.webm.codec;}
 return copy;
}
export function validateProductionMedia(map){
 if(!map||map.status!=='pack')return[diagnostic('CIM-V3-MEDIA-PACK','$','Expected a production pack media map.','Use media.status pack and the documented closed fields.')];
 const errors=[];
 for(const [i,a]of (Array.isArray(map.assets)?map.assets:[]).entries()){
  const path=`$.assets[${i}]`;
  for(const[d,p,video]of [[a,path,true],[a?.captions,path+'.captions',false],...(a?.webm?[[a.webm,path+'.webm',true],[a.webm.captions,path+'.webm.captions',false]]:[])]){
   if(d?.source?.type==='attachment')errors.push(diagnostic('CIM-V3-MEDIA-ATTACHMENT',p+'.source','Media Library attachments are not supported in 1.1.0.','Use a pack-local file; attachment sources arrive in 1.2.'));
   if(video){
    const codec=d?.codec,mp4=typeof codec==='string'&&/^(?:avc[13]\.[0-9A-Fa-f]{6}|(?:hev1|hvc1|av01)\.[A-Za-z0-9.]{1,72})$/.test(codec),webm=typeof codec==='string'&&/^(?:vp8(?:\.0)?|vp09\.[0-9.]{5,72}|av01\.[A-Za-z0-9.]{1,72})$/.test(codec);
    if(typeof codec!=='string'||codec.length>80||!(d?.type==='video/mp4'?mp4:d?.type==='video/webm'&&webm))errors.push(diagnostic('CIM-V3-MEDIA-CODEC',p+'.codec','Missing or incompatible codec declaration.','Declare the exact encoded codec for this copy, such as avc1.42c01e for MP4 or vp8 for WebM.'));
   }
  }
  if(map.placeholder&&/Recorded in the lab/i.test([a?.alt,a?.captions?.label,a?.webm?.captions?.label].join(' ')))errors.push(diagnostic('CIM-V3-PLACEHOLDER',path,'Placeholder media claims genuine capture.','Use Placeholder · simulated labels and alternatives.'));
 }
 let projected;try{projected=projectPreviewMedia(map);}catch{return[diagnostic('CIM-V3-MEDIA-PACK','$','Media must contain plain JSON data.','Use the documented pack media-map fields.')];}
 errors.push(...validateMediaMap(projected).map(d=>d.id==='CIM-MEDIA-SOURCE'?diagnostic(d.id,d.path,'Unsafe pack media path.','Use a confined pack-relative filename without traversal; attachments arrive in 1.2.'):d));
 return errors;
}
