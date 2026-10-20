import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtureExperience} from '../helpers/multipane-experience.mjs';

test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium'});
const repository=fileURLToPath(new URL('../../',import.meta.url));
let server,origin;
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/multipane/controls.css">
<main id="fixture"></main><button id="outside">Outside controls</button>
<script type="module">
import {createMultiPaneFixtureDriver} from '/harness/multipane-test-driver.mjs';
import {mountMultiPaneControls} from '/src/multipane/controls.mjs';
const experience=await(await fetch('/fixture.json'+location.search)).json();
const slots=Object.fromEntries(experience.renderer_config.panes.map(p=>{const node=document.createElement('pre');node.tabIndex=0;return[p.id,node];}));
const driver=createMultiPaneFixtureDriver(experience,slots,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
const view=mountMultiPaneControls({root:document.querySelector('#fixture'),session:driver.session,experience,slots,instanceId:'acceptance'});
window.fixture={...driver,slots,experience,view,dispose(){view.dispose();driver.dispose();}};
</script>`;
test.beforeAll(async()=>{
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(url.pathname==='/fixture.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixtureExperience({leadingContext:url.searchParams.has('leading')})));return;}
  const file=resolve(repository,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(resolve(repository)+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]??'text/plain');res.end(await readFile(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(done=>server.close(done));});
const open=async(page,query='')=>{await page.goto(origin+'/fixture'+query);await page.waitForFunction(()=>window.fixture);};
const event=(page,event)=>page.evaluate(e=>fixture.session.dispatch(e),event);
const advance=(page,ms)=>page.evaluate(ms=>fixture.advance(ms),ms);

for(const [width,height] of [[1366,768],[1536,864],[1920,1080]])test.describe(`${width}x${height}`,()=>{
 test.use({viewport:{width,height}});
 test('[MP-14][MP-15] tabs have reciprocal semantics and native roving keyboard selection',async({page})=>{
  await open(page);const tabs=page.getByRole('tab');await expect(tabs).toHaveCount(2);
  await expect(page.getByRole('tablist')).toHaveCount(1);await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  for(const tab of await tabs.all()){
   const panel=page.locator('#'+await tab.getAttribute('aria-controls'));await expect(panel).toHaveAttribute('role','tabpanel');await expect(panel).toHaveAttribute('aria-labelledby',await tab.getAttribute('id'));
  }
  await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');await expect(tabs.nth(1)).toBeFocused();await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Home');await expect(tabs.nth(0)).toBeFocused();await page.keyboard.press('End');await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('[data-mp-panel="console"] pre')).toBeFocused();
 });
 test('[MP-01] beat-start auto selection never takes focus and never repeats during a beat',async({page})=>{
  await open(page);await page.locator('#outside').focus();await event(page,{type:'jump',index:1});await event(page,{type:'play'});
  await expect(page.getByRole('tab',{name:'Motion – GUI'})).toHaveAttribute('aria-selected','true');await expect(page.locator('#outside')).toBeFocused();
  await page.getByRole('tab',{name:'Console – CLI'}).click();await advance(page,200);
  await expect(page.getByRole('tab',{name:'Console – CLI'})).toHaveAttribute('aria-selected','true');
 });
 test('[MP-02][MP-03][MP-04] hidden work continues and pause resume Next preserve manual choice',async({page})=>{
  await open(page);await expect(page.getByRole('button',{name:'Play',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.getByRole('tab',{name:'Motion – GUI'}).click();const before=await page.evaluate(()=>fixture.slots.console.textContent);await advance(page,50);
  expect(await page.evaluate(()=>fixture.slots.console.textContent)).not.toBe(before);
  await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await page.evaluate(()=>fixture.log.length);await advance(page,500);expect(await page.evaluate(()=>fixture.log.length)).toBe(held);
  await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.getByRole('tab',{name:'Motion – GUI'})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Next',exact:true}).click();expect(await page.evaluate(()=>fixture.session.read().index)).toBe(0);await expect(page.getByRole('tab',{name:'Motion – GUI'})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Next',exact:true}).click();expect(await page.evaluate(()=>fixture.session.read().index)).toBe(1);
 });
 test('[MP-11][MP-12][MP-13] Beats stays live marks current beat and closes without navigation',async({page})=>{
  await open(page);await expect(page.locator('[data-mp-status]')).toHaveText('Start · 9 beats');
  await expect(page.getByRole('button',{name:'Play',exact:true})).toHaveAttribute('title','Play');
  await page.getByRole('button',{name:'Beats',exact:true}).click();await expect(page.getByRole('dialog',{name:'Beats'}).locator('[aria-current="step"]')).toHaveCount(0);await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.locator('[data-mp-status]')).toHaveText('Beat 1 / 9 · playing');
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveAttribute('title','Pause');
  await page.getByRole('button',{name:'Beats',exact:true}).click();const menu=page.getByRole('dialog',{name:'Beats'});await expect(menu).toBeVisible();
  await expect(menu.locator('[aria-current="step"]')).toHaveCount(1);await expect(menu.locator('[aria-current="step"]')).toContainText('1 ');
  await advance(page,50);expect(await page.evaluate(()=>fixture.session.read().playing)).toBe(true);
  const state=await page.evaluate(()=>fixture.session.read());await page.keyboard.press('ArrowDown');expect(await page.evaluate(()=>fixture.session.read().index)).toBe(state.index);
  await page.keyboard.press('End');await expect(menu.getByRole('button',{name:'Close',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(page.getByRole('button',{name:'Beats',exact:true})).toBeFocused();
  const after=await page.evaluate(()=>fixture.session.read());expect({...after,panelOpen:true}).toEqual(state);
  await page.getByRole('button',{name:'Beats',exact:true}).click();await menu.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('button',{name:'Beats',exact:true})).toBeFocused();expect(await page.evaluate(()=>fixture.session.read())).toEqual(after);
 });
 test('[MP-05][MP-07][MP-16] context waits remain selectable and direct menu jumps reset the default tab',async({page},info)=>{
  await open(page);await event(page,{type:'jump',index:3});await page.getByRole('tab',{name:'Motion – GUI'}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Motion – GUI'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-mp-wait="motion"]')).toHaveText('Waiting on next GUI action');
  const selected=await page.evaluate(()=>{const node=fixture.slots.motion;const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return selection.toString();});expect(selected.length).toBeGreaterThan(0);
  await advance(page,60);expect(await page.evaluate(()=>getSelection().toString())).toBe(selected);
  await expect(page.locator('[data-mp-panel="motion"] pre')).toHaveCSS('user-select','text');await expect(page.locator('[data-mp-panel="motion"]')).toHaveCSS('opacity','1');
  await page.getByRole('button',{name:'Beats',exact:true}).click();await page.getByRole('dialog',{name:'Beats'}).locator('[data-mp-beat="5"]').click();
  await expect(page.getByRole('tab',{name:'Console – CLI'})).toHaveAttribute('aria-selected','true');
  const boxes=await page.locator('[data-mp-context]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};}));
  expect(boxes[0].width).toBeCloseTo(boxes[1].width,0);expect(boxes[0].y).toBeCloseTo(boxes[1].y,0);
  expect(await page.locator('#fixture').evaluate(n=>getComputedStyle(n).transform)).toBe('none');
  const bar=await page.locator('[data-mp-transport]').boundingBox();expect(bar.y+bar.height).toBeLessThanOrEqual(height);
  const image=info.outputPath('true-size-layout.png');await page.screenshot({path:image});
  await info.attach('true-size-layout',{path:image,contentType:'image/png'});
  await writeFile(info.outputPath('layout.json'),JSON.stringify({width,height,contexts:boxes,transport:bar,transform:'none'},null,2));
 });
 test('[MP-08][MP-09][MP-10][MP-17][MP-18] Start End deep links and rapid navigation rebuild deterministic states',async({page})=>{
  await open(page);await expect(page.getByRole('button',{name:'Beats',exact:true})).toHaveCount(1);
  await event(page,{type:'deepLink',fragment:'#cim/context-chain-placeholder/submit-fail'});await expect(page.getByRole('tab',{name:'Motion – GUI'})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Beats',exact:true}).click();await page.getByRole('button',{name:'End',exact:true}).click();expect(await page.evaluate(()=>fixture.session.read().index)).toBe(8);
  await page.getByRole('button',{name:'Beats',exact:true}).click();await page.getByRole('button',{name:'Start',exact:true}).click();await expect(page.locator('[data-mp-status]')).toHaveText('Start · 9 beats');
  await page.getByRole('button',{name:'Restart',exact:true}).click();expect(await page.evaluate(()=>fixture.session.read().playing)).toBe(true);
  for(const index of [7,2,5])await event(page,{type:'jump',index});await advance(page,1000);expect(await page.evaluate(()=>fixture.session.read().index)).toBe(5);
  expect(await page.evaluate(()=>fixture.scheduler.pending())).toBe(0);
 });
 test('[MP-06][MP-19][MP-21] initial contexts reduced motion and disposal leave no running clock or stale controls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await open(page,'?leading=1');await expect(page.getByRole('tab')).toHaveCount(2);
  await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.locator('[data-mp-status]')).toHaveText('Beat 1 / 10 · paused');
  await expect(page.getByRole('tab',{name:'Console – CLI'})).toHaveAttribute('aria-selected','true');expect(await page.evaluate(()=>fixture.scheduler.counts.schedule)).toBe(0);
  const result=await page.evaluate(()=>{const button=document.querySelector('[data-mp-command="restart"]');fixture.dispose();button.click();return{pending:fixture.scheduler.pending(),children:document.querySelector('#fixture').childElementCount};});
  expect(result).toEqual({pending:0,children:0});
 });
});
