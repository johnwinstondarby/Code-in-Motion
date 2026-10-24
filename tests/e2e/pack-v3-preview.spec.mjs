import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startV3Preview} from '../../tools/pack-preview-server.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium'});
let server,url,folder;
test.beforeAll(async()=>{folder=await mkdtemp(resolve(tmpdir(),'cim-v3-preview-e2e-'));await cp(resolve('examples/packs/run-custody-placeholder'),folder,{recursive:true});({server,url}=await startV3Preview(resolve(folder,'lesson.json')));});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
async function open(page){await page.goto(url);await expect(page.locator('[data-cim-preview]')).toHaveAttribute('data-cim-preview','ready');await expect(page.locator('[data-preview-identity]')).toContainText('1.1.0-dev');}
async function jump(page,index){await page.locator('[data-mp-command=beats]').click();await page.locator(`[data-mp-beat="${index}"]`).click();await expect(page.locator('[data-mp-status]')).toContainText(`Beat ${index+1} / 8`);}
for(const[width,height]of [[1366,768],[1536,864],[1920,1080]])test.describe(width+'x'+height,()=>{
 test.use({viewport:{width,height}});
 test('[PB-PREVIEW-01] all eight real compiled beats, visible context panes and full-size diagrams',async({page},info)=>{
  await open(page);await expect(page.locator('[data-mp-status]')).toHaveText('Start · 8 beats');
  for(let i=0;i<8;i++){
   await jump(page,i);await expect(page.locator('[data-mp-context=explanation]')).toBeVisible();await expect(page.locator('[data-mp-context=engineering]')).toBeVisible();await expect(page.locator('[data-mp-placeholder]')).toBeVisible();
   const svg=page.locator('[data-diagram-svg]');await expect(svg).toBeVisible();expect(await svg.evaluate(e=>e.getBoundingClientRect().width)).toBe(620);
   if(i===2||i===5){const video=page.locator('.motion-pane video');await expect.poll(()=>video.evaluate(v=>!v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-v.duration)<0.15)).toBe(true);expect(await video.evaluate(v=>v.currentSrc)).toMatch(/^blob:/);}
   await page.screenshot({path:info.outputPath(`beat-${i+1}.png`)});
  }
 });
});
test('[PB-PREVIEW-02] real Motion playback keeps one clock when its action tab is hidden',async({page})=>{
 await open(page);await jump(page,1);await page.locator('[data-mp-command=playback]').click();const video=page.locator('.motion-pane video');await expect.poll(()=>video.evaluate(v=>!v.paused&&v.currentTime>0)).toBe(true);await page.locator('[data-mp-tab=console]').click();await expect(page.locator('[data-mp-tab=console]')).toHaveAttribute('aria-selected','true');await expect(page.locator('[data-mp-status]')).toContainText('paused');await expect.poll(()=>video.evaluate(v=>v.paused&&!v.seeking&&Math.abs(v.currentTime-v.duration)<0.15)).toBe(true);await expect(page.locator('[data-mp-tab=console]')).toHaveAttribute('aria-selected','true');
});
test('[PB-PREVIEW-03] save-refresh uses authored edits and shows all actionable validation errors',async({page})=>{
 const file=resolve(folder,'lesson.json'),original=await readFile(file,'utf8');try{const doc=JSON.parse(original);doc.title='A real authored edit';await writeFile(file,JSON.stringify(doc));await open(page);await expect(page.locator('h2')).toHaveText(doc.title);for(const k of ['extra1','extra2','extra3','extra4'])doc[k]=true;await writeFile(file,JSON.stringify(doc));await page.reload();for(const k of ['extra1','extra2','extra3','extra4'])await expect(page.locator('#preview-error')).toContainText('$.'+k);await expect(page.locator('#preview-error')).toContainText('CIM-V3-SHAPE');await expect(page.locator('[data-composed-player]')).toHaveCount(0);}finally{await writeFile(file,original);}
});
