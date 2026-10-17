import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileLesson } from '../../tools/lesson-pack-archive.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium',colorScheme:'dark',viewport:{width:1410,height:900}});
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
let server,origin,compiled;
test.beforeAll(async()=>{
  const source=JSON.parse(await readFile(resolve(root,'experiences/starter/python-first-steps.authoring.json'),'utf8'));
  source.id='my-first-lesson';source.description='<img src=x onerror="window.lessonInjected=true"> is inert lesson text.';
  compiled=compileLesson(JSON.stringify(source)).document;
  server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost'),kind=url.searchParams.get('case')??'valid';
    if(url.pathname==='/'){
      const id=kind==='override'?'git-repository-practice':'my-first-lesson';
      const dataUrl=kind==='external'?'https://elsewhere.test/pack.json':'/pack.json?case='+kind;
      res.setHeader('content-type','text/html');res.end(`<link rel="stylesheet" href="/wordpress/assets/cim.css"><div class="cim" data-cim-experience="${id}" data-cim-default-theme="light" data-cim-pack-url="${dataUrl}"><div data-cim-renderer-root></div><div class="cim-fallback">Lesson unavailable.</div></div><script src="/wordpress/assets/bootstrap.js"></script>`);return;
    }
    if(url.pathname==='/pack.json'){
      res.setHeader('content-type','application/json');const doc=structuredClone(compiled);
      if(kind==='schema') doc.schema='unknown';
      if(kind==='identity') doc.id='different';
      if(kind==='engine') doc.engine_min='999.0.0';
      if(kind==='link') doc.steps[0].commentary.links=[{id:'unsafe',label:'Unsafe link',href:'javascript:alert(1)'}];
      res.end(kind==='huge'?' '.repeat(2097153):kind==='malformed'?'{':JSON.stringify(doc));return;
    }
    try{
      const file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')) throw Error('path');
      const data=await readFile(file);res.setHeader('content-type',extname(file)==='.json'?'application/json':extname(file)==='.css'?'text/css':'text/javascript');res.end(data);
    }catch{res.statusCode=404;res.end('Not found');}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(done=>server.close(done));});
test('companion lesson uses the production bootstrap, neutral theme and inert text',async({page},testInfo)=>{
  await page.goto(origin);const player=page.locator('.cim');
  await expect(player).toHaveAttribute('data-cim-state','ready');await expect(player).toHaveAttribute('data-cim-theme','light');
  await expect(player.getByText('<img src=x onerror="window.lessonInjected=true"> is inert lesson text.',{exact:true})).toBeVisible();
  await expect(player.locator('img')).toHaveCount(0);
  await player.getByRole('button',{name:'End',exact:true}).click();await expect(player.getByLabel('Lesson beat progress')).toContainText('3 / 3');
  await expect(player.getByRole('button',{name:'Copy command: count * 2',exact:true})).toBeVisible();
  await player.screenshot({path:testInfo.outputPath('companion-python.png')});
});
for(const kind of ['schema','identity','engine','link','huge','malformed','external'])test('companion lesson fails closed: '+kind,async({page})=>{
  await page.goto(origin+'/?case='+kind);const player=page.locator('.cim');
  await expect(player).toHaveAttribute('data-cim-state','fallback');await expect(player.locator('[data-cim-player]')).toHaveCount(0);await expect(player.locator('.cim-fallback')).toBeVisible();
});
test('a pack root cannot override a bundled lesson',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(origin+'/?case=override');await expect(page.locator('.cim')).toHaveAttribute('data-cim-state','ready');
  expect(requests.filter(url=>url.includes('/pack.json'))).toEqual([]);
});
