import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capacityExperience} from '../helpers/diagram-capacity-fixture.mjs';
import {compositionFixture} from '../helpers/composition-fixture.mjs';
import {motionFixture} from '../helpers/motion-fixture.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium'});
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));let server,origin;
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/multipane/controls.css"><link rel="stylesheet" href="/src/multipane/composition.css"><link rel="stylesheet" href="/src/multipane/engineering.css"><main id="fixture"></main><script type="module">
import {mountComposedPlayer} from '/src/multipane/composition.mjs';
import {createMultiPaneFixtureDriver} from '/harness/multipane-test-driver.mjs';
import {createVerifiedMediaAccess} from '/src/multipane/motion-media.mjs';
const data=await(await fetch('/data'+location.search)).json();window.sample=data;
const access=createVerifiedMediaAccess(data.media,{origin:location.origin,bindings:{},timeoutMs:1000});
window.fixture=mountComposedPlayer({root:document.querySelector('#fixture'),...data,access,createDriver:createMultiPaneFixtureDriver});
fixture.session.dispatch({type:'jump',index:data.index});</script>`;
test.beforeAll(async()=>{server=createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(u.pathname==='/data'){const name=u.searchParams.get('case')??'nine',f=name==='custody'?compositionFixture():capacityExperience(name);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({experience:f.experience,engineering:f.engineering,media:motionFixture({format:'mp4'}).map,index:name==='custody'?7:0}));return;}const path=resolve(root,'.'+decodeURIComponent(u.pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',extname(path)==='.css'?'text/css':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});
test.afterAll(async()=>new Promise(r=>server.close(r)));
const open=async(page,name)=>{await page.goto(origin+'?case='+name);await page.waitForFunction(()=>window.fixture?.session);await expect(page.locator('.engineering-diagram')).toContainText('Placeholder content');};
async function complete(page,mode){
 const state=await page.evaluate(async()=>{const {diagramSnapshot}=await import('/src/multipane/engineering.mjs');return diagramSnapshot(sample.engineering,sample.engineering.beats[sample.index].id);});
 const pane=page.locator('.engineering-diagram');await expect(pane.locator('[data-edge-id]')).toHaveCount(state.flows.length);
 for(const f of state.flows){await expect(pane.locator(`[data-edge-id="${f.id}"]`)).toContainText(f.artifact);await expect(pane.locator('[data-diagram-evidence]')).toContainText(f.id);await expect(pane.locator('[data-diagram-evidence]')).toContainText(f.evidence);}
 if(mode==='graph')await pane.locator('[data-diagram-text] summary').click();
 const text=await pane.locator('[data-diagram-full-state]').textContent();
 for(const n of state.nodes)expect(text).toContain(`Location ${n.id} on host ${n.host}`);
 for(const[id,a]of Object.entries(state.state.artifacts))expect(text).toContain(`Artifact ${id}: ${a.status}`);
 for(const f of state.flows)expect(text).toContain(`Flow ${f.id}:`);
 if(mode==='graph'){const description=await pane.locator('svg desc').textContent();expect(description).toBe(text);await pane.locator('[data-diagram-text] summary').click();}
}
async function geometry(page){
 const result=await page.locator('[data-diagram-svg]').evaluate(svg=>{const view=svg.viewBox.baseVal,box=svg.getBoundingClientRect(),slot=svg.closest('.engineering-graph').getBoundingClientRect();let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};for(let p=svg.parentElement;p;p=p.parentElement){const c=getComputedStyle(p);if(['hidden','clip','scroll','auto'].includes(c.overflowX)||['hidden','clip','scroll','auto'].includes(c.overflowY)){const b=p.getBoundingClientRect();clip={left:Math.max(clip.left,b.left),right:Math.min(clip.right,b.right),top:Math.max(clip.top,b.top),bottom:Math.min(clip.bottom,b.bottom)};}}
 const elements=[...svg.querySelectorAll('rect,text,path,circle')].map(e=>{const b=e.getBBox(),c=e.getBoundingClientRect();return{tag:e.tagName,text:e.textContent,x:b.x,y:b.y,width:b.width,height:b.height,left:c.left,right:c.right,top:c.top,bottom:c.bottom,font:e.tagName==='text'?parseFloat(getComputedStyle(e).fontSize):null};});
 return{view:{x:view.x,y:view.y,width:view.width,height:view.height},box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},slot:{left:slot.left,right:slot.right,top:slot.top,bottom:slot.bottom},clip,elements,overflow:getComputedStyle(svg).overflow,slotOverflow:getComputedStyle(svg.closest('.engineering-graph')).overflow,labels:[...svg.querySelectorAll('[data-label-raw]')].map(t=>({raw:t.dataset.labelRaw,text:t.textContent}))};});
 expect(result.overflow).not.toMatch(/hidden|clip/);expect(result.slotOverflow).not.toMatch(/hidden|clip/);
 for(const e of result.elements){expect(e.x,e.text).toBeGreaterThanOrEqual(result.view.x);expect(e.y,e.text).toBeGreaterThanOrEqual(result.view.y);expect(e.x+e.width,e.text).toBeLessThanOrEqual(result.view.x+result.view.width+.1);expect(e.y+e.height,e.text).toBeLessThanOrEqual(result.view.y+result.view.height+.1);if(e.font)expect(e.font).toBeGreaterThanOrEqual(12);}
 for(const b of [result.slot,result.clip]){expect(result.box.left).toBeGreaterThanOrEqual(b.left-.1);expect(result.box.right).toBeLessThanOrEqual(b.right+.1);expect(result.box.top).toBeGreaterThanOrEqual(b.top-.1);expect(result.box.bottom).toBeLessThanOrEqual(b.bottom+.1);}
 for(const l of result.labels)expect(l.text).toBe(l.raw);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
}
for(const[width,height]of [[1366,768],[1536,864],[1920,1080]])test.describe(`${width}x${height}`,()=>{
 test.use({viewport:{width,height}});
 for(const[tag,name,mode]of [['CAP-01','nine','graph'],['CAP-02','five','text'],['CAP-03','long','text'],['CAP-04','limit','graph'],['CAP-04','over','text'],['CAP-04','custody','graph']])test(`[${tag}] ${name} complete bounded outcome`,async({page},info)=>{await open(page,name);if(mode==='graph'){expect(await page.locator('[data-diagram-svg]').count()).toBe(1);await geometry(page);}else{const note=page.locator('.engineering-diagram').getByRole('status');expect(await note.count()).toBe(1);await expect(note).toBeVisible();await expect(note).toContainText('too large');expect(await note.ariaSnapshot()).toContain('too large');expect(await page.locator('[data-diagram-svg]').count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}await complete(page,mode);await page.screenshot({path:info.outputPath(name+'.png')});});
 test('[CAP-04][CAP-05] wrapped labels and four-artifact/absent descriptions stay whole',async({page})=>{for(const name of ['label','four']){await open(page,name);expect(await page.locator('[data-diagram-svg]').count()).toBe(1);await geometry(page);await complete(page,'graph');}await open(page,'nine');await page.evaluate(()=>fixture.session.dispatch({type:'start'}));const description=await page.locator('svg desc').textContent();expect(description).toContain('Artifact a0: absent');await geometry(page);});
 test('[CAP-07] multi-row mid-transfer token is routed clear of labels',async({page},info)=>{await open(page,'nine');await page.evaluate(()=>fixture.session.dispatch({type:'play'}));await page.evaluate(()=>fixture.advance(80));await expect(page.locator('[data-graph-token]')).toHaveCount(1);await geometry(page);const token=await page.locator('[data-graph-token]').evaluate(t=>{const b=t.getBoundingClientRect();return {visible:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===t,x:+t.getAttribute('cx'),y:+t.getAttribute('cy')};});expect(token.visible).toBe(true);expect(token.x).toBe(610);await page.screenshot({path:info.outputPath('mid-transfer.png')});});
});
