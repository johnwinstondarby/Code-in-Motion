#!/usr/bin/env node
import { formatAuthoringError } from './authoring-diagnostics.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startLessonPreview } from './lesson-preview-server.mjs';
import { compileLesson, createLessonPack, MAX_AUTHORING_BYTES } from './lesson-pack-archive.mjs';
import { decodeJSON, readBoundedFile, validateV3File } from '../authoring/v3/files.mjs';

export async function main(args) {
  const [command, source, ...rest] = args;
  if (!['init','validate','compile','pack','preview'].includes(command) || !source || (rest.length && !(rest.length===2 && rest[0]===(command==='preview'?'--port':'--out') && rest[1])) || (['init','validate'].includes(command) && rest.length)) {
    throw new Error('Usage: node tools/cim-author.mjs init lesson.json | validate lesson.json | compile lesson.json --out compiled.json | pack lesson.json --out lesson-pack.zip | preview lesson.json --port 8088');
  }
  if (command==='preview') {
    const port=rest.length?Number(rest[1]):0;
    if(!Number.isInteger(port)||port<0||port>65535) throw new Error('Preview port must be 0 through 65535.');
    const {url}=await startLessonPreview(resolve(source),{port});
    console.log('Open '+url+' in your browser. Save JSON and refresh to preview edits. Ctrl+C stops preview.'); return;
  }
  if (command==='init') {
    const starter = JSON.parse(await readFile(new URL('../experiences/starter/python-first-steps.authoring.json',import.meta.url),'utf8'));
    starter.id = 'my-first-lesson'; starter.title = 'My first Python lesson';
    await writeFile(resolve(source), JSON.stringify(starter,null,2)+'\n', {flag:'wx'});
    console.log('Created '+source+'. Change its id and title before making your own pack.'); return;
  }
  const { stat } = await import('node:fs/promises');
  if ((await stat(resolve(source))).size > MAX_AUTHORING_BYTES) throw new RangeError('Authored lesson exceeds 2 MiB.');
  const text = await readFile(resolve(source),'utf8');
  let declaredSchema;
  try { declaredSchema = JSON.parse(text)?.schema; } catch { /* Preserve the legacy compiler's parse diagnostics. */ }
  if (['localis.cim/authoring/v3','localis.cim/engineering-capture/v1','cim.lesson-pack/v2'].includes(declaredSchema)) {
    if (command !== 'validate') throw new Error('Multi-pane schemas support validate only in this step. Use cim-author validate; compile, pack and preview admission wait for later work.');
    const result = await validateV3File(resolve(source), decodeJSON(await readBoundedFile(resolve(source))));
    console.log(`Valid: ${result.id} (${result.count} ${result.kind === 'authoring' ? 'beats' : 'entries'}; schema validation only, not Player admission).`);
    return;
  }
  const result = compileLesson(text);
  if (command==='validate') { console.log('Valid: '+result.document.id+' ('+result.document.steps.length+' segments).'); return; }
  if (command==='compile') {
    if (!rest.length) throw new Error('compile requires --out compiled.json');
    await writeFile(resolve(rest[1]),result.text,{flag:'wx'}); return;
  }
  const pack = createLessonPack(text,await readFile(new URL('../LICENSE',import.meta.url),'utf8'));
  const output = rest[1] ?? 'cim-lesson-'+pack.id+'.zip';
  await writeFile(resolve(output),pack.zip,{flag:'wx'});
  await writeFile(resolve(output+'.sha256'),pack.sha256+'  '+output.split(/[\\/]/).at(-1)+'\n',{flag:'wx'});
  console.log('Created '+output+'\nSHA-256 '+pack.sha256+'\nInstall and activate this lesson-pack ZIP alongside CiM, then use [cim experience="'+pack.id+'"].');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  main(process.argv.slice(2)).catch(error=>{
    console.error(formatAuthoringError(error));
    process.exitCode=1;
  });
}
