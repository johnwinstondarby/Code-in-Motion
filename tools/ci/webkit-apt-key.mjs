import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function dependencyPackages(source,frozen){
 if(frozen.playwright!=='1.63.0'||frozen.platform!=='ubuntu24.04-x64')throw new Error('Unsupported pinned package manifest.');
 const matches=[...source.matchAll(/"ubuntu24\.04-x64": \{/g)];if(matches.length!==1)throw new Error('Unknown Playwright dependency bundle layout.');
 const section=source.slice(matches[0].index),packages=[];
 for(const type of ['tools','webkit']){
  const match=new RegExp('\\b'+type+': \\[([\\s\\S]*?)\\]').exec(section);
  if(!match||!/^\s*(?:"[a-z0-9+.-]+"\s*,?\s*)+$/.test(match[1]))throw new Error('Unknown pinned '+type+' package list.');
  packages.push(...JSON.parse('['+match[1]+']'));
 }
 const unique=[...new Set(packages)].sort();if(JSON.stringify(unique)!==JSON.stringify(frozen.packages))throw new Error('Pinned WebKit packages drifted; review before caching.');return unique;
}
export function aptCacheKey({version,os,arch,imageOS,imageVersion,packages}){
 if(version!=='1.63.0'||os!=='Linux'||arch!=='X64'||imageOS!=='ubuntu24'||typeof imageVersion!=='string'||!/^[A-Za-z0-9._-]{1,100}$/.test(imageVersion))throw new Error('Unsupported or missing package-cache runner identity.');
 if(!Array.isArray(packages)||!packages.length||packages.some(p=>!/^[a-z0-9][a-z0-9+.-]*$/.test(p)))throw new Error('Invalid package names.');
 const hash=createHash('sha256').update(JSON.stringify([...new Set(packages)].sort())).digest('hex');return `webkit-apt-v1-playwright-${version}-${os}-${arch}-${imageOS}-${imageVersion}-${hash}`;
}
async function main(){
 if(process.argv.length!==2)throw new Error('No command arguments accepted.');
 const version=JSON.parse(await readFile(new URL('../../node_modules/playwright-core/package.json',import.meta.url),'utf8')).version;
 const frozen=JSON.parse(await readFile(new URL('./webkit-apt-packages.json',import.meta.url),'utf8'));
 const packages=dependencyPackages(await readFile(new URL('../../node_modules/playwright-core/lib/coreBundle.js',import.meta.url),'utf8'),frozen);
 const key=aptCacheKey({version,os:process.env.RUNNER_OS,arch:process.env.RUNNER_ARCH,imageOS:process.env.ImageOS,imageVersion:process.env.ImageVersion,packages});
 if(!process.env.RUNNER_TEMP||!process.env.GITHUB_OUTPUT)throw new Error('CI output paths are required.');
 const stage=resolve(process.env.RUNNER_TEMP,'cim-webkit-debs'),evidence=resolve(process.env.RUNNER_TEMP,'cim-webkit-install');
 await mkdir(stage,{recursive:true});await mkdir(evidence,{recursive:true});
 await appendFile(process.env.GITHUB_OUTPUT,`key=${key}\nstage=${stage}\n`);
 await writeFile(resolve(evidence,'apt-cache-key.json'),JSON.stringify({key,stage,packages,platform:frozen.platform},null,2)+'\n');console.log('APT archive cache key: '+key+'; direct packages='+packages.length);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
