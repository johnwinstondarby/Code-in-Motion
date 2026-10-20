import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const arg=process.argv.find(a=>a.startsWith('--work-directory='));
const work=resolve(arg?.slice(17)??resolve(root,'../pane-mutations'));
await mkdir(work,{recursive:true});
const sandbox=await mkdtemp(resolve(work,'candidate-'));
await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});
await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const contract='src/contracts/pane.mjs';
const cases=[
  ['stale-callback',contract,'if (finished || disposed || active !== task) return;','// stale callback admitted','stale completion after cancellation'],
  ['capability-leak',contract,"return Object.freeze({ stepId: context.stepId, stepRendererConfig:","return Object.freeze({ ...context, stepId: context.stepId, stepRendererConfig:",'projection cannot expose'],
  ['missed-dispose',contract,"cancel('disposed');","// active transition retained",'dispose finishes active work'],
  ['retained-listener',contract,'        unsubscribe();','        // abort listener retained','stale completion after cancellation'],
  ['renderer-missed-dispose','src/renderers/subjects/console/renderer.mjs','  function dispose() {\n    pane?.dispose(); pane = null;','  function dispose() {\n    pane = null;','renderer disposal forwards']
];
const run=name=>spawnSync(process.execPath,['--test',...(name?['--test-name-pattern',name]:[]),'tests/pane-contract.test.mjs'],{cwd:sandbox,encoding:'utf8',timeout:120000});
const baseline=run();
await writeFile(resolve(work,'baseline.log'),baseline.stdout+baseline.stderr);
if(baseline.status!==0)throw new Error('Pane mutation baseline failed: '+baseline.stdout+baseline.stderr);
const results=[];
for(const [id,file,from,to,name] of cases){
  const path=resolve(sandbox,file),original=await readFile(path,'utf8'),text=original.replaceAll('\r\n','\n');
  if(!text.includes(from))throw new Error('Missing mutation target: '+id);
  let result;
  try{await writeFile(path,text.replace(from,to));result=run(name);}finally{await writeFile(path,original);}
  const log=result.stdout+result.stderr;await writeFile(resolve(work,id+'.log'),log);
  if(result.error||result.status===0||!/AssertionError|ERR_ASSERTION/.test(log)||/TypeError:|ReferenceError:|SyntaxError:/.test(log))throw new Error('Probe did not fail through its intended assertion: '+id+'\n'+log);
  results.push({id,caught:true,test:name});console.log('CAUGHT '+id);
}
await writeFile(resolve(work,'results.json'),JSON.stringify({node:process.versions.node,results},null,2)+'\n');
console.log(`PASS: ${results.length} pane contract mutations caught.`);
