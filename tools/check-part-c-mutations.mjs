// ADR 0061 step 7 Part C mutation guards: each deliberate break of an admission rule
// must fail an assertion in its named test after the baselines pass. Crashes and timeouts are never catches.
import {cp,mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),work=resolve(process.env.CIM_PART_C_MUTATION_WORK??resolve(root,'../part-c-mutations')),browser=process.argv.includes('--browser');
await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const admission='src/multipane/admission.mjs',php='wordpress/lesson-packs.php',unit='tests/part-c-admission.test.mjs',phpTest='tests/part-c-php-discovery.test.mjs';
const cases=[
 ['PCM-01-interval',admission,'if(compare(effective,doc.engine_min)<0)fail(','if(false)fail(','PC-01',unit],
 ['PCM-02-forged-identity',admission,'const effective=object(identity)?issuedIdentities.get(identity):undefined;',"const effective=object(identity)?issuedIdentities.get(identity)??'1.1.0':undefined;",'PC-03',unit],
 ['PCM-03-real-capture',admission,"records.records.some(r=>r?.provenance!=='placeholder')",'false','PC-04',unit],
 ['PCM-04-non-placeholder',admission,"if(config?.placeholder?.enabled!==true||",'if(false&&','PC-04',unit],
 ['PCM-05-unbound-token',admission,'return bound!==undefined&&bound.experience===JSON.stringify(experience);','return bound!==undefined;','PC-06',unit],
 ['PCM-06-model-guard','src/multipane/model.mjs',"if(testFixture!==true&&!isAdmittedExperience(admission,readonlyPaneData(experience)))throw",'if(false)throw','PC-06',unit],
 ['PCM-07-engineering-guard',admission,'return bound!==undefined&&bound.engineering===JSON.stringify(config);','return true;','PC-07',unit],
 ['PCM-08-codec-ignored','src/multipane/motion.mjs','return d.codec?`${d.type}; codecs="${d.codec}"`:','return false?`${d.type}; codecs="${d.codec}"`:','PC-09',unit],
 ['PCM-09-codec-optional','src/multipane/media-map.mjs',"if(pack&&(typeof d.codec!=='string'||",'if(pack&&false&&(','PC-08',unit],
 ['PCM-10-trace-unbounded','src/multipane/motion-coordinator.mjs','if(events.length>limit)events.splice(0,events.length-limit);','','PC-10',unit],
 ['PCM-11-note-every-frame','src/multipane/engineering.mjs',"announce?{role:'status','aria-live':'polite','data-diagram-capacity-note':''}:{'data-diagram-capacity-note':''}","{role:'status','aria-live':'polite','data-diagram-capacity-note':''}",'PC-11',unit],
 ['PCM-12-php-any-constant',php,"defined( 'LOCALIS_CIM_DEVELOPMENT_ADMISSION' ) && '1.1.0-dev' === LOCALIS_CIM_DEVELOPMENT_ADMISSION","defined( 'LOCALIS_CIM_DEVELOPMENT_ADMISSION' ) && LOCALIS_CIM_DEVELOPMENT_ADMISSION",'PC-PHP-03',phpTest],
 ['PCM-13-php-after-release',php,"&& version_compare( LOCALIS_CIM_PLUGIN_VERSION, '1.1.0', '<' );",';','PC-PHP-03',phpTest],
 ['PCM-14-php-hash',php,"|| ! hash_equals( $sha, (string) hash_file( 'sha256', $file ) )",'','PC-PHP-04',phpTest],
 ['PCM-15-php-confinement',php,"! $file || 0 !== strpos( $file, $directory . DIRECTORY_SEPARATOR ) ||",'! $file ||','PC-PHP-04',phpTest],
 ['PCM-16-php-placeholder',php,"if ( true !== ( $manifest['placeholder'] ?? null ) ) {",'if ( false ) {','PC-PHP-05',phpTest],
 ['PCM-17-php-interval',php,"if ( version_compare( $host, $manifest['cim_min'], '<' ) ||",'if ( false ||','PC-PHP-01',phpTest],
 ['PCM-18-boundary-authoring','tools/check-production-admission-boundary.mjs',"target=>target==='authoring'||target.startsWith('authoring/')",'()=>false','PC-B-02','tests/part-c-boundary.test.mjs'],
 ['PCM-19-boundary-fixture','tools/check-production-admission-boundary.mjs',"if(/\\btestFixture\\s*:\\s*true\\b/.test(code))",'if(false)','PC-B-02','tests/part-c-boundary.test.mjs'],
 ['PCM-20-admin-legacy-path','wordpress/assets/lesson-pack-admin.mjs','if (agreement === PANES_AGREEMENT) {','if (false) {','PC-ADMIN-01','tests/part-c-admin.test.mjs'],
 ['PCM-24-projection-skipped',admission,' if(projection)fail(projection);\n','\n','PC-12',unit],
 ['PCM-25-projection-tab','src/multipane/projection.mjs','  if(snapshot.action_tab!==expected.action_tab)return','  if(false)return','PC-12',unit],
 ['PCM-26-projection-waiting','src/multipane/projection.mjs','ids.some(id=>snapshot.waiting[id]!==expected.waiting[id])','false','PC-12',unit],
 ['PCM-27-projection-layout','src/multipane/projection.mjs',"&&panes.find(p=>p.id===id).type===type",'','PC-12',unit],
 ['PCM-28-projection-explanation','src/multipane/projection.mjs',"for(const id of ['console','motion','explanation'])","for(const id of ['console','motion'])",'PC-12',unit],
 ['PCM-30-read-deadline','wordpress/assets/panes-binding.mjs','const timer=setTimeout(expire,timeoutMs)','const timer=0','PC-14','tests/part-c-binding.test.mjs'],
 ['PCM-31-read-deadline-body','wordpress/assets/panes-binding.mjs','await within(reader.read())','await reader.read()','PC-15','tests/part-c-binding.test.mjs'],
 ['PCM-21-browser-fingerprint','wordpress/assets/panes-binding.mjs',"if(actual!==expected)throw new TypeError('Pack JSON differs from its verified fingerprint.');",'','PC-E2E-04','browser'],
 ['PCM-23-browser-containment','wordpress/assets/cim.css','  padding: 0;\n  overflow-x: auto;\n','  padding: 0;\n','PC-E2E-01','browser'],
 ['PCM-22-browser-legacy-overlap','wordpress/assets/bootstrap-module.mjs','querySelectorAll: (selector) => Array.from(document.querySelectorAll(selector)).filter((root) => !isPanesRoot(root))','querySelectorAll: (selector) => document.querySelectorAll(selector)','PC-E2E-01','browser']
 ,['PCM-32-browser-legacy-waits','wordpress/assets/bootstrap-module.mjs','  const result = await host.mount();','  await Promise.all(panesMounts);\n  const result = await host.mount();','PC-E2E-06','browser']
 ,['PCM-33-browser-panes-serial','wordpress/assets/bootstrap-module.mjs','.filter(isPanesRoot).map((root) => mountPanesRoot(root));','.filter(isPanesRoot).reduce((chain, root) => chain.then(() => mountPanesRoot(root)), Promise.resolve());','PC-E2E-06','browser']
 ,['PCM-34-browser-shared-ids','src/multipane/composition.mjs',"const instanceId='cim-player-'+(++mounted);","const instanceId='composed';",'PC-E2E-07','browser']
];
const run=(rule,file)=>spawnSync(process.execPath,file==='browser'?[resolve(root,'node_modules/@playwright/test/cli.js'),'test',...(process.env.CIM_PART_C_PLAYWRIGHT_CONFIG?['-c',process.env.CIM_PART_C_PLAYWRIGHT_CONFIG]:[]),'tests/e2e/part-c-wordpress-panes.spec.mjs',...(rule?['--grep',`\\[${rule}\\]`]:[]),'--workers=1','--reporter=line','--output='+resolve(work,'browser-results')]:['--test',...(rule?['--test-name-pattern',`\\[${rule}\\]`]:[]),...(file?[file]:['tests/part-c-admission.test.mjs','tests/part-c-php-discovery.test.mjs','tests/part-c-boundary.test.mjs','tests/part-c-admin.test.mjs','tests/part-c-binding.test.mjs'])],{cwd:sandbox,encoding:'utf8',timeout:180000});
const results=[];
for(const kind of browser?['unit','browser']:['unit']){
 const baseline=run(null,kind==='browser'?'browser':null);await writeFile(resolve(work,'baseline-'+kind+'.log'),baseline.stdout+baseline.stderr);
 if(baseline.status!==0)throw new Error('Part C mutation baseline failed: '+baseline.stdout+baseline.stderr);
 for(const [id,file,from,to,rule,test] of cases){
  if((test==='browser')!==(kind==='browser'))continue;
  const path=resolve(sandbox,file),original=await readFile(path,'utf8');
  if(original.split(from).length!==2)throw new Error('Missing or ambiguous Part C mutation target: '+id);
  let result;try{await writeFile(path,original.replace(from,to));result=run(rule,test);}finally{await writeFile(path,original);}
  const output=result.stdout+result.stderr;
  const caught=result.status!==0&&result.signal===null&&!result.error&&/ERR_ASSERTION|AssertionError|Error: expect\(|Error: expect\.poll/.test(output)&&!/SyntaxError|ReferenceError|Test timeout of|worker process exited/.test(output);
  await writeFile(resolve(work,kind+'-'+id+'.log'),output);
  if(!caught)throw new Error('Part C mutation survived or crashed: '+id+'\n'+output);
  results.push({id,kind,rule,caught});
 }
}
console.log(JSON.stringify({node:process.version,browser:browser?(process.env.CIM_PLAYER_BROWSER??'chromium'):null,baselines:'passed',results},null,2));
