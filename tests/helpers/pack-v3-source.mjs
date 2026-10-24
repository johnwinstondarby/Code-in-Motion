import {mkdtemp,readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function packSource(){
 const folder=await mkdtemp(join(tmpdir(),'cim-pack-v3-'));
 const old=new URL('../../authoring/v3/fixtures/valid/run-custody/',import.meta.url);
 await cp(old,folder,{recursive:true});await mkdir(join(folder,'media'));await mkdir(join(folder,'captions'));
 const lesson=JSON.parse(await readFile(join(folder,'lesson.json'),'utf8'));
 lesson.media={status:'pack',file:'media.json',asset_ids:lesson.media.asset_ids};
 const assets=[];
 for(const id of lesson.media.asset_ids){
  const copies=[];
  for(const [extension,type,codec]of [['mp4','video/mp4','avc1.42c01e'],['webm','video/webm','vp8']]){
   const bytes=Buffer.from('Simulated '+id+' '+extension),captions=Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.200\nPlaceholder · simulated\n');
   const videoPath=`media/${id}.${extension}`,captionPath=`captions/${id}-${extension}.vtt`;
   await writeFile(join(folder,videoPath),bytes);await writeFile(join(folder,captionPath),captions);
   copies.push({source:{type:'pack',path:videoPath},sha256:hash(bytes),size:bytes.length,type,codec,duration:1.2,captions:{source:{type:'pack',path:captionPath},sha256:hash(captions),size:captions.length,type:'text/vtt',language:'en',label:'Placeholder · simulated'}});
  }
  assets.push({id,...copies[0],alt:'Placeholder · simulated GUI',webm:copies[1]});
 }
 const media={schema:'localis.cim/media/v1',status:'pack',placeholder:true,assets};
 await writeFile(join(folder,'lesson.json'),JSON.stringify(lesson));await writeFile(join(folder,'media.json'),JSON.stringify(media));
 return {folder,source:join(folder,'lesson.json'),lesson,media,async saveLesson(){await writeFile(join(folder,'lesson.json'),JSON.stringify(lesson));},async saveMedia(){await writeFile(join(folder,'media.json'),JSON.stringify(media));}};
}
