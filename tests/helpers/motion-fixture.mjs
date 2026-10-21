import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function motionFixture({format="webm"}={}){
 const base=new URL('../fixtures/motion/',import.meta.url),bytes=readFileSync(new URL('placeholder.'+format,base)),captions=readFileSync(new URL('placeholder.vtt',base));
 const sha=x=>createHash('sha256').update(x).digest('hex');
 const descriptor={id:'gpu-memory',source:{type:'pack',path:'media/placeholder.'+format},sha256:sha(bytes),size:bytes.length,type:format==='mp4'?'video/mp4':'video/webm',duration:1.2,alt:'Simulated GUI test pattern. No real lab activity is shown.',captions:{source:{type:'pack',path:'media/placeholder.vtt'},sha256:sha(captions),size:captions.length,type:'text/vtt',language:'en',label:'English'}};
 return {map:{schema:'localis.cim/media/v1',status:'fixture',placeholder:true,assets:[descriptor]},bytes,captions};
}
