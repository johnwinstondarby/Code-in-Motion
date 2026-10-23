import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

/** Preserve APT's authenticated suites/keys; change only the observed archive URI. */
export function rewriteSources(source) {
 if(typeof source!=='string')throw new TypeError('APT source text must be a string.');
 return source.replace(/^[ \t]*(?:URIs:[ \t]+|deb(?:-src)?[ \t]+)[^\r\n]*/gm,line=>{
  const at=line.indexOf('#'),content=at<0?line:line.slice(0,at),comment=at<0?'':line.slice(at);
  return content.replace(/https?:\/\/azure\.archive\.ubuntu\.com\/ubuntu(?=\/?(?:[ \t]|$))/g,'https://archive.ubuntu.com/ubuntu')+comment;
 });
}
async function main(){
 if(process.argv.length!==2)throw new Error('This CI helper takes no path or URL arguments.');
 let found=0,changed=0;
 for(const file of ['/etc/apt/sources.list.d/ubuntu.sources','/etc/apt/sources.list']){
  let before;try{before=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  found++;const after=rewriteSources(before);
  if(after!==before){await writeFile(file,after);changed++;}
 }
 if(!found)throw new Error('No standard Ubuntu APT source file found; refusing to guess another location.');
 console.log(`CI Ubuntu archive: ${changed} source file(s) changed; suites, components and signature settings preserved.`);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
