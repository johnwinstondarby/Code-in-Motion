import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {placeholderPack} from '../helpers/part-c-pack.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium',viewport:{width:1366,height:768}});
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const types={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};
let server,origin,pack;const stalls=new Set();
const packBase='/wp-content/plugins/cim-lesson-run-custody-placeholder/';
// Mirrors the shortcode markup and script tag WordPress produces; only the attributes under test vary.
const panesRoot=(lesson,capture,instance='')=>`<div class="cim" data-cim-experience="run-custody-placeholder"${instance?` data-cim-instance="${instance}"`:''} data-cim-pack-agreement="cim.lesson-pack/v2" data-cim-pack-url="${lesson}" data-cim-pack-capture-url="${capture}" data-cim-default-theme="light"><div data-cim-renderer-root></div><div class="cim-fallback">Multi-pane fallback.</div></div>`;
// stalled: an extra Player placed first whose capture response the server never finishes.
function page({development=true,lessonSha,captureSha,second=false,stalled=false}={}){
 const lesson=packBase+'lesson.json?cim-sha256='+(lessonSha??sha(pack.entries.get('lesson.json')));
 const capture=packBase+'capture.json?cim-sha256='+(captureSha??sha(pack.entries.get('capture.json')));
 return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Part C</title><link rel="stylesheet" href="/wordpress/assets/cim.css"><body>
${stalled?panesRoot(lesson,capture+'&cim-test-stall=1','stalled'):''}
${panesRoot(lesson,capture)}
${second?panesRoot(lesson,capture,'second'):''}
<div class="cim" data-cim-experience="python-first-steps" data-cim-default-theme="light"><div data-cim-renderer-root></div><div class="cim-fallback">Legacy fallback.</div></div>
<script src="/wordpress/assets/bootstrap.js?ver=1.0.1" data-cim-motion-policy="system"${development?' data-cim-development-admission="1.1.0-dev"':''} defer></script>`;
}
test.beforeAll(async()=>{
 pack=await placeholderPack();
 server=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/'){response.setHeader('content-type','text/html');response.end(page(JSON.parse(url.searchParams.get('options')??'{}')));return;}
  if(url.searchParams.has('cim-test-stall')){stalls.add(response);response.setHeader('content-type','application/json');response.write('{');return;}
  if(url.pathname.startsWith(packBase)){const bytes=pack.entries.get(url.pathname.slice(packBase.length));if(!bytes){response.statusCode=404;response.end();return;}response.setHeader('content-type',types[extname(url.pathname)]??'application/octet-stream');response.end(bytes);return;}
  if(!/^\/(src|wordpress)\//.test(url.pathname)||url.pathname.includes('..')){response.statusCode=404;response.end();return;}
  try{const bytes=await readFile(resolve(root,'.'+url.pathname));response.setHeader('content-type',types[extname(url.pathname)]??'application/octet-stream');response.end(bytes);}catch{response.statusCode=404;response.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(()=>{for(const r of stalls)r.destroy();server.closeAllConnections?.();server.close();});
const open=(p,options={},hash='')=>p.goto(origin+'/?options='+encodeURIComponent(JSON.stringify(options))+hash);
const panes=p=>p.locator('[data-cim-experience="run-custody-placeholder"]:not([data-cim-instance])');
const instance=(p,name)=>p.locator(`[data-cim-instance="${name}"]`);
const legacy=p=>p.locator('[data-cim-experience="python-first-steps"]');

test('[PC-E2E-01] the development host mounts the composed Player beside an unchanged legacy lesson',async({page:p},info)=>{
 const errors=[],diagnostics=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text());});
 await open(p);
 await expect(panes(p)).toHaveAttribute('data-cim-state','ready');
 await expect(panes(p).locator('[data-composed-player]')).toHaveCount(1);
 await expect(panes(p)).toContainText('Placeholder content');
 await expect(panes(p)).toContainText('Start · 8 beats');
 await expect(panes(p).locator('.cim-fallback')).toBeHidden();
 await expect(legacy(p)).toHaveAttribute('data-cim-state','ready');
 expect(errors).toEqual([]);
 // The legacy Host must never try to mount the panes root: no host diagnostics, and the panes root stays ready.
 await p.waitForTimeout(500);
 expect(diagnostics.filter(t=>t.includes('[CiM]'))).toEqual([]);
 await expect(panes(p)).toHaveAttribute('data-cim-state','ready');
 await p.screenshot({path:info.outputPath('wordpress-panes-initial.png'),fullPage:true});
 // The desktop composition must stay inside its WordPress root: it may scroll there, never spill past the page.
 const fit=await p.evaluate(()=>{const root=document.querySelector('[data-cim-experience="run-custody-placeholder"]'),box=root.getBoundingClientRect();return{pageOverflow:document.documentElement.scrollWidth-innerWidth,overflowX:getComputedStyle(root).overflowX,badge:document.querySelector('[data-composed-player] [data-placeholder-badge],[data-composed-player] .mp-placeholder')?.getBoundingClientRect().right??null,right:box.right};});
 expect(fit.pageOverflow).toBeLessThanOrEqual(0);
 expect(['auto','scroll']).toContain(fit.overflowX);
});

test('[PC-E2E-02] a GUI beat shows the Motion fallback until media serving exists',async({page:p},info)=>{
 await open(p,{},'#cim/run-custody-placeholder/submit-fail');
 await expect(panes(p)).toHaveAttribute('data-cim-state','ready');
 await expect(panes(p)).toContainText('Beat 3 / 8');
 await panes(p).getByRole('tab',{name:'Motion – GUI'}).click();
 await expect(panes(p).locator('.motion-pane')).toContainText('GUI recording unavailable');
 await expect(panes(p).locator('.motion-pane')).toContainText('Placeholder');
 await expect(panes(p).locator('.motion-pane')).not.toContainText('Recorded in the lab');
 await panes(p).screenshot({path:info.outputPath('wordpress-panes-motion-fallback.png')});
});

test('[PC-E2E-03] without the PHP-projected development flag the panes lesson stays on its fallback',async({page:p},info)=>{
 await open(p,{development:false});
 await expect(legacy(p)).toHaveAttribute('data-cim-state','ready');
 await expect(panes(p)).not.toHaveAttribute('data-cim-state','ready');
 await expect(panes(p).locator('[data-composed-player]')).toHaveCount(0);
 await expect(panes(p).locator('.cim-fallback')).toBeVisible();
 await p.screenshot({path:info.outputPath('wordpress-panes-refused.png'),fullPage:true});
});

test('[PC-E2E-04] lesson and capture bytes must match the fingerprints PHP projected',async({page:p})=>{
 for(const options of [{lessonSha:'0'.repeat(64)},{captureSha:'f'.repeat(64)}]){
  await open(p,options);
  await expect(legacy(p)).toHaveAttribute('data-cim-state','ready');
  await expect(panes(p)).not.toHaveAttribute('data-cim-state','ready');
  await expect(panes(p).locator('.cim-fallback')).toBeVisible();
 }
});

test('[PC-E2E-05] a later deep link moves the panes lesson without touching the legacy lesson',async({page:p})=>{
 await open(p);
 await expect(panes(p)).toHaveAttribute('data-cim-state','ready');
 await p.evaluate(()=>{location.hash='#cim/run-custody-placeholder/prove-custody';});
 await expect(panes(p)).toContainText('Beat 7 / 8');
 await expect(legacy(p)).toHaveAttribute('data-cim-state','ready');
});

test('[PC-E2E-06] one stalled pack download does not hold back other lessons',async({page:p})=>{
 await open(p,{stalled:true});
 // Both healthy lessons become interactive while the stalled response is still open.
 await expect(panes(p)).toHaveAttribute('data-cim-state','ready',{timeout:5000});
 await expect(legacy(p)).toHaveAttribute('data-cim-state','ready',{timeout:5000});
 await panes(p).locator('[data-mp-command="next"]').click();
 await expect(panes(p)).toContainText('Beat 1 / 8');
 await expect(instance(p,'stalled')).not.toHaveAttribute('data-cim-state','ready');
 await expect(instance(p,'stalled').locator('.cim-fallback')).toBeVisible();
});

test('[PC-E2E-07] two Players on one page keep their own accessibility IDs',async({page:p})=>{
 await open(p,{second:true});
 await expect(panes(p)).toHaveAttribute('data-cim-state','ready');
 await expect(instance(p,'second')).toHaveAttribute('data-cim-state','ready');
 const report=await p.evaluate(()=>{
  const ids=[...document.querySelectorAll('[id]')].map(n=>n.id),duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
  const wrong=[];
  for(const player of document.querySelectorAll('[data-composed-player]')){
   for(const node of player.querySelectorAll('[aria-controls],[aria-labelledby]')){
    for(const attr of ['aria-controls','aria-labelledby']){const ref=node.getAttribute(attr);if(ref===null)continue;const target=document.getElementById(ref);if(!target||!player.contains(target))wrong.push(attr+'='+ref);}
   }
  }
  return {players:document.querySelectorAll('[data-composed-player]').length,duplicates,wrong};
 });
 expect(report.players).toBe(2);
 expect(report.duplicates).toEqual([]);
 expect(report.wrong).toEqual([]);
 // Selecting the second Player's Motion tab shows its own panel, not the first Player's.
 await instance(p,'second').getByRole('tab',{name:'Motion – GUI'}).click();
 await expect(instance(p,'second').getByRole('tabpanel').filter({has:p.locator('.motion-pane')})).toBeVisible();
 await expect(panes(p).getByRole('tab',{name:'Console – CLI'})).toHaveAttribute('aria-selected','true');
});
