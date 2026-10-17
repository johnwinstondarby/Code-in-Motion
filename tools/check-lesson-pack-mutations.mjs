import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const arg=process.argv.find(s=>s.startsWith('--work-directory='));
const work=resolve(arg?.slice(17)??resolve(root,'../lesson-pack-mutations'));
await mkdir(work,{recursive:true});
const sandbox=await mkdtemp(resolve(work,'candidate-'));
await cp(root,sandbox,{recursive:true,filter:path=>!['.git','node_modules','dist','test-results','work'].includes(basename(path))});
await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const php='wordpress/lesson-packs.php',reader='wordpress/assets/lesson-pack-loading.mjs';
const mutations=[
 ['own folder boundary',php,'dirname( $file ) !== $directory','false'],
 ['canonical JSON basename',php,"! preg_match( '/^[a-zA-Z0-9_-]+\\.json$/D', $name )",'false'],
 ['active packs only',php,'if ( ! $active ) {','if ( false ) {'],
 ['bundled lesson protection',php,'in_array( $id, $bundled, true )','false'],
 ['duplicate lesson protection',php,'isset( $seen[ $id ] )','false'],
 ['PHP 2 MiB limit',php,'2097152','4194304'],
 ['manifest size limit',php,'65536','131072'],
 ['versioned header agreement',php,"'cim.lesson-pack/v1' !== $header['contract']",'false'],
 ['versioned manifest agreement',php,"( $manifest['schema'] ?? '' ) !== 'cim.lesson-pack/v1'",'false'],
 ['minimum compatibility',php,"version_compare( LOCALIS_CIM_PLUGIN_VERSION, $manifest['cim_min'], '<' )",'false'],
 ['maximum compatibility',php,"version_compare( LOCALIS_CIM_PLUGIN_VERSION, $manifest['cim_max_exclusive'], '>=' )",'false'],
 ['metadata identity',php,"( $data['id'] ?? null ) !== $id",'false'],
 ['metadata schema',php,"( $data['schema'] ?? null ) !== 'localis.cim/v2'",'false'],
 ['metadata renderer',php,"( $data['renderer'] ?? null ) !== 'console/v1'",'false'],
 ['authoring input limit','tools/lesson-pack-archive.mjs','MAX_AUTHORING_BYTES = 2 *','MAX_AUTHORING_BYTES = 4 *'],
 ['authored text cannot become PHP','tools/lesson-pack-archive.mjs','Description: Companion lesson data for Code in Motion.','Description: ${result.document.presentation.title}'],
 ['browser 2 MiB limit',reader,'MAX_LESSON_BYTES = 2 *','MAX_LESSON_BYTES = 4 *'],
 ['same origin requirement',reader,'url.origin !== new URL(document.baseURI).origin','false'],
 ['JSON response path',reader,"!url.pathname.endsWith('.json')",'false'],
 ['conflicting URL rejection',reader,'urls.size !== 1','urls.size === 0'],
 ['pack link protocol check','wordpress/assets/lesson-pack-validation.mjs',"!['http:', 'https:'].includes(url.protocol)",'false'],
 ['malformed JSON fails closed',reader,"const lesson = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));","let lesson; try { lesson = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); } catch { lesson = {}; }"],
 ['invalid UTF-8 fails closed',reader,'fatal: true','fatal: false'],
 ['existing schema gate','wordpress/assets/lesson-pack-validation.mjs','const experience = ingestExperience(raw);','const experience = raw;'],
 ['preflight every renderer state','wordpress/assets/lesson-pack-validation.mjs','assertConsoleRendererInput(step.state, experience.renderer_config ?? null, step.renderer_config ?? null);','void step;'],
 ['preview Host check','tools/lesson-preview-server.mjs','request.headers.host !== new URL(origin).host','false'],
 ['preview Origin check','tools/lesson-preview-server.mjs',"request.headers.origin && request.headers.origin !== origin",'false'],
 ['preview file allowlist','tools/lesson-preview-server.mjs','const file = assets.get(path);',"const file = resolve(root, '.' + path);"],
 ['preview read only methods','tools/lesson-preview-server.mjs',"request.method !== 'GET' && request.method !== 'HEAD'",'false'],
 ['Admin performs actual admission','wordpress/assets/lesson-pack-admin.mjs','await loader.load(id);','void loader;']
];
const args=['--test','tests/lesson-packs.test.mjs'];
function run(){return spawnSync(process.execPath,args,{cwd:sandbox,encoding:'utf8',timeout:120000});}
let result=run();await writeFile(resolve(work,'baseline.log'),result.stdout+result.stderr);
if(result.status!==0)throw Error('Packaging mutation baseline failed: '+result.stdout+result.stderr);
for(const[name,file,from,to]of mutations){
 const path=resolve(sandbox,file),original=await readFile(path,'utf8');
 if(typeof from==='string'&&!original.includes(from))throw Error('Missing target: '+name);
 try{
  await writeFile(path,original.replace(from,to));result=run();
  await writeFile(resolve(work,name.replaceAll(' ','-')+'.log'),result.stdout+result.stderr);
  if(result.status===0||result.error||!/(not ok|failed|✖)/.test(result.stdout))throw Error('Mutation was not caught by assertions: '+name);
  console.log('CAUGHT: '+name);
 }finally{await writeFile(path,original);}
}
console.log('PASS: all '+mutations.length+' packaging mutations caught. Evidence: '+work);
