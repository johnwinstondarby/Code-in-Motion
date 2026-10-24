import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCleanReleaseCheckout,assertReleaseNodeVersion} from './build-wordpress-release.mjs';
import {buildV3Pack} from '../authoring/v3/pack.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');assertCleanReleaseCheckout();assertReleaseNodeVersion(process.versions.node,(await readFile(resolve(root,'.nvmrc'),'utf8')).trim());
const result=await buildV3Pack(resolve(root,'examples/packs/run-custody-placeholder/lesson.json'),await readFile(resolve(root,'LICENSE'),'utf8'));const name='cim-lesson-'+result.id+'.zip';await mkdir(resolve(root,'dist'),{recursive:true});await writeFile(resolve(root,'dist',name),result.zip);await writeFile(resolve(root,'dist',name+'.sha256'),result.sha256+'  '+name+'\n');await writeFile(resolve(root,'dist',name+'.preflight.json'),JSON.stringify(result.preflight,null,2)+'\n');console.log(`Built ${name}: ${result.zip.length} bytes, SHA-256 ${result.sha256}`);
