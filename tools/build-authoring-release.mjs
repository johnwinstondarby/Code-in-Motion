import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createPortableArchive } from './lesson-pack-archive.mjs';
import { assertCleanReleaseCheckout, assertReleaseNodeVersion, readHeadFile } from './build-wordpress-release.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assertCleanReleaseCheckout();
assertReleaseNodeVersion(process.versions.node,(await readFile(resolve(root,'.nvmrc'),'utf8')).trim().replace(/^v/,''));
const version = JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const files = new Map();
async function visit(file) {
  if(files.has(file)) return;
  const text = readHeadFile(relative(root,file).replaceAll('\\','/'),'utf8'); files.set(file,text);
  for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
    if(match[1].startsWith('node:')) continue;
    if(!match[1].startsWith('.')) throw new Error('Authoring release must not need installed packages: '+match[1]);
    const dependency=resolve(dirname(file),match[1]);
    if(!dependency.startsWith(root+'/')&&!dependency.startsWith(root+'\\')) throw new Error('Dependency escapes repository.');
    await visit(dependency);
  }
}
await visit(resolve(root,'tools/cim-author.mjs'));
for (const file of ['LICENSE','.nvmrc','docs/INSTALL.md','docs/AUTHORING-GUIDE.md','docs/AUTHORING-JSON-v1.md','docs/AUTHORING-JSON-v2.md','experiences/starter/python-first-steps.authoring.json']) files.set(resolve(root,file),readHeadFile(file,'utf8'));
const zip = createPortableArchive([...files].map(([file,data])=>({path:'cim-authoring-'+version+'/'+relative(root,file).replaceAll('\\','/'),data})));
const name = 'cim-authoring-'+version+'.zip';
await mkdir(resolve(root,'dist'),{recursive:true});
await writeFile(resolve(root,'dist',name),zip);
const hash = createHash('sha256').update(zip).digest('hex');
await writeFile(resolve(root,'dist',name+'.sha256'),hash+'  '+name+'\n');
console.log(`Built ${name}: ${files.size} files, SHA-256 ${hash}`);
