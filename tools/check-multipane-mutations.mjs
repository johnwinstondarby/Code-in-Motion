import {cp,mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const arg=process.argv.find(a=>a.startsWith('--work-directory='));
const work=resolve(arg?.slice(17)??resolve(root,'../multipane-mutations'));
const browser=process.argv.includes('--browser');
await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));
await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});
await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const model='src/multipane/model.mjs',session='src/multipane/session.mjs',view='src/multipane/controls.mjs';
// Each probe removes one production behavior; the public code has no rule bypass.
const cases=[
 ['MP-01-tab',model,"const tab=mode==='sequential'&&contextOnly?s.tab:snapshot.action_tab;","const tab=mode==='sequential'&&contextOnly?s.tab:consoleId;",'MP-01'],
 ['MP-01-completion-tab',model,"progress:'settled',playing:false,failures:","progress:'settled',playing:false,tab:doc.steps[s.index].state.action_tab,failures:",'MP-01'],
 ['MP-02-view-only',model,'present({...s,tab:event.tab})','present({...s,tab:event.tab,playing:false})','MP-02'],
 ['MP-03-pause-tab',model,"case 'pause':return s.playing?present({...s,playing:false}):s;","case 'pause':return s.playing?present({...s,playing:false,tab:consoleId}):s;",'MP-03'],
 ['MP-03-resume-tab',model,'return s.playing?s:present({...s,playing:true});','return s.playing?s:present({...s,playing:true,tab:consoleId});','MP-03'],
 ['MP-03-clock',session,'else active.driver.pause();','else { /* clock left running */ }','MP-03'],
 ['MP-04-next',model,"progress:'settled',playing:false,generation:s.generation+1","progress:'settled',playing:false,tab:consoleId,generation:s.generation+1",'MP-04'],
 ['MP-05-held-state',model,'panes:snapshot.panes','panes:contextOnly?doc.initial_state.panes:snapshot.panes','MP-05'],
 ['MP-06-initial-default',model,'?s.tab:snapshot.action_tab;','?s.tab:(index===0&&contextOnly?motionId:snapshot.action_tab);','MP-06'],
 ['MP-07-context-override',model,"mode==='sequential'&&contextOnly?s.tab:snapshot.action_tab","snapshot.action_tab",'MP-07'],
 ['MP-08-reconstruction',model,'panes:snapshot.panes','panes:s.panes','MP-08'],
 ['MP-08-pane-wiring',session,'for(const id of ids)panes[id].settle','for(const id of ids)if(index<0||id!==\'motion\')panes[id].settle','MP-18'],
 ['MP-09-start',model,"case 'start':return enter(s,-1,'direct');","case 'start':return enter(s,0,'direct');",'MP-09'],
 ['MP-10-restart',model,"case 'restart':return enter(s,0,'direct',true);","case 'restart':return enter(s,0,'direct',false);",'MP-10'],
 ['MP-10-reset',session,"event.type==='restart'?experience.initial_state:snapshot(before.index)",'snapshot(before.index)','MP-10'],
 ['MP-11-open',model,'present({...s,panelOpen:true})','present({...s,panelOpen:true,playing:false})','MP-11'],
 ['MP-12-close',model,'present({...s,panelOpen:false})','present({...s,panelOpen:false,tab:consoleId})','MP-12'],
 ['MP-13-status',model,'Start · ${doc.steps.length} beats','Start · ${doc.steps.length} beats · paused','MP-13'],
 ['MP-17-stale-completion',model,"if(event.generation!==s.generation||s.progress!=='active')return s;",'// stale completion admitted','MP-17'],
 ['MP-18-late-results',session,'if(disposed||active?.generation!==generation||state.generation!==generation)return;','if(disposed)return;','MP-18'],
 ['MP-19-reduced-motion',session,'reducedMotion:options.reducedMotion===true','reducedMotion:false','MP-19'],
 ['MP-20-fixture-guard',model,"if(testFixture!==true)throw new TypeError('Multi-pane transport requires an explicit test fixture.');",'// activation guard removed','MP-20'],
 ['MP-20-packaging','tools/build-wordpress-release.mjs'," && !source.startsWith('src/multipane/')",'','MP-20'],
 ['MP-21-dispose',session,"if(disposed)throw new Error('Multi-pane session is disposed.');",'// stale commands allowed','MP-21'],
 ['MP-22-all-panes',session,'Promise.all(work)','Promise.all(work.slice(0,1))','MP-22'],
 ['MP-22-failure',session,"results.filter(r=>r.status==='failed')",'results.filter(()=>false)','MP-22'],
];
if(browser)cases.push(
 ['MP-01-focus',view,"tabs[i].setAttribute('aria-selected',String(selected));","if(selected&&state.playing)tabs[i].focus();tabs[i].setAttribute('aria-selected',String(selected));",'MP-01','browser'],
 ['MP-11-current',view,"node.setAttribute('aria-current','step')","node.removeAttribute('aria-current')",'MP-11','browser'],
 ['MP-12-focus-return',view,'if(!disposed)beats.focus({preventScroll:true});','/* focus return omitted */','MP-12','browser'],
 ['MP-13-tooltip',view,"playback.setAttribute('title',label);",'/* stale tooltip */','MP-13','browser'],
 ['MP-14-roving',view,'tabs[i].tabIndex=selected?0:-1','tabs[i].tabIndex=0','MP-14','browser'],
 ['MP-15-keyboard',view,"if(event.key==='ArrowLeft')to=(index+tabs.length-1)%tabs.length;","if(event.key==='ArrowLeft')to=index;",'MP-15','browser'],
 ['MP-16-selection','src/multipane/controls.css','user-select:text','user-select:none','MP-16','browser'],
 ['MP-21-view-dispose',view,'root.replaceChildren();root.classList.remove','/* root retained */root.classList.remove','MP-21','browser']
);
const run=(rule,kind)=>{
 const args=kind==='browser'?[resolve(root,'node_modules/@playwright/test/cli.js'),'test','tests/e2e/multipane-transport.spec.mjs','--grep',`1366x768.*${rule??'MP-'}`,'--timeout=10000','--reporter=line','--output='+resolve(work,'browser-results')]:['--test',...(rule?['--test-name-pattern',`\\[${rule}\\]`]:[]),'tests/multipane-transport.test.mjs'];
 return spawnSync(process.execPath,args,{cwd:sandbox,encoding:'utf8',timeout:180000});
};
for(const kind of browser?['unit','browser']:['unit']){
 const result=run(null,kind);await writeFile(resolve(work,'baseline-'+kind+'.log'),result.stdout+result.stderr);
 if(result.status!==0)throw new Error('Mutation baseline failed: '+result.stdout+result.stderr);
}
const results=[];
for(const [id,file,from,to,rule,kind='unit']of cases){
 const path=resolve(sandbox,file),original=await readFile(path,'utf8'),text=original.replaceAll('\r\n','\n');
 if(!text.includes(from))throw new Error('Missing mutation target: '+id);
 let result;try{await writeFile(path,text.replace(from,to));result=run(rule,kind);}finally{await writeFile(path,original);}
 const log=result.stdout+result.stderr;await writeFile(resolve(work,id+'.log'),log);
 const assertion=kind==='browser'?/expect\(.*\)|Expected:|Received:/.test(log):/AssertionError|ERR_ASSERTION/.test(log);
 if(result.error||result.status===0||!assertion||/TypeError:|ReferenceError:|SyntaxError:/.test(log))throw new Error('Probe did not fail by the protected assertion: '+id+'\n'+log);
 results.push({id,rule,kind,caught:true});console.log('CAUGHT '+id);
}
await writeFile(resolve(work,'results.json'),JSON.stringify({node:process.versions.node,browser:browser?(process.env.CIM_PLAYER_BROWSER??'chromium'):null,results},null,2)+'\n');
console.log(`PASS: ${results.length} multi-pane mutations caught.`);
