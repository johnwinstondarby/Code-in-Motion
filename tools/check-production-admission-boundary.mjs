// ADR 0061 step 7 Part C: shipped code (src/ and wordpress/) may never reach the
// authoring tool's development admission, the fixture harness, tools, or fixture flags.
import {readFile,readdir} from 'node:fs/promises';
import {dirname,extname,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=new Set(['.js','.mjs','.cjs']);
const posix=path=>path.split(sep).join('/');

async function walk(directory){
 let entries;try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return[];throw error;}
 const files=[];
 for(const entry of entries){const path=resolve(directory,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile()&&SOURCE.has(extname(entry.name)))files.push(path);}
 return files;
}

// Blank comments while keeping strings, so commented explanations are not violations.
function stripComments(source){
 let out='',mode='code',quote=null;
 for(let i=0;i<source.length;i++){
  const c=source[i],n=source[i+1];
  if(mode==='line'){if(c==='\n'){out+='\n';mode='code';}else out+=' ';continue;}
  if(mode==='block'){if(c==='*'&&n==='/'){out+='  ';i++;mode='code';}else out+=c==='\n'?'\n':' ';continue;}
  if(mode==='string'){out+=c;if(c==='\\'&&n!==undefined){out+=n;i++;}else if(c===quote){mode='code';quote=null;}continue;}
  if(c==='/'&&n==='/'){out+='  ';i++;mode='line';}
  else if(c==='/'&&n==='*'){out+='  ';i++;mode='block';}
  else if(c==='\''||c==='"'||c==='`'){out+=c;mode='string';quote=c;}
  else out+=c;
 }
 return out;
}

const RULES=[
 ['production-to-authoring',target=>target==='authoring'||target.startsWith('authoring/'),'Shipped code cannot import authoring tools, including the development admission capability.'],
 ['production-to-harness',target=>target==='harness'||target.startsWith('harness/'),'Shipped code cannot import the fixture harness.'],
 ['production-to-tools',target=>target==='tools'||target.startsWith('tools/'),'Shipped code cannot import repository tools or the local preview driver.']
];

export async function checkProductionAdmissionBoundary(rootDir=ROOT){
 const files=[...await walk(resolve(rootDir,'src')),...await walk(resolve(rootDir,'wordpress'))];
 const violations=[];
 for(const file of files){
  const rel=posix(relative(rootDir,file)),code=stripComments(await readFile(file,'utf8'));
  for(const match of code.matchAll(/(?:\bimport\s*(?:[^'"`;]*?\bfrom\s*)?|\bimport\s*\(\s*|\bexport\s*[^'"`;]*?\bfrom\s*)(['"])([^'"]+)\1/g)){
   const specifier=match[2];if(!specifier.startsWith('.'))continue;
   const target=posix(relative(rootDir,resolve(dirname(file),specifier)));
   for(const [rule,test,message] of RULES)if(test(target))violations.push({rule,file:rel,target,message});
  }
  if(/\btestFixture\s*:\s*true\b/.test(code))violations.push({rule:'production-test-fixture',file:rel,target:'testFixture:true',message:'Shipped code must use a Part C admission token, never the fixture opt-in.'});
  if(/\bfixtureOnly\s*:\s*true\b/.test(code))violations.push({rule:'production-fixture-data',file:rel,target:'fixtureOnly:true',message:'Shipped code cannot label production data as a test fixture.'});
 }
 return {filesChecked:files.length,violations};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await checkProductionAdmissionBoundary();
 for(const v of result.violations)console.error(`${v.rule}: ${v.file} -> ${v.target}. ${v.message}`);
 if(result.violations.length){process.exitCode=1;}else console.log(`PASS: production admission boundary (${result.filesChecked} shipped source files).`);
}
