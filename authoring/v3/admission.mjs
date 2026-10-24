import {validateDocument} from './validate.mjs';
const capabilities=new WeakSet();
export function createDevelopmentAdmission(purpose){
 if(!['authoring-preview','admission-test'].includes(purpose))throw new TypeError('Development admission is restricted to local authoring preview and admission tests.');
 const identity=Object.freeze({version:'1.1.0-dev',channel:'development',purpose});capabilities.add(identity);return identity;
}
const release=v=>typeof v==='string'&&/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(v)&&v.split('.').every(n=>Number.isSafeInteger(Number(n)));
const compare=(a,b)=>{for(let i=0;i<3;i++){const n=Number(a.split('.')[i])-Number(b.split('.')[i]);if(n)return n;}return 0;};
export function admitV3Pack(manifest,host){
 if(validateDocument(manifest,'pack').diagnostics.length||manifest.media.status!=='pack')return false;
 // The numeric interval is never widened. Only a deliberately issued in-process
 // development identity substitutes its exact tested target, never a pack flag.
 const version=typeof host==='object'&&host!==null&&capabilities.has(host)?'1.1.0':host;
 return release(version)&&compare(version,manifest.cim_min)>=0&&compare(version,manifest.cim_max_exclusive)<0;
}
