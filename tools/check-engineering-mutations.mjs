import {cp,mkdtemp,mkdir,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),work=resolve(root,'../engineering-mutations');await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));
await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const pane='src/multipane/engineering.mjs';
const cases=[
 ['ENG-01-ids',pane,'id:s.id,host:s.host',"id:'renamed',host:s.host",'ENG-01'],
 ['ENG-01-derived',pane,"if(canonical(state)!==canonical(beat.state))fail('Claimed state differs from capture-derived state.');",'/* dishonest claimed state accepted */','ENG-01'],
 ['ENG-02-label',pane,"'Diagram · modeled'","'Diagram'",'ENG-02'],
 ['ENG-02-placeholder',pane,'if(config.placeholder)frame.append','if(false)frame.append','ENG-02'],
 ['ENG-03-final',pane,'draw(target,diagramSnapshot(c,context.stepId),c);','draw(target,diagramSnapshot(c,context.stepId),c,0.5);','ENG-03'],
 ['ENG-03-reduced',pane,'lifecycle.play(state,context)','lifecycle.play(state,{...context,reducedMotion:false})','ENG-03'],
 ['ENG-04-text',pane,"verified:'custody verified'","verified:''",'ENG-04'],
 ['ENG-05-evidence',pane,'raw evidence: ${f.evidence}','raw evidence: unavailable','ENG-05'],
 ['ENG-06-wait',pane,'Waiting on next diagram action','Idle diagram','ENG-06'],
 ['ENG-07-fallback',pane,'const showError=()=>draw(root,null,config,null,true);','const showError=()=>root.replaceChildren();','ENG-07'],
 ['ENG-08-size','src/multipane/engineering.css','font-size:14px','font-size:8px','ENG-08'],
 ['ENG-09-leak',pane,'return Object.freeze({mount','return Object.freeze({host:globalThis,mount','ENG-09'],
 ['ENG-09-network',pane,'const statuses=',"const request = () => fetch('https://example.invalid'); const statuses=",'ENG-09'],
 ['ENG-09-guard',pane,"if(data.fixtureOnly!==true)throw new TypeError('Engineering requires a test fixture.');",'/* fixture admission removed */','ENG-09'],
];
const run=rule=>spawnSync(process.execPath,['--test',...(rule?['--test-name-pattern',`\\[${rule}\\]`]:[]),'tests/engineering-pane.test.mjs'],{cwd:sandbox,encoding:'utf8',timeout:30000});
let r=run();if(r.status!==0)throw new Error('Baseline failed: '+r.stdout+r.stderr);const results=[];
for(const[id,file,from,to,rule]of cases){const path=resolve(sandbox,file),original=await readFile(path,'utf8');if(!original.includes(from))throw new Error('Missing target '+id);try{await writeFile(path,original.replaceAll(from,to));r=run(rule);}finally{await writeFile(path,original);}const output=r.stdout+r.stderr,caught=r.status!==0&&/ERR_ASSERTION|AssertionError/.test(output)&&!/SyntaxError|ReferenceError/.test(output);results.push({id,rule,caught});if(!caught)throw new Error('Probe survived or crashed: '+id+'\n'+output);}
if(process.argv.includes('--browser')){
 const browserRun=()=>spawnSync(process.execPath,[resolve(root,'node_modules/@playwright/test/cli.js'),'test','tests/e2e/engineering-pane.spec.mjs','--grep','ENG-08-FLOW','--reporter=line','--workers=1','--output='+resolve(work,'browser-results')],{cwd:sandbox,encoding:'utf8',timeout:90000});
 let baseline=browserRun();if(baseline.status!==0)throw new Error('Flow browser baseline failed: '+baseline.stdout+baseline.stderr);
 const path=resolve(sandbox,pane),original=await readFile(path,'utf8'),from='frame.append(flow);frame.append(evidence);frame.append(grid);';
 if(!original.includes(from))throw new Error('Missing flow order mutation target');
 try{await writeFile(path,original.replace(from,'frame.append(grid);frame.append(flow);frame.append(evidence);'));r=browserRun();}finally{await writeFile(path,original);}
 const caught=r.status!==0&&/toBeLessThanOrEqual/.test(r.stdout+r.stderr);if(!caught)throw new Error('Flow visibility mutation survived or failed for another reason: '+r.stdout+r.stderr);results.push({id:'ENG-08-flow-order',rule:'ENG-08',caught});
}
console.log(JSON.stringify({node:process.version,baseline:'passed',results},null,2));
