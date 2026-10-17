import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileLesson, createLessonPack, createPortableArchive, MAX_AUTHORING_BYTES } from '../tools/lesson-pack-archive.mjs';
import { lessonPackUrlFor, readBoundedLesson, MAX_LESSON_BYTES } from '../wordpress/assets/lesson-pack-loading.mjs';
import { createWordPressExperienceLoader } from '../src/host/wordpress-browser-bindings.mjs';
import { resolveLearnerTheme } from '../wordpress/assets/theme-presets.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const starter=await readFile(resolve(root,'experiences/starter/python-first-steps.authoring.json'),'utf8');
const license=await readFile(resolve(root,'LICENSE'),'utf8');
const own=()=>{const doc=JSON.parse(starter);doc.id='my-first-lesson';return doc;};
function entries(zip) {
  const files=new Map();let pos=0;
  while(zip.readUInt32LE(pos)===0x04034b50){
    assert.equal(zip.readUInt16LE(pos+8),0);const size=zip.readUInt32LE(pos+18),len=zip.readUInt16LE(pos+26),extra=zip.readUInt16LE(pos+28);
    const name=zip.subarray(pos+30,pos+30+len).toString(),start=pos+30+len+extra;
    files.set(name,zip.subarray(start,start+size).toString());pos=start+size;
  }return files;
}
test('standalone compiler is byte-identical to the reviewed Git fixture and the bundled non-Git starter',async()=>{
  for(const stem of ['git/git-repository-practice','starter/python-first-steps'])assert.equal(compileLesson(await readFile(resolve(root,'experiences',stem+'.authoring.json'),'utf8')).text,await readFile(resolve(root,'experiences',stem+'.json'),'utf8'));
});
test('companion pack is reproducible, licensed and keeps authored text out of PHP',()=>{
  const source=own();source.title='*/ <?php dangerous(); ?> <script>alert(1)</script>';
  const a=createLessonPack(JSON.stringify(source),license),b=createLessonPack(JSON.stringify(source),license);
  assert.deepEqual(a.zip,b.zip);const files=entries(a.zip);
  const php=files.get('cim-lesson-my-first-lesson/lesson-pack.php');
  assert.doesNotMatch(php,/dangerous|alert\(|<script/);assert.match(php,/cim_lesson_packs/);
  assert.equal(files.get('cim-lesson-my-first-lesson/LICENSE'),license);
  assert.equal([...files.values()].filter(s=>s===a.compiled).length,1);
  assert.match(php,/lesson-[a-f0-9]{64}\.json/);
});
test('authoring rejects malformed data, unsafe links, oversized input and reserved bundled IDs',()=>{
  assert.throws(()=>compileLesson('{'));
  assert.throws(()=>compileLesson(' '.repeat(2097153)),/2 MiB/);
  const doc=own();doc.beats[2].explanation.references[0].url='javascript:alert(1)';assert.throws(()=>compileLesson(JSON.stringify(doc)));
  assert.throws(()=>createLessonPack(starter,license),/bundled lesson IDs/);
});
test('archive rejects traversal, absolute and duplicate paths',()=>{
  for(const path of ['/absolute/file','root/../file','root//file'])assert.throws(()=>createPortableArchive([{path,data:'x'}]),/Unsafe/);
  assert.throws(()=>createPortableArchive([{path:'root/file',data:'x'},{path:'root/file',data:'y'}]),/duplicate/);
});
test('pack URLs reject cross-origin, executable, conflicting and malformed targets',()=>{
  const document=urls=>({baseURI:'https://school.test/lesson/',querySelectorAll:()=>urls.map(url=>({getAttribute:key=>key==='data-cim-experience'?'my-first-lesson':url}))});
  assert.equal(lessonPackUrlFor(document(['/wp-content/plugins/pack/lesson.json']),'my-first-lesson'),'https://school.test/wp-content/plugins/pack/lesson.json');
  for(const urls of [['https://elsewhere.test/lesson.json'],['javascript:alert(1)'],['/lesson.php'],['/a.json','/b.json'],[]])assert.equal(lessonPackUrlFor(document(urls),'my-first-lesson'),'');
});
test('bounded reader rejects declared and streamed oversize, invalid JSON and invalid UTF-8',async()=>{
  await assert.rejects(readBoundedLesson(new Response('{}',{headers:{'content-length':'2097153'}})),/2 MiB/);
  await assert.rejects(readBoundedLesson(new Response(' '.repeat(2097153))),/2 MiB/);
  await assert.rejects(readBoundedLesson(new Response('{')));
  await assert.rejects(readBoundedLesson(new Response(new Uint8Array([0xff]))));
});
test('external links are HTTP(S) only without changing legacy runtime link contracts',async()=>{
  const lesson=compileLesson(JSON.stringify(own())).document;
  for(const href of ['mailto:a@school.test','/relative','#fragment','javascript:alert(1)']){
    const raw=structuredClone(lesson);raw.steps[0].commentary.links=[{id:'reference',label:'Reference',href}];
    await assert.rejects(readBoundedLesson(new Response(JSON.stringify(raw)),true),/HTTP/);
  }
  assert.equal((await readBoundedLesson(new Response(JSON.stringify(lesson)),true)).id,lesson.id);
});
test('external data still passes existing schema, identity and engine gates',async()=>{
  const valid=compileLesson(JSON.stringify(own())).document;
  async function load(raw){return createWordPressExperienceLoader({fetch:async()=>({ok:true,status:200,json:()=>readBoundedLesson(new Response(JSON.stringify(raw)),true)}),experienceUrlFor:()=>'/pack.json'}).load('my-first-lesson');}
  assert.equal((await load(valid)).id,valid.id);
  for(const mutate of [d=>{delete d.presentation;},d=>{d.schema='unknown';},d=>{d.id='different';},d=>{d.engine_min='999.0.0';},d=>{d.renderer='unknown/v1';}]){const bad=structuredClone(valid);mutate(bad);await assert.rejects(load(bad));}
});
test('neutral defaults preserve legacy, saved learner choice and high contrast precedence',()=>{
  assert.equal(resolveLearnerTheme({defaultTheme:'light'}),'light');
  assert.equal(resolveLearnerTheme({}),'localis');
  assert.equal(resolveLearnerTheme({defaultTheme:'light',explicit:'localis'}),'localis');
  assert.equal(resolveLearnerTheme({defaultTheme:'light',contrast:true}),'high-contrast');
});
test('CLI init/validate/pack works outside the repository and never overwrites a teacher file',async t=>{
  const work=await mkdtemp(resolve(root,'..','v1-cli-'));t.after(()=>rm(work,{recursive:true,force:true}));
  const cli=resolve(root,'tools/cim-author.mjs');
  const run=args=>spawnSync(process.execPath,[cli,...args],{cwd:work,encoding:'utf8'});
  assert.equal(run(['init','my-lesson.json']).status,0);
  assert.equal(run(['init','my-lesson.json']).status,1);
  assert.equal(run(['validate','my-lesson.json']).status,0);
  const result=run(['pack','my-lesson.json']);assert.equal(result.status,0,result.stderr);
  assert.equal(run(['pack','my-lesson.json']).status,1);
  assert.equal(entries(await readFile(resolve(work,'cim-lesson-my-first-lesson.zip'))).size,4);
});
test('PHP registration rejects unsafe files, conflicting IDs and invalid metadata',async t=>{
  const work=await mkdtemp(resolve(root,'..','v1-php-'));t.after(()=>rm(work,{recursive:true,force:true}));
  const plugins=resolve(work,'plugins');await mkdir(plugins);
  const file=resolve(plugins,'lesson.json');const valid=compileLesson(JSON.stringify(own())).text;await writeFile(file,valid);
  await writeFile(resolve(work,'outside.json'),valid);
  const phpSource=resolve(root,'wordpress/lesson-packs.php').replaceAll('\\','/');
  const run=packs=>{
    const script=`define('ABSPATH',__DIR__);define('WP_PLUGIN_DIR',$argv[1]);$packs=json_decode($argv[2],true);function apply_filters($name,$value){global $packs;return $packs;}function plugins_url($path){return 'https://school.test/wp-content/plugins'.$path;}require '${phpSource}';echo json_encode(cim_read_lesson_packs());`;
    const result=spawnSync('php',['-r',script,plugins,JSON.stringify(packs)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  };
  const entry={id:'my-first-lesson',file};assert.equal(run([entry]).lessons[entry.id].source,'lesson pack');
  for(const packs of [[{...entry,id:'git-repository-practice'}],[entry,entry],[{...entry,id:'../escape'}],[{...entry,file:resolve(work,'outside.json')}],[{...entry,file:phpSource}]]){const r=run(packs);assert.equal(Object.keys(r.lessons).length,0);assert.ok(r.errors.length);}
  await writeFile(file,'{');assert.ok(run([entry]).errors.length);
  const oversized=JSON.parse(valid);oversized.title='x'.repeat(2097153);await writeFile(file,JSON.stringify(oversized));assert.ok(run([entry]).errors.length);
  await writeFile(resolve(plugins,'lesson.txt'),valid);assert.ok(run([{...entry,file:resolve(plugins,'lesson.txt')}]).errors.length);
  const bundled=JSON.parse(valid);bundled.id='git-repository-practice';await writeFile(file,JSON.stringify(bundled));assert.ok(run([{...entry,id:bundled.id}]).errors.length);
  for(const field of ['schema','renderer']){const bad=JSON.parse(valid);bad[field]='unknown';await writeFile(file,JSON.stringify(bad));assert.ok(run([entry]).errors.length);}
  await writeFile(file,valid.replace('"id": "my-first-lesson"','"id": "mismatch"'));assert.ok(run([entry]).errors.length);
});
