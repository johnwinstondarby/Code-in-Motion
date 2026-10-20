import {cp,mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),work=resolve(root,'../motion-mutations'),browser=process.argv.includes('--browser');await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const map='src/multipane/media-map.mjs',access='src/multipane/motion-media.mjs',barrier='src/multipane/media-barrier.mjs',pane='src/multipane/motion.mjs';
const cases=[
 ['MOT-01-source',map,'const source=(s,path)=>{','const source=(s,path)=>{return;','MOT-01'],
 ['MOT-01-type',map,"if(!(caption?d.type==='text/vtt':['video/webm','video/mp4'].includes(d.type)))",'if(false)','MOT-01'],
 ['MOT-01-total',map,'if(total>MEDIA_LIMITS.total)','if(false)','MOT-01'],
 ['MOT-02-original-address',access,'{videoURL,captionURL,duration:','{videoURL:bindings.get(clip.source.type===\'pack\'?\'pack:\'+clip.source.path:\'attachment:\'+clip.source.id),captionURL,duration:','MOT-02'],
 ['MOT-02-caption-bytes',access,'await verified(clip.captions,controller.signal)','new Uint8Array()','MOT-02'],
 ['MOT-03-digest',access,'if(actual!==descriptor.sha256)throw unavailable();','if(false)throw unavailable();','MOT-03'],
 ['MOT-04-resolver',access,"if(url.origin!==origin||!url.pathname.startsWith('/__cim_fixture_media/')||url.username||url.password||url.search||url.hash)",'if(false)','MOT-04'],
 ['MOT-05-timeout',access,'controller.abort();reject(unavailable());},timeoutMs)','controller.abort();},timeoutMs)','MOT-05'],
 ['MOT-05-late-copy',access,'if(disposed||controller.signal.aborted||finished)throw unavailable();','if(false)throw unavailable();','MOT-05'],
 ['MOT-06-readiness',barrier,'const next=intent&&holds.size===0','const next=intent','MOT-06'],
 ['MOT-06-user-pause',barrier,'pause(){intent=false','pause(){intent=true','MOT-06'],
 ['MOT-11-map-open','authoring/v3/validate.mjs',"if(doc.media.status==='fixture'){",'if(false){','MOT-11'],
 ['MOT-12-schema','authoring/v3/validate.mjs','media: mediaSchema','media: undefined','MOT-12'],
 ['MOT-13-file-digest','authoring/v3/media-files.mjs',"if(createHash('sha256').update(bytes.subarray(0,count)).digest('hex')!==descriptor.sha256)",'if(false)','MOT-13'],
 ['MOT-14-link','authoring/v3/media-files.mjs','!inside(root,file)','false','MOT-14'],
 ['MOT-20-unprepared-fallback',pane,'fallback(descriptor?.alt??state?.alt);','/* missing pre-verification fallback */','MOT-20'],
 ['MOT-19-label',pane,"placeholder?'Placeholder GUI · simulated':'Recorded in the lab'","'Recorded in the lab'",'MOT-19'],
 ['MOT-15-capability',pane,'const pane=Object.freeze({mount','const pane=Object.freeze({host:globalThis,mount','MOT-15'],
 ['MOT-15-network',pane,"const code=","const generalRequest=()=>fetch('https://example.invalid'); const code=",'MOT-15'],
];
if(browser)cases.push(
 ['MOT-07-captions',pane,"default:'',src:loaded.captionURL",'src:loaded.captionURL','MOT-07','browser'],
 ['MOT-07-end',pane,"task.finish({status:'settled'})",'/* completion omitted */void 0','MOT-07','browser'],
 ['MOT-08-reduced',pane,'if(context.reducedMotion)return','if(false)return','MOT-08','browser'],
 ['MOT-09-fallback',pane,"element('p','GUI recording unavailable')","element('p','Loading recording')",'MOT-09','browser'],
 ['MOT-09-stall','harness/motion-test-driver.mjs',"return{status:'failed',error};","return new Promise(()=>{});",'MOT-09','browser'],
 ['MOT-10-buffer-finished',pane,"listen('waiting',()=>{if(done||finalising)return;emit(true);","listen('waiting',()=>{if(done||finalising)return;task.finish({status:'settled'});",'MOT-10','browser'],
 ['MOT-18-native-guard',pane,'if(!authorizedPlayback)nextVideo.pause();','/* unauthorized native playback allowed */','MOT-18','browser'],
 ['MOT-17-stale',pane,'if(!disposed&&revision===token&&!signal.aborted)','if(!disposed)','MOT-17','browser'],
 ['MOT-16-preparation','harness/motion-test-driver.mjs',"barrier.hold('preparation');",'/* preparation hold omitted */','MOT-16','browser']
);
const run=(rule,kind='unit')=>spawnSync(process.execPath,kind==='browser'?[resolve(root,'node_modules/@playwright/test/cli.js'),'test','tests/e2e/motion-pane.spec.mjs','--grep',`1366x768.*${rule??'MOT-'}`,'--workers=1','--reporter=line','--timeout=12000','--output='+resolve(work,'browser-results')]:['--test',...(rule?['--test-name-pattern',`\\[${rule}\\]`]:[]),'tests/motion-media.test.mjs','tests/motion-authoring.test.mjs'],{cwd:sandbox,encoding:'utf8',timeout:180000});
for(const kind of browser?['unit','browser']:['unit']){const baseline=run(null,kind);await writeFile(resolve(work,'baseline-'+kind+'.log'),baseline.stdout+baseline.stderr);if(baseline.status!==0)throw new Error('Motion mutation baseline failed: '+baseline.stdout+baseline.stderr);}
const results=[];
for(const[id,file,from,to,rule,kind='unit']of cases){const path=resolve(sandbox,file),original=await readFile(path,'utf8');if(!original.includes(from))throw new Error('Missing probe target '+id);let result;try{let mutated=original.replaceAll(from,to);if(id==='MOT-18-native-guard')mutated=mutated.replace('if(!done&&!clockRunning)pinPause();','/* late native start permitted */').replace('if(!clockRunning)pinPause();else ','');if(id==='MOT-07-captions')mutated=mutated.replace("track.track.mode='showing'","track.track.mode='disabled'");if(id==='MOT-16-preparation')mutated=mutated.replace("if(buffering)barrier.hold('buffering')",'if(buffering)void 0');if(id==='MOT-14-link')mutated=mutated.replaceAll('!inside(root,resolved)','false');await writeFile(path,mutated);result=run(rule,kind);}finally{await writeFile(path,original);}const output=result.stdout+result.stderr,caught=result.status!==0&&/ERR_ASSERTION|AssertionError|Error: expect\(|Error: expect\.poll/.test(output)&&!/SyntaxError|ReferenceError/.test(output);await writeFile(resolve(work,id+'.log'),output);if(!caught)throw new Error('Probe survived or crashed: '+id+'\n'+output);results.push({id,rule,caught});}
console.log(JSON.stringify({node:process.version,browser:browser?(process.env.CIM_PLAYER_BROWSER??'chromium'):null,baseline:'passed',results},null,2));
