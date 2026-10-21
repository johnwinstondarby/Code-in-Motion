import {cp,mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),work=resolve(process.env.CIM_COMPOSITION_MUTATION_WORK??resolve(root,'../composition-mutations')),browser=process.argv.includes('--browser');await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const cases=[
 ['CMP-16-final-seek','src/multipane/motion.mjs',"if(check())return;","/* redundant final seek allowed */",'CMP-16'],
 ['CMP-05-invented-id','src/multipane/engineering.mjs','.map(f=>({...f})),absent:',".map(f=>({...f,id:'invented-flow'})),absent:",'CMP-05'],
 ['CMP-15-retired-pause','src/multipane/motion.mjs','target.onplay=pauseRetiredPlay;target.onplaying=pauseRetiredPlaying;','/* native retirement guards omitted */','CMP-15'],
 ['CMP-15-seek-reset','src/multipane/motion.mjs',"target.pause();target.removeAttribute('src');}","target.pause();target.removeAttribute('src');target.load();}",'CMP-15'],
 ['CMP-14-file-caption','authoring/v3/media-files.mjs','...(clip.webm?', '...(false?', 'CMP-14'],
 ['CMP-01-caption','src/multipane/media-map.mjs',"total+=descriptor(w?.captions,path+'.webm.captions',true);",'/* webm captions unchecked */','CMP-01'],
 ['CMP-02-total','src/multipane/media-map.mjs',"total+=descriptor({...w,alt:d.alt},path+'.webm');","descriptor({...w,alt:d.alt},path+'.webm');",'CMP-02'],
 ['CMP-02-duration','src/multipane/media-map.mjs','Math.abs(d.duration-w.duration)>0.2','false','CMP-02'],
 ['CMP-03-diagnostic','authoring/v3/validate.mjs',"...d,path:kind==='media'", "...d,id:'CIM-V3-MEDIA-DEFERRED',path:kind==='media'",'CMP-03'],
 ['CMP-05-arrow','src/multipane/engineering.mjs',"f.from!==null&&f.from!==f.to","true",'CMP-05'],
 ['CMP-06-wording','src/multipane/engineering.mjs','`${f.artifact} stayed at ${f.to}`','`${f.artifact}: ${f.from} → ${f.to}`','CMP-06'],
 ['CMP-13-missing','src/multipane/engineering.mjs',"const r=records.get(recordId);if(!r||", "const r=records.get(recordId);if(!r){Object.assign(state,structuredClone(beat.state));continue;}if(",'CMP-13'],
];
if(browser)cases.push(
 ['CMP-07-hidden','src/multipane/action-surface.mjs',"panel.setAttribute('aria-hidden',String(inactive));panel.inert=inactive;","panel.removeAttribute('aria-hidden');panel.inert=false;",'CMP-07','browser'],
 ['CMP-07-duplicate','src/multipane/composition.mjs','showMotionHeading:false','showMotionHeading:true','CMP-07','browser'],
 ['CMP-08-details','src/multipane/motion.mjs',"{'data-media-details':''}","{'data-media-details':'',open:''}",'CMP-08','browser'],
 ['CMP-09-choice','src/multipane/motion.mjs',".filter(([,d])=>probe.canPlayType(mime(d.type))!=='')",'.filter(()=>true)','CMP-09','browser'],
 ['CMP-10-second-hash','src/multipane/motion-media.mjs','if(actual!==descriptor.sha256)',"if(actual!==descriptor.sha256&&!url.endsWith('.webm'))",'CMP-10','browser'],
 ['CMP-09-webm-caption','src/multipane/motion-media.mjs','captions=await verified(clip.captions,controller.signal)',"captions=copy==='webm'?new Uint8Array():await verified(clip.captions,controller.signal)",'CMP-09','browser'],
 ['CMP-11-cues','src/multipane/engineering.mjs','`${cues[a.status]} ${a.id}: ${a.status}`','a.id','CMP-11','browser'],
 ['CMP-12-deadline','src/multipane/motion.mjs','if(index+1>=choices.length||signal.aborted||performance.now()>=deadline)throw error;','if(index+1>=choices.length||signal.aborted||performance.now()>=deadline)throw error; deadline=performance.now()+timeoutMs;','CMP-12','browser']
);
const run=(rule,kind='unit')=>spawnSync(process.execPath,kind==='browser'?[resolve(root,'node_modules/@playwright/test/cli.js'),'test','tests/e2e/composition.spec.mjs','--grep',`1366x768.*${rule??'CMP-'}`,'--workers=1','--reporter=line','--timeout=18000','--output='+resolve(work,'browser-results')]:['--test',...(rule?['--test-name-pattern',`\\[${rule}\\]`]:[]),'tests/composition.test.mjs'],{cwd:sandbox,encoding:'utf8',timeout:180000});
for(const kind of browser?['unit','browser']:['unit']){const baseline=run(null,kind);await writeFile(resolve(work,'baseline-'+kind+'.log'),baseline.stdout+baseline.stderr);if(baseline.status!==0)throw new Error('Composition baseline failed: '+baseline.stdout+baseline.stderr);}
const results=[];
for(const[id,file,from,to,rule,kind='unit']of cases){const path=resolve(sandbox,file),original=await readFile(path,'utf8');if(!original.includes(from))throw new Error('Missing probe target '+id);let result;try{let mutated=original.replaceAll(from,to);if(id==='CMP-16-final-seek')mutated=mutated.replace('if(!target.seeking||Math.abs(target.currentTime-target.duration)>=0.15)target.currentTime=target.duration;','target.currentTime=target.duration;');if(id==='CMP-13-missing')mutated=mutated.replace("if(canonical(state)!==canonical(beat.state))fail('Claimed state differs from capture-derived state.');",'').replace("if(used.size!==records.size)fail('Unused capture record.');",'');if(id==='CMP-12-deadline')mutated=mutated.replace('const requestController=io,deadline=performance.now()+timeoutMs;','const requestController=io;let deadline=performance.now()+timeoutMs;').replace('},timeoutMs);','},timeoutMs*3);');await writeFile(path,mutated);result=run(rule,kind);}finally{await writeFile(path,original);}const output=result.stdout+result.stderr,caught=result.status!==0&&/ERR_ASSERTION|AssertionError|Error: expect\(|Error: expect\.poll/.test(output)&&!/SyntaxError|ReferenceError|TypeError: Assignment to constant/.test(output);await writeFile(resolve(work,id+'.log'),output);if(!caught)throw new Error('Probe survived or crashed: '+id+'\n'+output);results.push({id,rule,caught});}
console.log(JSON.stringify({node:process.version,browser:browser?(process.env.CIM_PLAYER_BROWSER??'chromium'):null,baseline:'passed',results},null,2));
