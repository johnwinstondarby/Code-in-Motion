import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,readFile,symlink,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {installPack,placeholderPack} from './helpers/part-c-pack.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const phpSource=resolve(root,'wordpress/lesson-packs.php').replaceAll('\\','/');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

async function site(t){
 const work=await mkdtemp(resolve(root,'../part-c-php-'));t.after(()=>rm(work,{recursive:true,force:true}));
 const plugins=resolve(work,'plugins'),pack=resolve(plugins,'cim-lesson-run-custody-placeholder');await mkdir(pack,{recursive:true});
 // The generated pack's own inert lesson-pack.php carries the v2 header and is manifest-listed.
 await installPack(pack);
 return {plugins,pack};
}
// Runs the real discovery code against WordPress stubs. Options choose the host version and the optional wp-config constant.
function discover(plugins,{version='1.0.1',constant=null,call='localis_cim_read_lesson_packs()'}={}){
 const define=constant===null?'':`define('LOCALIS_CIM_DEVELOPMENT_ADMISSION',${JSON.stringify(constant)});`;
 const script=`define('ABSPATH',__DIR__);define('WP_PLUGIN_DIR',$argv[1]);define('LOCALIS_CIM_PLUGIN_VERSION',${JSON.stringify(version)});${define}function add_action(){} function add_filter(){} function get_plugins(){return array('cim-lesson-run-custody-placeholder/lesson-pack.php'=>array('Name'=>'Run Custody pack'));}function get_file_data($file,$keys){$raw=file_get_contents($file);preg_match('/CiM Lesson Pack: ([^\\r\\n]+)/',$raw,$m);return array('contract'=>$m[1]??'');}function is_plugin_active($p){return true;}function is_plugin_active_for_network($p){return false;}function plugins_url($path=''){return 'https://school.test/wp-content/plugins'.$path;}require '${phpSource}';echo json_encode(${call});`;
 const r=spawnSync('php',['-r',script,plugins],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
const id='run-custody-placeholder';

test('[PC-PHP-01] a released 1.0.1 host refuses a v2 pack with its interval reason',async t=>{
 const {plugins}=await site(t),result=discover(plugins);
 assert.equal(result.lessons[id],undefined);
 assert.equal(result.packs[0].status,'Rejected');
 assert.match(result.packs[0].reason,/1\.1\.0/);
});

test('[PC-PHP-02] the exact development constant admits the v2 pack with verified lesson and capture URLs',async t=>{
 const {plugins}=await site(t),pack=await placeholderPack(),result=discover(plugins,{constant:'1.1.0-dev'});
 const lesson=result.lessons[id];
 assert.ok(lesson,JSON.stringify(result.errors));
 assert.equal(lesson.agreement,'cim.lesson-pack/v2');
 assert.match(lesson.url,new RegExp('/cim-lesson-run-custody-placeholder/lesson\\.json\\?cim-sha256='+sha(pack.entries.get('lesson.json'))+'$'));
 assert.match(lesson.capture_url,new RegExp('/cim-lesson-run-custody-placeholder/capture\\.json\\?cim-sha256='+sha(pack.entries.get('capture.json'))+'$'));
 assert.equal(result.development_admission,true);
 assert.equal(discover(plugins,{constant:'1.1.0-dev',call:'localis_cim_development_admission_active()'}),true);
 assert.equal(discover(plugins,{call:'localis_cim_development_admission_active()'}),false);
});

test('[PC-PHP-03] the development rule cannot be widened by other values or by a released version',async t=>{
 const {plugins}=await site(t);
 for(const constant of ['1.1.0','yes',true,1,'1.1.0-dev '])assert.equal(discover(plugins,{constant}).lessons[id],undefined,String(constant));
 // Once CiM itself reaches 1.1.0 the constant is irrelevant: the real interval decides.
 assert.ok(discover(plugins,{version:'1.1.0'}).lessons[id]);
 assert.equal(discover(plugins,{version:'2.0.0',constant:'1.1.0-dev'}).lessons[id],undefined);
 assert.equal(discover(plugins,{version:'1.1.0',constant:'1.1.0-dev',call:'localis_cim_development_admission_active()'}),false);
});

test('[PC-PHP-04] every manifest-listed file is confined and must match its size and fingerprint',async t=>{
 const cases=[
  async({pack})=>writeFile(resolve(pack,'media/submit-fail.mp4'),'tampered bytes'),
  async({pack})=>{const file=resolve(pack,'captions/submit-fail-mp4.vtt'),bytes=await readFile(file);bytes[bytes.length-2]^=1;await writeFile(file,bytes);},
  async({pack})=>unlink(resolve(pack,'media/track-mlflow.webm')),
  async({pack,plugins})=>{const outside=resolve(plugins,'outside.mp4');await writeFile(outside,await readFile(resolve(pack,'media/submit-fail.mp4')));await unlink(resolve(pack,'media/submit-fail.mp4'));await symlink(outside,resolve(pack,'media/submit-fail.mp4'));},
  async({pack})=>{const m=JSON.parse(await readFile(resolve(pack,'cim-lesson-pack.json'),'utf8'));m.files[0].path='../outside.json';await writeFile(resolve(pack,'cim-lesson-pack.json'),JSON.stringify(m));},
  async({pack})=>{const m=JSON.parse(await readFile(resolve(pack,'cim-lesson-pack.json'),'utf8'));m.files=m.files.filter(f=>f.path!=='capture.json');await writeFile(resolve(pack,'cim-lesson-pack.json'),JSON.stringify(m));}
 ];
 for(const change of cases){
  const s=await site(t);await change(s);const result=discover(s.plugins,{constant:'1.1.0-dev'});
  assert.equal(result.lessons[id],undefined,change.toString());assert.ok(result.errors.length,change.toString());
 }
});

test('[PC-PHP-05] placeholder mode, agreement, renderer and capture schema are required',async t=>{
 const edit=async(pack,name,fn)=>{const file=resolve(pack,name),data=JSON.parse(await readFile(file,'utf8'));fn(data);const text=JSON.stringify(data);await writeFile(file,text);
  // Keep the manifest fingerprint consistent so each case isolates the intended rule.
  if(name!=='cim-lesson-pack.json'){const m=JSON.parse(await readFile(resolve(pack,'cim-lesson-pack.json'),'utf8'));const entry=m.files.find(f=>f.path===name);entry.size=Buffer.byteLength(text);entry.sha256=sha(text);await writeFile(resolve(pack,'cim-lesson-pack.json'),JSON.stringify(m));}};
 const cases=[
  pack=>edit(pack,'cim-lesson-pack.json',m=>{m.placeholder=false;}),
  pack=>edit(pack,'cim-lesson-pack.json',m=>{m.schema='cim.lesson-pack/v1';}),
  pack=>edit(pack,'lesson.json',l=>{l.renderer='console/v1';}),
  pack=>edit(pack,'lesson.json',l=>{l.renderer_config.placeholder.enabled=false;}),
  pack=>edit(pack,'lesson.json',l=>{l.id='other-lesson';}),
  pack=>edit(pack,'capture.json',c=>{c.schema='unknown';})
 ];
 for(const change of cases){
  const s=await site(t);await change(s.pack);const result=discover(s.plugins,{constant:'1.1.0-dev'});
  assert.equal(result.lessons[id],undefined,change.toString());assert.ok(result.errors.length,change.toString());
 }
});

test('[PC-PHP-06] replacing a listed media file invalidates the cached acceptance fingerprint',async t=>{
 const {plugins,pack}=await site(t);
 const fingerprint=()=>discover(plugins,{constant:'1.1.0-dev',call:"localis_cim_pack_fingerprint(get_plugins())"});
 const before=fingerprint();
 // A replacement with different bytes must change the stat identity. (Same-size, same-second rewrites can keep
 // stat identity; the browser verifies lesson/capture bytes against their SHA-256 for that reason.)
 const file=resolve(pack,'media/track-mlflow.webm'),bytes=await readFile(file);await unlink(file);await writeFile(file,Buffer.concat([bytes,Buffer.from('x')]));
 const after=fingerprint();
 assert.notEqual(before,after);
});
