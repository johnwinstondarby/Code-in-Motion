import { get } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileLesson, createLessonPack, createPortableArchive, MAX_AUTHORING_BYTES } from '../tools/lesson-pack-archive.mjs';
import { lessonPackUrlFor, readBoundedLesson, MAX_LESSON_BYTES } from '../wordpress/assets/lesson-pack-loading.mjs';
import { createWordPressExperienceLoader } from '../src/host/wordpress-browser-bindings.mjs';
import { validatePackLesson } from '../wordpress/assets/lesson-pack-validation.mjs';
import { checkPackLesson } from '../wordpress/assets/lesson-pack-admin.mjs';
import { startLessonPreview } from '../tools/lesson-preview-server.mjs';
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
  assert.doesNotMatch(php,/dangerous|alert\(|<script/);assert.match(php,/CiM Lesson Pack: cim.lesson-pack\/v1/);assert.doesNotMatch(php,/add_filter|require|include/);
  const manifest=JSON.parse(files.get('cim-lesson-my-first-lesson/cim-lesson-pack.json'));assert.deepEqual([manifest.schema,manifest.cim_min,manifest.cim_max_exclusive],['cim.lesson-pack/v1','1.0.0','2.0.0']);
  assert.equal(files.get('cim-lesson-my-first-lesson/LICENSE'),license);
  assert.equal([...files.values()].filter(s=>s===a.compiled).length,1);
  assert.match(manifest.lessons[0].file,/^lesson-[a-f0-9]{64}\.json$/);
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
  await assert.rejects(readBoundedLesson(new Response(new Uint8Array([0x22,0xff,0x22]))));
});
test('external links are HTTP(S) only without changing legacy runtime link contracts',async()=>{
  const lesson=compileLesson(JSON.stringify(own())).document;
  for(const href of ['mailto:a@school.test','/relative','#fragment','javascript:alert(1)']){
    const raw=structuredClone(lesson);raw.steps[0].commentary.links=[{id:'reference',label:'Reference',href}];
    await assert.rejects(readBoundedLesson(new Response(JSON.stringify(raw)),true),/HTTP|CIM-EXP/);
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
  assert.equal(entries(await readFile(resolve(work,'cim-lesson-my-first-lesson.zip'))).size,5);
});

test('PHP discovers versioned active manifests and rejects conflicts, escapes and invalid data',async t=>{
 const work=await mkdtemp(resolve(root,'../v1-php-'));t.after(()=>rm(work,{recursive:true,force:true}));
 const plugins=resolve(work,'plugins');await mkdir(plugins);const a=resolve(plugins,'pack-a'),b=resolve(plugins,'pack-b');await mkdir(a);await mkdir(b);
 const valid=compileLesson(JSON.stringify(own())).text;
 const normal={schema:'cim.lesson-pack/v1',cim_min:'1.0.0',cim_max_exclusive:'2.0.0',lessons:[{id:'my-first-lesson',file:'lesson.json'}]};
 const header="<?php\n/**\n * CiM Lesson Pack: cim.lesson-pack/v1\n */";
 for(const dir of[a,b]){await writeFile(resolve(dir,'main.php'),header);await writeFile(resolve(dir,'lesson.json'),valid);await writeFile(resolve(dir,'cim-lesson-pack.json'),JSON.stringify(normal));}
 const phpSource=resolve(root,'wordpress/lesson-packs.php').replaceAll('\\','/');
 function run(active=['pack-a/main.php']){
  const script=`define('ABSPATH',__DIR__);define('WP_PLUGIN_DIR',$argv[1]);define('LOCALIS_CIM_PLUGIN_VERSION','1.0.0');$active=json_decode($argv[2],true);function add_action(){} function add_filter(){} function get_plugins(){return array('pack-a/main.php'=>array('Name'=>'Pack A'),'pack-b/main.php'=>array('Name'=>'Pack B'));}function get_file_data($file,$keys){$raw=file_get_contents($file);preg_match('/CiM Lesson Pack: ([^\\r\\n]+)/',$raw,$m);return array('contract'=>$m[1]??'');}function is_plugin_active($p){global $active;return in_array($p,$active,true);}function is_plugin_active_for_network($p){return false;}function plugins_url($path){return 'https://school.test/wp-content/plugins'.$path;}require '${phpSource}';echo json_encode(localis_cim_read_lesson_packs());`;
  const r=spawnSync('php',['-r',script,plugins,JSON.stringify(active)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
 }
 const result=run();assert.equal(result.lessons['my-first-lesson'].source,'lesson pack');assert.equal(result.packs[1].status,'Inactive');
 assert.equal(Object.keys(run([]).lessons).length,0);
 const conflict=run(['pack-a/main.php','pack-b/main.php']);assert.equal(Object.keys(conflict.lessons).length,0);assert.equal(conflict.rows.length,2);assert.ok(conflict.rows.every(r=>r.status==='Rejected'&&/no pack wins/.test(r.reason)));
 const save=async manifest=>writeFile(resolve(a,'cim-lesson-pack.json'),JSON.stringify(manifest));
 for(const manifest of [{...normal,cim_min:'2.0.0',cim_max_exclusive:'3.0.0'},{...normal,cim_min:'0.9.0',cim_max_exclusive:'1.0.0'},{...normal,schema:'unknown'},{...normal,cim_min:'invalid'},{...normal,lessons:[{id:'my-first-lesson',file:'../pack-b/lesson.json'}]}]){await save(manifest);assert.equal(Object.keys(run().lessons).length,0);assert.ok(run().errors.length);}
 await save(normal);
 await writeFile(resolve(a,'main.php'),header.replace('cim.lesson-pack/v1','cim.lesson-pack/v99'));assert.equal(Object.keys(run().lessons).length,0);await writeFile(resolve(a,'main.php'),header);
 const other={...JSON.parse(valid),id:'second-lesson'};await writeFile(resolve(b,'lesson.json'),JSON.stringify(other));await writeFile(resolve(b,'cim-lesson-pack.json'),JSON.stringify({...normal,lessons:[{id:other.id,file:'lesson.json'}]}));assert.equal(Object.keys(run(['pack-a/main.php','pack-b/main.php']).lessons).length,2);
 await save(normal);
 for(const text of ['{',JSON.stringify({...JSON.parse(valid),presentation:{title:'x'.repeat(2097153)}}),valid.replace('"id": "my-first-lesson"','"id": "mismatch"'),valid.replace('localis.cim/v2','unknown'),valid.replace('console/v1','unknown')]){await writeFile(resolve(a,'lesson.json'),text);assert.equal(Object.keys(run().lessons).length,0);assert.ok(run().errors.length);}
 await writeFile(resolve(a,'lesson.json'),valid);
 await save({...normal,lessons:[{id:'my-first-lesson',file:'lesson.txt'}]});await writeFile(resolve(a,'lesson.txt'),valid);assert.equal(Object.keys(run().lessons).length,0);
 await save({...normal,lessons:[{id:'git-repository-practice',file:'lesson.json'}]});await writeFile(resolve(a,'lesson.json'),JSON.stringify({...JSON.parse(valid),id:'git-repository-practice'}));assert.equal(Object.keys(run().lessons).length,0);
 await writeFile(resolve(a,'lesson.json'),valid);
 await save({...normal,padding:'x'.repeat(65537)});assert.equal(Object.keys(run().lessons).length,0);
 await save(normal);await writeFile(resolve(a,'lesson.json'),valid);
 await writeFile(resolve(b,'lesson.json'),valid);
 try{await symlink(resolve(b,'lesson.json'),resolve(a,'escape.json'),'file');await save({...normal,lessons:[{id:'my-first-lesson',file:'escape.json'}]});assert.equal(Object.keys(run().lessons).length,0);}catch(error){if(process.platform!=='win32'||error.code!=='EPERM')throw error;t.diagnostic('Windows file-symlink privilege unavailable; Linux CI enforces the symlink case.');}
});

test('Admin validates every active lesson with the actual Player gate before a page is opened',async()=>{
 const valid=compileLesson(JSON.stringify(own())).document;
 const check=raw=>checkPackLesson({id:'my-first-lesson',url:'/pack.json',baseURI:'https://school.test/admin/',fetch:async()=>new Response(JSON.stringify(raw))});
 assert.equal((await check(valid)).status,'Ready');
 for(const mutate of[d=>{delete d.presentation;},d=>{d.steps.at(-1).state={};},d=>{d.engine_min='999.0.0';},d=>{d.id='other';},d=>{d.steps[0].commentary.links=[{id:'x',label:'X',href:'javascript:alert(1)'}];}]){const bad=structuredClone(valid);mutate(bad);const result=await check(bad);assert.equal(result.status,'Rejected');assert.ok(result.reason);}
});

test('local preview reads edits on refresh without writing a build and refuses unrelated files',async t=>{
 const work=await mkdtemp(resolve(root,'../v1-preview-'));t.after(()=>rm(work,{recursive:true,force:true}));const file=resolve(work,'lesson.json');await writeFile(file,JSON.stringify(own()));
 const {server,url}=await startLessonPreview(file);t.after(()=>new Promise(done=>server.close(done)));
 assert.equal((await fetch(url)).status,200);let lesson=await(await fetch(url+'/lesson.json')).json();assert.equal(lesson.id,'cim-local-preview');
 const revised=own();revised.title='Edited without install';await writeFile(file,JSON.stringify(revised));lesson=await(await fetch(url+'/lesson.json')).json();assert.equal(lesson.presentation.title,revised.title);
 assert.equal((await fetch(url,{method:'POST'})).status,405);
 const foreignHost=await new Promise((done,reject)=>get(url,{headers:{Host:'elsewhere.test'}},r=>{r.resume();done(r.statusCode);}).on('error',reject));assert.equal(foreignHost,403);
 assert.equal((await fetch(url+'/package.json')).status,404);assert.equal((await fetch(url+'/lesson.json',{headers:{Origin:'https://elsewhere.test'}})).status,403);
 await writeFile(file,'{');const failed=await fetch(url+'/lesson.json');assert.equal(failed.status,422);assert.ok((await failed.json()).error);
});

test('shared pack preflight rejects schema defects before delegating to any loader',()=>{
 const valid=compileLesson(JSON.stringify(own())).document;assert.equal(validatePackLesson(valid).id,valid.id);
 for(const mutate of[d=>{delete d.presentation;},d=>{d.steps.at(-1).state={};}]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>validatePackLesson(bad));}
});


test('pack inventory scans once per request and reuses only an unchanged cross-request snapshot',async(t)=>{
 const work=await mkdtemp(resolve(root,'../pack-cache-'));t.after(()=>rm(work,{recursive:true,force:true}));
 const directory=resolve(work,'pack-a');await mkdir(directory);
 await writeFile(resolve(directory,'main.php'),'<?php /* CiM Lesson Pack: cim.lesson-pack/v1 */');
 const manifest={schema:'cim.lesson-pack/v1',cim_min:'1.0.0',cim_max_exclusive:'2.0.0',lessons:[{id:'my-first-lesson',file:'lesson.json'}]};
 const manifestPath=resolve(directory,'cim-lesson-pack.json');
 await writeFile(manifestPath,JSON.stringify(manifest));await writeFile(resolve(directory,'lesson.json'),compileLesson(JSON.stringify(own())).text);
 const phpSource=resolve(root,'wordpress/lesson-packs.php').replaceAll('\\','/');
 const script=`define('ABSPATH',__DIR__);define('WP_PLUGIN_DIR',$argv[1]);define('LOCALIS_CIM_PLUGIN_VERSION','1.0.0');$headers=0;$discoveries=0;$fingerprints=0;
 function add_action(){}function add_filter(){}function plugins_url($p=''){global $fingerprints;$fingerprints++;return 'https://school.test/plugins'.$p;}
 function get_plugins(){global $discoveries;$discoveries++;return array('pack-a/main.php'=>array('Name'=>'A'));}
 function get_file_data($p,$k){global $headers;$headers++;return array('contract'=>'cim.lesson-pack/v1');}
 function is_plugin_active($p){global $argv;return $argv[2]==='active';}function is_plugin_active_for_network($p){return false;}
 function get_option($key,$default){global $argv;return $argv[2]==='active'?array('pack-a/main.php'):array();}
 function get_transient($key){return is_file(WP_PLUGIN_DIR.'/cache')?unserialize(file_get_contents(WP_PLUGIN_DIR.'/cache')):false;}
 function set_transient($key,$value,$ttl){if($key!=='localis_cim_pack_inventory_v1'||$ttl!==86400)throw new Exception('unexpected cache');file_put_contents(WP_PLUGIN_DIR.'/cache',serialize($value));}
 require '${phpSource}';$first=localis_cim_read_lesson_packs();$after=$fingerprints;$second=localis_cim_read_lesson_packs();if($fingerprints!==$after)throw new Exception('inventory fingerprint repeated within request');if($first!==$second)throw new Exception('request changed');echo json_encode(array('inventory'=>$first,'headers'=>$headers,'discoveries'=>$discoveries));`;
 const run=(active='active')=>{const r=spawnSync('php',['-r',script,work,active],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 let result=run();assert.equal(result.headers,1);assert.equal(result.discoveries,1);assert.ok(result.inventory.lessons['my-first-lesson']);
 result=run();assert.equal(result.headers,0,'warm request read pack headers / rescanned lessons');assert.equal(result.discoveries,0,'warm request enumerated plugin headers');
 manifest.cim_min='9.0.0';await writeFile(manifestPath,JSON.stringify(manifest));result=run();assert.equal(result.headers,1);assert.match(result.inventory.packs[0].reason,/Incompatible/);
 manifest.cim_min='1.0.0';await writeFile(manifestPath,JSON.stringify(manifest));assert.ok(run().inventory.lessons['my-first-lesson']);
 result=run('inactive');assert.equal(result.inventory.packs[0].status,'Inactive');assert.equal(Object.keys(result.inventory.lessons).length,0);
 assert.ok(run().inventory.lessons['my-first-lesson']);
 await writeFile(resolve(directory,'lesson.json'),'{}');result=run();assert.equal(result.headers,1);assert.equal(Object.keys(result.inventory.lessons).length,0,'changed lesson reused cached acceptance');
 await writeFile(resolve(directory,'lesson.json'),compileLesson(JSON.stringify(own())).text);assert.ok(run().inventory.lessons['my-first-lesson']);
 const outside=resolve(work,'outside.json');await writeFile(outside,compileLesson(JSON.stringify(own())).text);await rm(resolve(directory,'lesson.json'));await symlink(outside,resolve(directory,'lesson.json'));
 result=run();assert.equal(Object.keys(result.inventory.lessons).length,0,'escaping symlink reused cached acceptance');
});

test('CLI and preview expose every nested compiler diagnostic once with rule, path and fix',async(t)=>{
 const work=await mkdtemp(resolve(root,'../pack-diagnostics-'));t.after(()=>rm(work,{recursive:true,force:true}));
 const source=own();source.unexpected1=true;source.unexpected2=true;source.unexpected3=true;source.unexpected4=true;
 const text=JSON.stringify(source),file=resolve(work,'lesson.json');await writeFile(file,text);
 let failure;try{compileLesson(text);}catch(error){failure=error;}
 const causes=failure.diagnostics.flatMap(d=>d.causes??[]);assert.equal(causes.length,4);
 const cli=spawnSync(process.execPath,[resolve(root,'tools/cim-author.mjs'),'validate',file],{encoding:'utf8'});assert.equal(cli.status,1);
 const {server,url}=await startLessonPreview(file);t.after(()=>new Promise(done=>server.close(done)));
 const response=await fetch(url+'/lesson.json');assert.equal(response.status,422);const data=await response.json();
 assert.equal(data.error,cli.stderr.trim());
 for(const cause of causes){for(const output of [cli.stderr,data.error]){assert.ok(output.includes(cause.id??cause.code));assert.ok(output.includes(cause.path));assert.ok(output.includes(cause.message));assert.equal(output.split(cause.path+':').length-1,1);}}
 const client=await readFile(resolve(root,'tools/lesson-preview-client.mjs'),'utf8');assert.match(client,/status\.textContent/);assert.doesNotMatch(client,/innerHTML/);
});

test('authoring archive places the getting-started README at its root',async()=>{
 const builder=await readFile(resolve(root,'tools/build-authoring-release.mjs'),'utf8');
 assert.match(builder,/files\.set\(resolve\(root,'README\.md'\), readHeadFile\('docs\/AUTHORING-TOOL-README\.md','utf8'\)\)/);
 const guide=await readFile(resolve(root,'docs/AUTHORING-TOOL-README.md'),'utf8');assert.match(guide,/docs\/AUTHORING-GUIDE\.md/);assert.match(guide,/node tools\/cim-author\.mjs init/);
});
