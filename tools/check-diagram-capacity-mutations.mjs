import {cp,mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),work=resolve(process.env.CIM_CAPACITY_MUTATION_WORK??resolve(root,'../capacity-mutations')),browser=process.argv.includes('--browser');
await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const pane='src/multipane/engineering.mjs';
const cases=[
 ['CAP-M01-fixed',pane,'const height=bottom+footer.lines.length*14+8;','const height=190; for(const [i,n] of nodes.entries()){n.y=20+Math.floor(i/4)*76;n.height=72;}','CAP-01'],
 ['CAP-M02-gate',pane,"const within=reason==='';",'const within=true;','CAP-02'],
 ['CAP-M02-height',pane,'height>DIAGRAM_CAPACITY.maxHeight','false','CAP-04'],
 ['CAP-M03-note',pane,"if(graphical&&geometry.mode==='text')frame.append",'if(false)frame.append','CAP-02',false],
 ['CAP-M04-truncate',pane,'text.slice(i*size,(i+1)*size)','text.slice(i*size,(i+1)*size).slice(0,10)','CAP-04',true,'CAP-06'],
 ['CAP-M05-description',pane,'Object.entries(snapshot.state.artifacts).map(([id,a])=>','Object.entries(snapshot.state.artifacts).slice(0,2).map(([id,a])=>','CAP-05'],
 ['CAP-M06-always-text',pane,"const within=reason==='';",'const within=false;','CAP-04'],
 ['CAP-M07-slot-overflow','src/multipane/engineering.css','.engineering-graph{overflow:visible}', '.engineering-graph{overflow:hidden}','CAP-01',false],
 ['CAP-M07-svg-overflow','src/multipane/composition.css','max-height:none;overflow:visible','max-height:none;overflow:hidden','CAP-01',false],
 ['CAP-M08-unrouted-token',pane,'const points=edge.points;','const points=[edge.fromCenter,edge.toCenter];','CAP-07']
];
const run=(rule,kind)=>spawnSync(process.execPath,kind==='unit'?['--test',...(rule?['--test-name-pattern',`\\[${rule}\\]`]:[]),'tests/diagram-capacity.test.mjs']:[resolve(root,'node_modules/@playwright/test/cli.js'),'test','tests/e2e/diagram-capacity.spec.mjs','--grep',`1366x768.*${rule??'CAP-'}`,'--workers=1','--reporter=line','--output='+resolve(work,'browser-results')],{cwd:sandbox,encoding:'utf8',timeout:120000});
const kinds=browser?['unit','browser']:['unit'],results=[];
for(const kind of kinds){const baseline=run(null,kind);await writeFile(resolve(work,'baseline-'+kind+'.log'),baseline.stdout+baseline.stderr);if(baseline.status!==0)throw new Error('Capacity baseline failed: '+baseline.stdout+baseline.stderr);
 for(const[id,file,from,to,rule,unit=true,unitRule=rule]of cases){if(kind==='unit'&&!unit)continue;const path=resolve(sandbox,file),original=await readFile(path,'utf8');if(!original.includes(from))throw new Error('Missing capacity mutation target '+id);let result;try{await writeFile(path,original.replaceAll(from,to));result=run(kind==='unit'?unitRule:rule,kind);}finally{await writeFile(path,original);}const output=result.stdout+result.stderr,caught=result.status!==0&&result.signal===null&&!result.error&&/ERR_ASSERTION|AssertionError|Error: expect\(|Error: expect\.poll/.test(output)&&!/SyntaxError|ReferenceError|TypeError|Test timeout of|worker process exited/.test(output);await writeFile(resolve(work,kind+'-'+id+'.log'),output);if(!caught)throw new Error('Capacity mutation survived or crashed: '+id+'\n'+output);results.push({id,kind,rule:kind==='unit'?unitRule:rule,caught});}
}
console.log(JSON.stringify({node:process.version,browser:browser?(process.env.CIM_PLAYER_BROWSER??'chromium'):null,baselines:'passed',results},null,2));
