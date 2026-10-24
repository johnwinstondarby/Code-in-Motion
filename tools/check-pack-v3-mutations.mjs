import {cp,mkdir,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),work=resolve(process.env.CIM_PACK_V3_MUTATION_WORK??resolve(root,'../pack-v3-mutations')),browser=process.argv.includes('--browser');
await mkdir(work,{recursive:true});const sandbox=await mkdtemp(resolve(work,'candidate-'));
await cp(root,sandbox,{recursive:true,filter:p=>!['.git','node_modules','dist','test-results','work'].includes(basename(p))});await symlink(resolve(root,'node_modules'),resolve(sandbox,'node_modules'),process.platform==='win32'?'junction':'dir');
const validator='authoring/v3/validate.mjs',pack='authoring/v3/pack.mjs',media='authoring/v3/production-media.mjs',admission='authoring/v3/admission.mjs';
const suppress=id=>`if (condition && id !== '${id}') diagnostics.push`;
const cases=[
 ['PB-M01-placeholder',validator,[['if (condition) diagnostics.push',suppress('CIM-V3-PLACEHOLDER')]],'PB-03'],
 ['PB-M02-forged-label',validator,[["a.kind === 'gui' && (doc.placeholder ? a.label !== 'Placeholder GUI · simulated' : a.label !== 'Recorded in the lab')",'false']],'PB-04'],
 ['PB-M03-capture',validator,[['if (condition) diagnostics.push',suppress('CIM-V3-CAPTURE-REFERENCE')]],'PB-05'],
 ['PB-M04-digest',pack,[['if(sha256!==undefined&&digest(result)!==sha256)','if(false)']],'PB-06'],
 ['PB-M05-codec',media,[["if(typeof codec!=='string'||codec.length>80||!(d?.type==='video/mp4'?mp4:d?.type==='video/webm'&&webm))",'if(false)']],'PB-07'],
 ['PB-M06-confinement',pack,[['if(!inside(root,resolved))','if(false)'],['if(!inside(root,currentPath)||','if(']],'PB-09'],
 ['PB-M07-minimum',pack,[["cim_min:'1.1.0'","cim_min:'1.0.1'"]],'PB-11'],
 ['PB-M08-plain-dev',admission,[["const version=typeof host==='object'&&host!==null&&capabilities.has(host)?'1.1.0':host;","const version=host==='1.1.0-dev'?'1.1.0':typeof host==='object'&&host!==null&&capabilities.has(host)?'1.1.0':host;"]],'PB-10'],
 ['PB-M09-release-101',admission,[["const version=typeof host==='object'&&host!==null&&capabilities.has(host)?'1.1.0':host;","const version=host==='1.0.1'?'1.1.0':typeof host==='object'&&host!==null&&capabilities.has(host)?'1.1.0':host;"]],'PB-10'],
 ['PB-M10-variable-date','tools/lesson-pack-archive.mjs',[['local.writeUInt16LE(33,12)','local.writeUInt16LE(((new Date().getUTCFullYear()-1980)<<9)|33,12)']],'PB-12'],
 ['PB-M11-attachment',media,[["if(d?.source?.type==='attachment')",'if(false)']],'PB-08'],
 ['PB-M12-console',pack,[['if(violations.length)','if(false)']],'PB-22'],
 ['PB-M13-file-list',validator,[['if (condition) diagnostics.push',suppress('CIM-V3-PACK-FILES')]],'PB-23'],
 ['PB-M14-total',validator,[['files.reduce((n,f)=>n+f.size,0)>33554432','false']],'PB-23'],
 ['PB-M15-actor','examples/packs/run-custody-placeholder/lesson.json',[['On INVENT, custody','On OTHER, custody']],'PB-24'],
 ['PB-M16-php-template',pack,[['Companion multi-pane lesson data for Code in Motion.','${compiled.document.presentation.title}']],'PB-25'],
 ['PB-M17-host','tools/pack-preview-server.mjs',[["if(request.headers.host!==new URL(origin).host||request.headers.origin&&request.headers.origin!==origin)",'if(false)']],'PB-20'],
 ['PB-M21-capacity','tools/pack-preview-server.mjs',[['server.maxConnections=64','server.maxConnections=16']],'PB-27'],
 ['PB-M22-duplicate-keys',pack,[['if(duplicates.length)','if(false)']],'PB-28'],
 ['PB-M18-snapshot','tools/pack-preview-server.mjs',[["{resolve,extname}","{resolve,extname,dirname}"],['send(result.entries.get(file),mime(file));return;','send(await readFile(resolve(dirname(source),file)),mime(file));return;']],'PB-21']
];
if(browser)cases.push(
 ['PB-M19-json-verification','tools/pack-preview-client.mjs',[['await sha(bytes)!==descriptor.sha256','false']],'PB-PREVIEW-04','browser'],
 ['PB-M20-real-source','tools/pack-preview-client.mjs',[[' const media=projectPreviewMedia'," experience.presentation.title='Run Custody · Placeholder simulation';\n const media=projectPreviewMedia"]],'PB-PREVIEW-03','browser']
);
const tests=['tests/pack-v3.test.mjs','tests/pack-v3-sample.test.mjs','tests/pack-preview.test.mjs','tests/pack-v3-schema.test.mjs'];
const run=(rule,kind='unit')=>spawnSync(process.execPath,kind==='browser'?['node_modules/@playwright/test/cli.js','test','tests/e2e/pack-v3-preview.spec.mjs','--workers=1','--reporter=line',...(rule?['--grep',rule]:[])]:['--test',...(rule?['--test-name-pattern='+rule]:[]),...tests],{cwd:sandbox,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,env:process.env});
const base=run(null);await writeFile(resolve(work,'baseline-unit.log'),base.stdout+base.stderr);if(base.status!==0)throw new Error('Unit baseline failed: '+base.stdout+base.stderr);
if(browser){const b=run(null,'browser');await writeFile(resolve(work,'baseline-browser.log'),b.stdout+b.stderr);if(b.status!==0)throw new Error('Browser baseline failed: '+b.stdout+b.stderr);}
const results=[];
for(const[id,file,edits,rule,kind='unit']of cases){const path=resolve(sandbox,file),original=await readFile(path,'utf8');let modified=original;for(const[from,to]of edits){if(modified.split(from).length!==2)throw new Error('Expected one mutation anchor '+id+': '+from);modified=modified.replace(from,to);}let result;try{await writeFile(path,modified);result=run(rule,kind);}finally{await writeFile(path,original);}const output=(result.stdout??'')+(result.stderr??'');await writeFile(resolve(work,id+'.log'),output);const caught=result.status!==0&&/ERR_ASSERTION|AssertionError|Error: expect\(|Error: expect\.poll/.test(output)&&!/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND|TypeError: Assignment to constant/.test(output);if(!caught)throw new Error('Mutation survived or crashed '+id+'\n'+output);results.push({id,rule,caught});}
console.log(JSON.stringify({node:process.version,browser:browser?process.env.CIM_PLAYER_BROWSER??'chromium':null,baseline:'passed',results},null,2));
