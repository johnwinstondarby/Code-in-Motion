import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import {SCHEMAS,validateDocument} from '../authoring/v3/validate.mjs';
import {motionFixture} from './helpers/motion-fixture.mjs';
const fixture=motionFixture(),root=fileURLToPath(new URL('../',import.meta.url));
const manifest=media=>({schema:'cim.lesson-pack/v2',cim_min:'1.1.0',cim_max_exclusive:'2.0.0',placeholder:true,lessons:[{id:'lesson',file:'lesson.json',capture:'capture.json'}],media});
async function folder(){const path=await mkdtemp(join(tmpdir(),'cim-motion-'));await mkdir(join(path,'media'));await writeFile(join(path,'media/placeholder.webm'),fixture.bytes);await writeFile(join(path,'media/placeholder.vtt'),fixture.captions);await writeFile(join(path,'map.json'),JSON.stringify(fixture.map));return path;}
const cli=path=>spawnSync(process.execPath,[join(root,'tools/cim-author.mjs'),'validate',path],{cwd:root,encoding:'utf8'});
test('[MOT-11] fixture media map opens without changing deferred-map rejection',()=>{const result=validateDocument(manifest(fixture.map),'pack');assert.deepEqual(result.diagnostics,[]);assert(SCHEMAS.media);const valid=validateDocument(fixture.map,'media');assert.deepEqual(valid.diagnostics,[]);const deferred=manifest({status:'deferred',assets:['reserved']});assert(validateDocument(deferred,'pack').diagnostics.some(d=>d.id==='CIM-V3-MEDIA-DEFERRED'));});
test('[MOT-12] reference schema agrees on valid and malformed media maps',()=>{assert(SCHEMAS.media);const ajv=new Ajv2020({strict:false,allErrors:true}),check=ajv.compile(SCHEMAS.media);assert(check(fixture.map));for(const change of [m=>m.assets[0].source={type:'attachment',id:'https://evil.invalid'},m=>delete m.assets[0].captions,m=>m.assets[0].size=4194305,m=>m.assets[0].source.path='../outside.webm']){const m=structuredClone(fixture.map);change(m);assert.equal(check(m),false);assert(validateDocument(m,'media').diagnostics.length>0);}});
test('[MOT-13] author validate verifies bounded pack files and their digests',async()=>{const path=await folder();let result=cli(join(path,'map.json'));assert.equal(result.status,0,result.stdout+result.stderr);await writeFile(join(path,'media/placeholder.webm'),Buffer.alloc(fixture.bytes.length));result=cli(join(path,'map.json'));assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/CIM-MEDIA-FINGERPRINT/);});
test('[MOT-14] file validation refuses escaping directory links',async()=>{const external=await folder(),path=await mkdtemp(join(tmpdir(),'cim-motion-link-'));await symlink(join(external,'media'),join(path,'media'),process.platform==='win32'?'junction':'dir');await writeFile(join(path,'map.json'),JSON.stringify(fixture.map));const result=cli(join(path,'map.json'));assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/CIM-MEDIA-SOURCE/);});

test('[MOT-12] Unicode media labels use JSON Schema character counts',()=>{const m=structuredClone(fixture.map);m.assets[0].alt='🙂'.repeat(4000);m.assets[0].captions.label='🙂'.repeat(100);const ajv=new Ajv2020({strict:false}),check=ajv.compile(SCHEMAS.media);assert(check(m));assert.deepEqual(validateDocument(m,'media').diagnostics,[]);m.assets[0].captions.label+='🙂';assert.equal(check(m),false);assert(validateDocument(m,'media').diagnostics.length>0);});

test('[MOT-11] null pack input returns the normal shape diagnostic',()=>{const result=validateDocument(null,'pack');assert.equal(result.diagnostics[0]?.id,'CIM-V3-SHAPE');assert.equal(result.diagnostics[0]?.path,'$');});
