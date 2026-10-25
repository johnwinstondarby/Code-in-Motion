import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {placeholderPack,PILGRIM_ROWS} from '../helpers/part-c-pack.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium',viewport:{width:1366,height:768}});
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const types={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};
let server,origin,pack;const gates=new Map(),bad=new Map();
const packBase='/wp-content/plugins/cim-lesson-run-custody-placeholder/';
// Mirrors the shortcode markup and script tag WordPress produces; only the attributes under test vary.
// roots: one entry per multi-pane shortcode. instance names it; bad selects one of Pilgrim's malformed lessons;
// gate holds that root's capture response open (headers and a partial body) until the test releases it.
function panesRoot({instance,bad:variant,gate}={},{lessonSha,captureSha}){
 const lessonFile=variant===undefined?'lesson.json':`bad-${variant}.json`,lessonBytes=variant===undefined?pack.entries.get('lesson.json'):bad.get(variant);
 const lesson=packBase+lessonFile+'?cim-sha256='+(lessonSha??sha(lessonBytes));
 const capture=packBase+'capture.json?cim-sha256='+(captureSha??sha(pack.entries.get('capture.json')))+(gate?'&cim-test-gate='+gate:'');
 return `<div class="cim" data-cim-experience="run-custody-placeholder"${instance?` data-cim-instance="${instance}"`:''} data-cim-pack-agreement="cim.lesson-pack/v2" data-cim-pack-url="${lesson}" data-cim-pack-capture-url="${capture}" data-cim-default-theme="light"><div data-cim-renderer-root></div><div class="cim-fallback">Multi-pane fallback.</div></div>`;
}
function page({development=true,lessonSha,captureSha,roots=[{}]}={}){
 return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Part C</title><link rel="stylesheet" href="/wordpress/assets/cim.css"><body>
${roots.map(r=>panesRoot(r,{lessonSha,captureSha})).join('\n')}
<div class="cim" data-cim-experience="python-first-steps" data-cim-default-theme="light"><div data-cim-renderer-root></div><div class="cim-fallback">Legacy fallback.</div></div>
<script src="/wordpress/assets/bootstrap.js?ver=1.0.1" data-cim-motion-policy="system"${development?' data-cim-development-admission="1.1.0-dev"':''} defer></script>`;
}
test.beforeAll(async()=>{
 pack=await placeholderPack();
 Object.values(PILGRIM_ROWS).forEach(([change],i)=>{const lesson=JSON.parse(pack.entries.get('lesson.json'));change(lesson);bad.set(i,Buffer.from(JSON.stringify(lesson)));});
 server=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/'){response.setHeader('content-type','text/html');response.end(page(JSON.parse(url.searchParams.get('options')??'{}')));return;}
  if(url.pathname==='/__gate'){const g=gates.get(url.searchParams.get('name'));if(url.searchParams.get('release')&&g&&!g.done){g.done=true;g.released=true;g.response.end(g.rest);}response.setHeader('content-type','application/json');response.end(JSON.stringify(g?{seen:true,aborted:g.aborted,released:!!g.released}:{seen:false}));return;}
  const gate=url.searchParams.get('cim-test-gate');
  if(gate&&url.pathname===packBase+'capture.json'){
   const bytes=pack.entries.get('capture.json'),g={response,aborted:false,done:false,rest:bytes.subarray(16)};gates.set(gate,g);
   request.on('close',()=>{if(!g.done){g.aborted=true;g.done=true;}});
   response.setHeader('content-type','application/json');response.write(bytes.subarray(0,16));return;
  }
  const variant=/^bad-(\d+)\.json$/.exec(url.pathname.slice(packBase.length));
  if(url.pathname.startsWith(packBase)&&variant){response.setHeader('content-type','application/json');response.end(bad.get(Number(variant[1])));return;}
  if(url.pathname.startsWith(packBase)){const bytes=pack.entries.get(url.pathname.slice(packBase.length));if(!bytes){response.statusCode=404;response.end();return;}response.setHeader('content-type',types[extname(url.pathname)]??'application/octet-stream');response.end(bytes);return;}
  if(!/^\/(src|wordpress)\//.test(url.pathname)||url.pathname.includes('..')){response.statusCode=404;response.end();return;}
  try{const bytes=await readFile(resolve(root,'.'+url.pathname));response.setHeader('content-type',types[extname(url.pathname)]??'application/octet-stream');response.end(bytes);}catch{response.statusCode=404;response.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(()=>{for(const g of gates.values())if(!g.done)g.response.destroy();server.closeAllConnections?.();server.close();});
const open=(p,options={},hash='')=>p.goto(origin+'/?options='+encodeURIComponent(JSON.stringify(options))+hash);
const gate=async(p,name,release=false)=>(await p.request.get(origin+'/__gate?name='+name+(release?'&release=1':''))).json();
// nth panes root in document order; panes(p) is the first.
const player=(p,i)=>p.locator('[data-cim-pack-agreement]').nth(i);
const panes=p=>player(p,0);
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
 const name='stall-'+test.info().project.name+'-'+Date.now();
 await open(p,{roots:[{instance:'stalled',gate:name},{}]});
 await expect.poll(async()=>(await gate(p,name)).seen).toBe(true);
 // Both healthy lessons become interactive while the stalled response is still held open.
 await expect(player(p,1)).toHaveAttribute('data-cim-state','ready',{timeout:5000});
 await expect(legacy(p)).toHaveAttribute('data-cim-state','ready',{timeout:5000});
 await player(p,1).locator('[data-mp-command="next"]').click();
 await expect(player(p,1)).toContainText('Beat 1 / 8');
 expect((await gate(p,name)).released).toBe(false);
 await expect(instance(p,'stalled')).not.toHaveAttribute('data-cim-state','ready');
 await expect(instance(p,'stalled').locator('.cim-fallback')).toBeVisible();
});

for(const [label,roots] of [['explicit instance names',[{instance:'alpha'},{instance:'beta'}]],['unnamed embeds',[{},{}]]]){
 test(`[PC-E2E-07] two Players on one page keep their own IDs, focus and Beats menus (${label})`,async({page:p})=>{
  const ids=async()=>p.evaluate(()=>[...document.querySelectorAll('[data-composed-player] [id]')].map(n=>n.id));
  await open(p,{roots});
  for(const i of [0,1])await expect(player(p,i)).toHaveAttribute('data-cim-state','ready');
  const report=await p.evaluate(()=>{
   const all=[...document.querySelectorAll('[id]')].map(n=>n.id),duplicates=all.filter((id,i)=>all.indexOf(id)!==i),wrong=[];
   for(const owner of document.querySelectorAll('[data-composed-player]'))for(const node of owner.querySelectorAll('[aria-controls],[aria-labelledby]'))for(const attr of ['aria-controls','aria-labelledby']){const ref=node.getAttribute(attr);if(ref===null)continue;const target=document.getElementById(ref);if(!target||!owner.contains(target))wrong.push(attr+'='+ref);}
   return {players:document.querySelectorAll('[data-composed-player]').length,duplicates,wrong};
  });
  expect(report.players).toBe(2);expect(report.duplicates).toEqual([]);expect(report.wrong).toEqual([]);
  // Namespaces are stable across reloads, and an explicit shortcode instance name is visible in them.
  const first=await ids();
  if(roots[0].instance)expect(first.some(id=>id.includes(roots[0].instance))).toBe(true);
  await p.reload();for(const i of [0,1])await expect(player(p,i)).toHaveAttribute('data-cim-state','ready');
  expect(await ids()).toEqual(first);
  // Keyboard tab navigation in the second Player leaves the first Player alone.
  const [a,b]=[player(p,0),player(p,1)];
  await b.getByRole('tab',{name:'Console – CLI'}).focus();
  await p.keyboard.press('ArrowRight');
  await expect(b.getByRole('tab',{name:'Motion – GUI'})).toBeFocused();
  await expect(b.getByRole('tab',{name:'Motion – GUI'})).toHaveAttribute('aria-selected','true');
  await expect(a.getByRole('tab',{name:'Console – CLI'})).toHaveAttribute('aria-selected','true');
  await p.keyboard.press('Home');await expect(b.getByRole('tab',{name:'Console – CLI'})).toBeFocused();
  await p.keyboard.press('End');await expect(b.getByRole('tab',{name:'Motion – GUI'})).toBeFocused();
  await expect(a.getByRole('tab',{name:'Console – CLI'})).toHaveAttribute('aria-selected','true');
  // Beats opens only its own menu; Escape returns focus to its own Beats button.
  const beatsB=b.locator('[data-mp-command="beats"]'),beatsA=a.locator('[data-mp-command="beats"]');
  await beatsB.click();
  await expect(b.locator('[data-mp-menu]')).toBeVisible();await expect(beatsB).toHaveAttribute('aria-expanded','true');
  await expect(a.locator('[data-mp-menu]')).toBeHidden();await expect(beatsA).toHaveAttribute('aria-expanded','false');
  await p.keyboard.press('Escape');
  await expect(b.locator('[data-mp-menu]')).toBeHidden();await expect(beatsB).toBeFocused();
  // Playback position is per Player.
  await b.locator('[data-mp-command="next"]').click();
  await expect(b).toContainText('Beat 1 / 8');await expect(a).toContainText('Start · 8 beats');
 });
}

test('[PC-E2E-08] a Player removed while its download is pending is cancelled and never mounts',async({page:p})=>{
 const errors=[];p.on('console',m=>{if(m.type()==='error'&&m.text().includes('[CiM]'))errors.push(m.text());});
 const name='detach-'+test.info().project.name+'-'+Date.now();
 await open(p,{roots:[{instance:'late',gate:name},{}]});
 await expect.poll(async()=>(await gate(p,name)).seen).toBe(true);
 await expect(player(p,1)).toHaveAttribute('data-cim-state','ready');
 await p.evaluate(()=>{window.__retired=document.querySelector('[data-cim-instance="late"]');window.__retired.remove();});
 // The request itself is cancelled, not merely ignored.
 await expect.poll(async()=>(await gate(p,name)).aborted,{timeout:5000}).toBe(true);
 await gate(p,name,true);await p.waitForTimeout(300);
 expect(await p.evaluate(()=>({ready:window.__retired.getAttribute('data-cim-state'),player:!!window.__retired.querySelector('[data-composed-player]')}))).toEqual({ready:null,player:false});
 await expect(player(p,0)).toHaveAttribute('data-cim-state','ready');
 await player(p,0).locator('[data-mp-command="next"]').click();await expect(player(p,0)).toContainText('Beat 1 / 8');
 expect(errors).toEqual([]);
});

test('[PC-E2E-09] page disposal cancels pending downloads and nothing mounts afterwards',async({page:p})=>{
 const name='dispose-'+test.info().project.name+'-'+Date.now();
 await open(p,{roots:[{instance:'late',gate:name}]});
 await expect.poll(async()=>(await gate(p,name)).seen).toBe(true);
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
 await expect.poll(async()=>(await gate(p,name)).aborted,{timeout:5000}).toBe(true);
 await gate(p,name,true);await p.waitForTimeout(300);
 await expect(instance(p,'late')).not.toHaveAttribute('data-cim-state','ready');
 await expect(instance(p,'late').locator('[data-composed-player]')).toHaveCount(0);
});

test('[PC-E2E-10] each of Pilgrim\'s malformed lessons keeps its fallback while an adjacent valid lesson works',async({page:p})=>{
 await p.addInitScript(()=>{window.__cimDiagnostics=[];const error=console.error.bind(console);console.error=(...args)=>{try{window.__cimDiagnostics.push(args.map(a=>{try{return JSON.parse(JSON.stringify(a));}catch{return String(a);}}));}catch{}error(...args);};});
 for(const [i,name] of Object.keys(PILGRIM_ROWS).entries()){
  await open(p,{roots:[{bad:i},{instance:'good'}]});
  await expect(instance(p,'good')).toHaveAttribute('data-cim-state','ready');
  await instance(p,'good').locator('[data-mp-command="next"]').click();await expect(instance(p,'good')).toContainText('Beat 1 / 8');
  await expect(player(p,0),name).not.toHaveAttribute('data-cim-state','ready');
  await expect(player(p,0).locator('.cim-fallback'),name).toBeVisible();
  await expect(player(p,0).locator('[data-composed-player]'),name).toHaveCount(0);
  await expect(legacy(p)).toHaveAttribute('data-cim-state','ready');
  // Read the diagnostic records in the page: console message text renders objects differently per engine.
  await expect.poll(()=>p.evaluate(()=>JSON.stringify(window.__cimDiagnostics)),{message:name}).toMatch(/CIM-HST-005/);
 }
});
