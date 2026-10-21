export const MEDIA_LIMITS=Object.freeze({clip:4194304,captions:65536,total:16777216,count:32,duration:30});
const fixes={SOURCE:'Use a pack-relative filename without traversal or a positive integer attachment ID; never a URL.',TYPE:'Use video/webm or video/mp4 for a clip and text/vtt for captions.',FINGERPRINT:'Record the exact 64-character lowercase SHA-256 digest.',CAPTIONS:'Provide a captions descriptor with source, digest, byte size, text/vtt type, language and label.',LIMIT:'Use at most 32 clips, 4 MiB per clip, 64 KiB per caption track, 16 MiB total, and 30 seconds per clip.',DURATION:'Keep the MP4 and WebM durations within 0.2 seconds.',SHAPE:'Use the documented closed fixture media-map fields and distinct lowercase clip IDs.'};
export function validateMediaMap(map){
 const diagnostics=[],reject=(rule,path,message)=>diagnostics.push({id:'CIM-MEDIA-'+rule,path,fix:fixes[rule],message:message+' Fix: '+fixes[rule]});
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const keys=(x,list)=>object(x)&&Object.keys(x).every(k=>list.includes(k));
 const source=(s,path)=>{if(!object(s)||!(s.type==='pack'&&keys(s,['type','path'])&&typeof s.path==='string'&&s.path.length<=200&&/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+$/.test(s.path)||s.type==='attachment'&&keys(s,['type','id'])&&Number.isSafeInteger(s.id)&&s.id>0))reject('SOURCE',path,'Invalid media source.');};
 const descriptor=(d,path,caption=false)=>{
  if(!object(d)){reject(caption?'CAPTIONS':'SHAPE',path,'Missing media descriptor.');return 0;}
  source(d.source,path+'.source');
  if(typeof d.sha256!=='string'||!/^[a-f0-9]{64}$/.test(d.sha256))reject('FINGERPRINT',path+'.sha256','Missing or invalid fingerprint.');
  if(!Number.isSafeInteger(d.size)||d.size<=0||d.size>(caption?MEDIA_LIMITS.captions:MEDIA_LIMITS.clip))reject('LIMIT',path+'.size','Invalid media byte size.');
  if(!(caption?d.type==='text/vtt':['video/webm','video/mp4'].includes(d.type)))reject('TYPE',path+'.type','Unsupported media type.');
  if(caption){if(!keys(d,['source','sha256','size','type','language','label'])||typeof d.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(d.language)||typeof d.label!=='string'||!d.label.trim()||[...d.label].length>100)reject('CAPTIONS',path,'Invalid caption language, label or fields.');}
  else if(!keys(d,['id','source','sha256','size','type','duration','alt','captions','webm'])||typeof d.alt!=='string'||!d.alt.trim()||[...d.alt].length>4000)reject('SHAPE',path,'Invalid clip fields or text alternative.');
  return Number.isSafeInteger(d.size)&&d.size>0?d.size:0;
 };
 if(!keys(map,['schema','status','placeholder','assets'])||map.schema!=='localis.cim/media/v1'||map.status!=='fixture'||typeof map.placeholder!=='boolean'||!Array.isArray(map.assets)){reject('SHAPE','$','Expected a fixture-only media map.');return diagnostics;}
 if(map.assets.length<1||map.assets.length>MEDIA_LIMITS.count)reject('LIMIT','$.assets','Invalid clip count.');
 let total=0;const ids=new Set();
 for(const[dIndex,d]of map.assets.slice(0,MEDIA_LIMITS.count).entries()){
  const path=`$.assets[${dIndex}]`;total+=descriptor(d,path);
  if(!object(d))continue;
  if(typeof d.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.id)||d.id.length>100||ids.has(d.id))reject('SHAPE',path+'.id','Invalid or duplicate clip ID.');ids.add(d.id);
  if(!Number.isFinite(d.duration)||d.duration<0.001||d.duration>MEDIA_LIMITS.duration)reject('LIMIT',path+'.duration','Invalid clip duration.');
  total+=descriptor(d.captions,path+'.captions',true);
  if(d.webm!==undefined){
   const w=d.webm;total+=descriptor({...w,alt:d.alt},path+'.webm');
   if(!keys(w,['source','sha256','size','type','duration','captions'])||d.type!=='video/mp4'||w?.type!=='video/webm')reject('SHAPE',path+'.webm','A WebM alternative requires a primary MP4 and its own closed descriptor.');
   if(!Number.isFinite(w?.duration)||w.duration<0.001||w.duration>MEDIA_LIMITS.duration)reject('LIMIT',path+'.webm.duration','Invalid WebM duration.');
   else if(Math.abs(d.duration-w.duration)>0.2)reject('DURATION',path+'.webm.duration','Copy durations disagree.');
   total+=descriptor(w?.captions,path+'.webm.captions',true);
  }
 }
 if(total>MEDIA_LIMITS.total)reject('LIMIT','$.assets','Media map exceeds total byte limit.');
 return diagnostics;
}
