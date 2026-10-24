import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {buildV3Pack,compileV3Source,writeV3Pack} from '../authoring/v3/pack.mjs';
import {createDevelopmentAdmission,admitV3Pack} from '../authoring/v3/admission.mjs';
import {validateProductionMedia} from '../authoring/v3/production-media.mjs';
import {validateExperience} from '../src/experience/validate-experience.mjs';
import {packSource,hash} from './helpers/pack-v3-source.mjs';
const license='GPLv3 test license\n';
const rejects=(promise,id)=>assert.rejects(promise,error=>{assert(error.diagnostics?.some(d=>d.id===id&&typeof d.path==='string'&&/Fix:/.test(d.message)),JSON.stringify(error.diagnostics));return true;});

test('[PB-01] production pack compiles deterministically into the unchanged v2 envelope',async()=>{
 const s=await packSource();let a;await assert.doesNotReject(async()=>{a=await compileV3Source(s.source);});
 assert.deepEqual(validateExperience(a.document),[]);assert.equal(a.document.steps.length,8);assert.equal(a.document.renderer_config.media.status,'pack');assert.equal(a.text,(await compileV3Source(s.source)).text);
});
test('[PB-02] production media has two independently fingerprinted captioned codec copies',async()=>{
 const s=await packSource();assert.deepEqual(validateProductionMedia(s.media),[]);
 for(const c of s.media.assets){assert(c.codec);assert(c.webm.codec);assert.notEqual(c.captions.source.path,c.webm.captions.source.path);}
});
for(const [id,change,rule]of [
 ['PB-03',s=>{delete s.lesson.placeholder;},'CIM-V3-PLACEHOLDER'],
 ['PB-04',s=>{s.lesson.beats[2].actions[0].label='Recorded in the lab';},'CIM-V3-PLACEHOLDER'],
 ['PB-05',s=>{s.lesson.beats[2].engineering.records=['missing-record'];},'CIM-V3-CAPTURE-REFERENCE']
])test(`[${id}] pack rejects altered provenance or capture references`,async()=>{const s=await packSource();change(s);await s.saveLesson();await rejects(buildV3Pack(s.source,license),rule);});
test('[PB-06] changed media bytes cannot enter a pack',async()=>{const s=await packSource();await writeFile(join(s.folder,s.media.assets[0].source.path),Buffer.alloc(s.media.assets[0].size));await rejects(buildV3Pack(s.source,license),'CIM-V3-PACK-FINGERPRINT');});
test('[PB-07] each copy requires its own codec and correct MIME pairing',async()=>{
 const s=await packSource();for(const copy of ['primary','webm']){const m=structuredClone(s.media),d=copy==='primary'?m.assets[0]:m.assets[0].webm;delete d.codec;const errors=validateProductionMedia(m);assert(errors.some(e=>e.id==='CIM-V3-MEDIA-CODEC'&&e.path.endsWith('.codec')));}
 const m=structuredClone(s.media);m.assets[0].codec='vp8';assert(validateProductionMedia(m).some(e=>e.id==='CIM-V3-MEDIA-CODEC'));
});
test('[PB-08] every attachment source is refused with a 1.2 diagnostic',async()=>{
 const s=await packSource();for(const key of ['primary','caption','webm','webm-caption']){const m=structuredClone(s.media),a=m.assets[0],d={primary:a,caption:a.captions,webm:a.webm,'webm-caption':a.webm.captions}[key];d.source={type:'attachment',id:12};const errors=validateProductionMedia(m);assert(errors.some(e=>e.id==='CIM-V3-MEDIA-ATTACHMENT'&&/1\.2/.test(e.message)&&e.path.endsWith('.source')));}
});
test('[PB-09] traversal and escaping links cannot enter a pack',async()=>{
 const s=await packSource();s.media.assets[0].source.path='../outside.mp4';await s.saveMedia();await assert.rejects(buildV3Pack(s.source,license),e=>{assert(e.diagnostics?.some(d=>/PATH|SOURCE/.test(d.id)));return true;});
 const t=await packSource(),u=await packSource();const path=join(t.folder,'media','outside.mp4');await symlink(join(u.folder,u.media.assets[0].source.path),path);t.media.assets[0].source.path='media/outside.mp4';await t.saveMedia();await rejects(buildV3Pack(t.source,license),'CIM-V3-PACK-PATH');
});
test('[PB-10] an explicit branded development identity is required; no prerelease coercion',async()=>{
 const s=await packSource(),m=(await buildV3Pack(s.source,license)).manifest;assert.equal(admitV3Pack(m,'1.0.1'),false);assert.equal(admitV3Pack(m,'1.1.0-dev'),false);assert.equal(admitV3Pack(m,{version:'1.1.0-dev',channel:'development',purpose:'authoring-preview'}),false);
 const token=createDevelopmentAdmission('authoring-preview');assert.equal(token.version,'1.1.0-dev');assert.equal(admitV3Pack(m,token),true);assert.equal(admitV3Pack(m,'1.1.0'),true);assert.equal(admitV3Pack(m,'2.0.0'),false);
 assert.equal(admitV3Pack({...m,cim_min:'1.0.1'},token),false);assert.throws(()=>createDevelopmentAdmission('production'));
});
test('[PB-11] manifest lists every payload with its actual bounded size and digest',async()=>{
 const s=await packSource(),r=await buildV3Pack(s.source,license);assert.equal(r.manifest.cim_min,'1.1.0');assert.equal(r.manifest.cim_max_exclusive,'2.0.0');
 const payload=[...r.entries.keys()].filter(k=>k!=='cim-lesson-pack.json').sort();assert.deepEqual(r.manifest.files.map(f=>f.path).sort(),payload);
 for(const f of r.manifest.files){assert.equal(f.size,r.entries.get(f.path).length);assert.equal(f.sha256,hash(r.entries.get(f.path)));}
 assert.deepEqual(r.manifest.media,r.compiled.document.renderer_config.media);
 const php=r.entries.get('lesson-pack.php').toString();assert.match(php,/cim.lesson-pack\/v2/);assert.doesNotMatch(php,/add_filter|add_action|register/);
});
test('[PB-12] ZIP bytes and fixed metadata reproduce independent of source mtimes',async()=>{
 const a=await packSource(),b=await packSource(),x=await buildV3Pack(a.source,license),y=await buildV3Pack(b.source,license);assert.deepEqual(x.zip,y.zip);assert.equal(x.sha256,hash(x.zip));
 let offset=0,count=0;while(x.zip.readUInt32LE(offset)===0x04034b50){assert.equal(x.zip.readUInt16LE(offset+8),0);assert.equal(x.zip.readUInt16LE(offset+10),0);assert.equal(x.zip.readUInt16LE(offset+12),33);assert.equal(x.zip.readUInt16LE(offset+28),0);offset+=30+x.zip.readUInt16LE(offset+26)+x.zip.readUInt32LE(offset+18);count++;}assert.equal(count,x.entries.size);
});
test('[PB-13] preflight reports whole ZIP and media limits and blocks a known host limit',async()=>{
 const s=await packSource(),r=await buildV3Pack(s.source,license);assert.equal(r.preflight.zipBytes,r.zip.length);assert.equal(r.preflight.uploadLimit,null);assert.match(r.preflight.uploadMessage,/unknown/i);assert.equal(r.preflight.media.length,8);assert(r.preflight.media.every(f=>f.sha256&&f.confined));assert.equal(r.preflight.placeholder,true);
 await rejects(buildV3Pack(s.source,license,{uploadLimit:10}),'CIM-V3-PACK-UPLOAD');
});
test('[PB-14] pack writes checksum and never overwrites either earlier output',async()=>{
 const s=await packSource(),file=join(s.folder,'test.zip');const result=await writeV3Pack(s.source,file,{license});assert.equal(await readFile(file+'.sha256','utf8'),result.sha256+'  test.zip\n');const before=await readFile(file);await assert.rejects(writeV3Pack(s.source,file,{license}));assert.deepEqual(await readFile(file),before);
});
