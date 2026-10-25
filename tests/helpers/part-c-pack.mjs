import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildV3Pack} from '../../authoring/v3/pack.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
let built;
// The real eight-beat placeholder pack, built through the Part B compiler.
export async function placeholderPack(){
 built??=buildV3Pack(resolve(root,'examples/packs/run-custody-placeholder/lesson.json'),await readFile(resolve(root,'LICENSE'),'utf8'));
 return built;
}
export async function compiledPlaceholder(){
 const pack=await placeholderPack();
 return {experience:JSON.parse(pack.entries.get('lesson.json').toString('utf8')),capture:JSON.parse(pack.entries.get('capture.json').toString('utf8')),manifest:pack.manifest,pack};
}
export async function installPack(directory,{entries}={}){
 const pack=await placeholderPack();
 for(const [path,bytes] of entries??pack.entries){const file=resolve(directory,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);}
 return pack;
}
