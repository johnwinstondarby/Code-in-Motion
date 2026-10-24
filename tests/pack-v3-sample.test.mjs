import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {compileV3Source,buildV3Pack} from '../authoring/v3/pack.mjs';
import {diagramSnapshot,diagramGeometry} from '../src/multipane/engineering.mjs';
import {hash} from './helpers/pack-v3-source.mjs';
const source=resolve('examples/packs/run-custody-placeholder/lesson.json');
const cli=args=>spawnSync(process.execPath,['tools/cim-author.mjs',...args],{encoding:'utf8'});
async function sample(){let c;await assert.doesNotReject(async()=>{c=await compileV3Source(source);});return c;}
test('[PB-15] sample has the eight agreed beats, separate custody/reproduction and at most one transfer',async()=>{
 const c=await sample(),l=c.bundle.lesson,r=c.bundle.capture;assert.equal(l.beats.length,8);assert.deepEqual(l.beats.filter(b=>b.actions.some(a=>a.kind==='gui')).map(b=>b.id),['submit-fail','track-mlflow']);assert.equal(l.beats[4].actions.length,0);
 for(const b of l.beats){assert(b.explanation.text);assert(b.engineering.records.length);const records=r.records.filter(r=>b.engineering.records.includes(r.id));assert(records.filter(r=>r.from!==null&&r.from!==r.service).length<=1);assert(records.every(r=>r.provenance==='placeholder'));}
 assert(r.records.filter(r=>r.beat==='prove-custody').every(r=>r.host==='invent'&&r.action==='verify'));assert(r.records.filter(r=>r.beat==='reproduce').every(r=>r.host==='inspire'&&r.action==='evaluate'));
 const config={fixtureOnly:true,placeholder:true,hosts:l.hosts,services:l.services,artifacts:l.artifacts,initial:l.panes.find(p=>p.type==='diagram/v1').initial_state,archive:r.archive,records:r.records,evidence:r.archive.files,beats:l.beats.map((b,i)=>({id:b.id,records:b.engineering.records,state:c.bundle.states[i]}))};
 for(const b of config.beats){const g=diagramGeometry(diagramSnapshot(config,b.id));assert.equal(g.mode,'graph',b.id+': '+g.reason);assert(g.edges.length<=1);}
});
test('[PB-16] committed video/caption bytes have truthful codecs, fingerprints and simulation labels',async()=>{
 const c=await sample();assert.equal(c.media.assets.length,2);
 for(const a of c.media.assets)for(const d of [a,a.webm]){
  const bytes=await readFile(resolve(source,'..',d.source.path));assert.equal(hash(bytes),d.sha256);assert.equal(bytes.length,d.size);
  if(d.type==='video/mp4'){const i=bytes.indexOf(Buffer.from('avcC'));assert(i>0);assert.equal(d.codec,'avc1.'+bytes.subarray(i+5,i+8).toString('hex'));}else{assert(bytes.includes(Buffer.from('V_VP8')));assert.equal(d.codec,'vp8');}
  const vtt=await readFile(resolve(source,'..',d.captions.source.path));assert.equal(hash(vtt),d.captions.sha256);assert.match(vtt.toString(),/Placeholder · simulated/);
 }
});
test('[PB-17] v3 init, validate, compile and pack work through the public CLI without overwriting',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'cim-v3-cli-')),dest=join(folder,'source');let r=cli(['init',dest,'--format','v3']);assert.equal(r.status,0,r.stdout+r.stderr);
 const path=join(dest,'lesson.json'),doc=JSON.parse(await readFile(path));doc.title='An author edit to preview and compile';await writeFile(path,JSON.stringify(doc));
 r=cli(['validate',path]);assert.equal(r.status,0,r.stdout+r.stderr);r=cli(['compile',path,'--out',join(folder,'compiled.json')]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(await readFile(join(folder,'compiled.json'))).presentation.title,doc.title);
 r=cli(['pack',path,'--out',join(folder,'pack.zip')]);assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/zipBytes/);assert.match(r.stdout,/1\.1\.0/);assert.match(r.stdout,/unknown/i);assert.match(await readFile(join(folder,'pack.zip.sha256'),'utf8'),/^[a-f0-9]{64}  pack.zip\n$/);
 r=cli(['init',dest,'--format','v3']);assert.notEqual(r.status,0);assert.match(r.stderr,/CIM-V3-PACK-EXISTS/);
});
test('[PB-18] CLI errors expose rule, JSON path and teacher fix including attachment deferral',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'cim-v3-errors-'));const r=cli(['init',join(folder,'source'),'--format','v3']);assert.equal(r.status,0,r.stdout+r.stderr);const path=join(folder,'source','media.json'),map=JSON.parse(await readFile(path));map.assets[0].source={type:'attachment',id:4};delete map.assets[1].codec;await writeFile(path,JSON.stringify(map));
 const out=cli(['validate',join(folder,'source','lesson.json')]);assert.notEqual(out.status,0);assert.match(out.stderr,/CIM-V3-MEDIA-ATTACHMENT/);assert.match(out.stderr,/1\.2/);assert.match(out.stderr,/\$.*assets\[0\].source/);assert.match(out.stderr,/CIM-V3-MEDIA-CODEC/);assert.match(out.stderr,/Fix:/);
});

test('[PB-24] visible sample text separates INVENT custody from INSPIRE reproduction',async()=>{const c=await sample(),l=c.bundle.lesson;assert.match(l.beats[6].explanation.text,/INVENT/);assert.match(l.beats[6].actions[0].command,/INVENT/);assert.match(l.beats[7].explanation.text,/INSPIRE/);assert.match(l.beats[7].actions[0].command,/INSPIRE/);});
