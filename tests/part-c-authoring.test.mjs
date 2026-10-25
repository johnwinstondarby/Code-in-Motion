import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildV3Pack} from '../authoring/v3/pack.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

// Review round 2: the 1.1.0 Player's pane-ID restriction is explained when the pack is built,
// so a teacher never builds a pack that is refused only after installation.
test('[PC-16] packing refuses non-standard pane IDs with the reason, before any ZIP exists',async t=>{
 const work=await mkdtemp(resolve(root,'../part-c-authoring-'));t.after(()=>rm(work,{recursive:true,force:true}));
 const pack=join(work,'pack');await cp(resolve(root,'examples/packs/run-custody-placeholder'),pack,{recursive:true});
 const lesson=join(pack,'lesson.json');await writeFile(lesson,(await readFile(lesson,'utf8')).replaceAll('"console"','"cli"'));
 const license=await readFile(resolve(root,'LICENSE'),'utf8');
 let error;try{await buildV3Pack(lesson,license);}catch(e){error=e;}
 assert.ok(error,'the pack must not be built');
 const text=JSON.stringify(error.diagnostics??[])+String(error.message);
 assert.match(text,/CIM-V3-PANE-ID/);
 assert.match(text,/console, motion, explanation and engineering/);
 const cli=spawnSync(process.execPath,['tools/cim-author.mjs','validate',join(root,'authoring/v3/fixtures/invalid/pane-id.json')],{cwd:root,encoding:'utf8'});
 assert.notEqual(cli.status,0);
 assert.match(cli.stdout+cli.stderr,/CIM-V3-PANE-ID/);
 assert.match(cli.stdout+cli.stderr,/Fix:.*console, motion, explanation and engineering/);
});
