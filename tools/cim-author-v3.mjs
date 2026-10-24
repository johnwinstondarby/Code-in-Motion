import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readBoundedFile,decodeJSON} from '../authoring/v3/files.mjs';
import {compileV3Source,writeV3Pack,initV3Source} from '../authoring/v3/pack.mjs';
import {V3ValidationError} from '../authoring/v3/validate.mjs';
import {startV3Preview} from './pack-preview-server.mjs';
const fail=(path,message,fix)=>{throw new V3ValidationError([{id:'CIM-V3-COMMAND',path,fix,message:message+' Fix: '+fix}]);};
export async function tryV3Command(args){
 const[command,source,...rest]=args;
 if(command==='init'&&source&&rest.length===2&&rest[0]==='--format'&&rest[1]==='v3'){
  await initV3Source(resolve(source));console.log('Created v3 lesson source: '+source+'/lesson.json. Edit its ID, explanations and media, then validate and preview.');return true;
 }
 if(!['validate','compile','pack','preview'].includes(command)||!source)return false;
 let doc;try{doc=JSON.parse(decodeJSON(await readBoundedFile(resolve(source))));}catch{return false;}
 if(doc?.schema!=='localis.cim/authoring/v3'||doc?.media?.status!=='pack')return false;
 const options={};for(let i=0;i<rest.length;i+=2){const key=rest[i],value=rest[i+1],allowed=command==='preview'?['--port']:command==='pack'?['--out','--upload-limit']:command==='compile'?['--out']:[];if(!allowed.includes(key)||!value||Object.hasOwn(options,key))fail('$command','Invalid or repeated option.','Use compile --out FILE, pack --out FILE [--upload-limit BYTES], or preview --port PORT.');options[key]=value;}
 if(command==='preview'){
  const port=options['--port']===undefined?0:Number(options['--port']);if(!Number.isInteger(port)||port<0||port>65535)fail('$command.port','Invalid port.','Use an integer from 0 through 65535.');
  const{url}=await startV3Preview(resolve(source),{port});console.log('Open '+url+' (1.1.0-dev local preview). Save JSON and refresh; Ctrl+C stops preview.');return true;
 }
 if(command==='pack'){
  const license=await readFile(new URL('../LICENSE',import.meta.url),'utf8'),uploadLimit=options['--upload-limit']===undefined?null:Number(options['--upload-limit']);
  const output=resolve(options['--out']??'cim-lesson-'+doc.id+'.zip'),result=await writeV3Pack(resolve(source),output,{license,uploadLimit});
  console.log('Preflight:\n'+JSON.stringify(result.preflight,null,2)+'\nCreated '+output+'\nSHA-256 '+result.sha256+'\nRequires CiM 1.1.0 or later below 2.0.0; not admitted by 1.0.1.');return true;
 }
 const result=await compileV3Source(resolve(source));
 if(command==='validate'){console.log('Valid: '+result.document.id+' ('+result.document.steps.length+' beats; v3 pack-local authoring).');return true;}
 if(!options['--out'])fail('$command.out','Missing compile output.','Use compile lesson.json --out compiled.json.');
 try{await writeFile(resolve(options['--out']),result.text,{flag:'wx'});}catch(error){fail('$command.out','Cannot create a new compiled output: '+error.code,'Choose a new filename in an existing folder; never overwrite an earlier build.');}
 return true;
}
