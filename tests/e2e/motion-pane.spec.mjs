import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtureExperience} from '../helpers/multipane-experience.mjs';
import {motionFixture} from '../helpers/motion-fixture.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium'});
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));let server,origin;
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/multipane/controls.css"><main id="fixture"></main><script type="module">
import {createMotionFixtureDriver} from '/harness/motion-test-driver.mjs';
import {createVerifiedMediaAccess} from '/src/multipane/motion-media.mjs';
import {mountMultiPaneControls} from '/src/multipane/controls.mjs';
const {experience,media}=await(await fetch('/data'+location.search)).json();
const mode=new URLSearchParams(location.search).get('mode')??'good';
const bindings={'pack:media/placeholder.webm':'/__cim_fixture_media/'+mode+'.webm','pack:media/placeholder.vtt':'/__cim_fixture_media/captions.vtt','attachment:10':'/__cim_fixture_media/'+mode+'.webm','attachment:20':'/__cim_fixture_media/captions.vtt'};
const access=createVerifiedMediaAccess(media,{origin:location.origin,bindings,timeoutMs:1500});
const slots=Object.fromEntries(experience.renderer_config.panes.map(p=>[p.id,document.createElement(p.id==='motion'?'div':'pre')]));
const driver=createMotionFixtureDriver(experience,slots,{access,media,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
const view=mountMultiPaneControls({root:document.querySelector('#fixture'),session:driver.session,experience,slots,instanceId:'motion'});
window.fixture={...driver,slots,access,media,view,dispose(){view.dispose();driver.dispose();access.dispose();}};
</script>`;
const released=new Set();
test.beforeAll(async()=>{server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(url.pathname==='/data'){const {map}=motionFixture();if(url.searchParams.has('attachment')){map.assets[0].source={type:'attachment',id:10};map.assets[0].captions.source={type:'attachment',id:20};}map.assets.push({...structuredClone(map.assets[0]),id:'mlflow-missing'});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({experience:fixtureExperience(),media:map}));return;}
 if(url.pathname==='/__cim_fixture_media/missing.webm'){res.writeHead(404).end();return;}
 if(url.pathname==='/__cim_fixture_media/tampered.webm'){res.setHeader('Content-Type','video/webm');const {bytes}=motionFixture();res.end(Buffer.alloc(bytes.length));return;}
 if(url.pathname.startsWith('/__cim_fixture_media/')){const captions=url.pathname.endsWith('.vtt');res.setHeader('Content-Type',captions?'text/vtt':'video/webm');res.end((await readFile(resolve(root,'tests/fixtures/motion/placeholder.'+(captions?'vtt':'webm')))));return;}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',extname(path)==='.css'?'text/css':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});
test.afterAll(async()=>new Promise(r=>server.close(r)));
const open=async(page,query='')=>{await page.goto(origin+query);await page.waitForFunction(()=>window.fixture?.session);};
const gui=page=>page.evaluate(()=>{fixture.session.dispatch({type:'jump',index:1});fixture.session.dispatch({type:'play'});});
for(const[width,height]of [[1366,768],[1536,864],[1920,1080]])test.describe(`${width}x${height}`,()=>{
 test.use({viewport:{width,height}});
 test('[MOT-07] verified Blob playback captions pause resume completion and hold',async({page},info)=>{
  await open(page);await gui(page);const pane=page.locator('.motion-pane');await expect(pane).toContainText('Placeholder GUI · simulated');await expect(pane).toContainText('Placeholder content');await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);const video=pane.locator('video');await expect(video).toHaveAttribute('src',/^blob:/);await expect(pane.locator('track')).toHaveAttribute('src',/^blob:/);
  expect(await video.evaluate(v=>v.textTracks[0].mode)).toBe('showing');await page.evaluate(()=>fixture.advance(400));await page.evaluate(()=>fixture.session.dispatch({type:'pause'}));await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);const at=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(120);expect(await video.evaluate(v=>v.currentTime)).toBeCloseTo(at,1);
  await page.evaluate(()=>fixture.session.dispatch({type:'play'}));await page.evaluate(()=>fixture.advance(1500));await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');expect(await video.evaluate(v=>v.ended||v.currentTime>=v.duration-0.15)).toBe(true);
  const sha=await video.evaluate(async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(v.src)).arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''));expect(sha).toBe(await page.evaluate(()=>fixture.media.assets[0].sha256));await page.evaluate(()=>{fixture.session.dispatch({type:'next'});fixture.session.dispatch({type:'tab',tab:'motion'});});await expect(page.locator('[data-mp-panel="motion"]')).toContainText('Waiting on next GUI action');expect(await video.evaluate(v=>v.paused)).toBe(true);await page.screenshot({path:info.outputPath('motion.png')});
 });
 test('[MOT-08] reduced motion shows still and alternative with no automatic play',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await open(page,'?attachment');await gui(page);await expect(page.locator('.motion-pane')).toContainText('Simulated GUI test pattern');await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);expect(await page.locator('.motion-pane video').evaluate(v=>v.paused)).toBe(true);await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');});
 test('[MOT-09] missing and tampered clips fail safely and retain fallback while held',async({page},info)=>{for(const mode of ['missing','tampered']){await open(page,'?mode='+mode);await gui(page);const pane=page.locator('.motion-pane');await expect(pane).toContainText('GUI recording unavailable');await expect(pane).toContainText('CIM-PANE-MEDIA-UNAVAILABLE');await expect(pane).toContainText('Simulated GUI test pattern');await page.evaluate(()=>fixture.advance(500));await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');await page.evaluate(()=>{fixture.session.dispatch({type:'next'});fixture.session.dispatch({type:'tab',tab:'motion'});});await expect(pane).toContainText('GUI recording unavailable');await expect(page.locator('[data-mp-panel="motion"]')).toContainText('Waiting on next GUI action');await expect(page.locator('[data-mp-context="explanation"]')).toBeVisible();await page.screenshot({path:info.outputPath('fallback-'+mode+'.png')});}});
 test('[MOT-10] buffering holds every pane and never means completion',async({page})=>{await open(page);await gui(page);await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);await page.locator('.motion-pane video').evaluate(v=>v.dispatchEvent(new Event('waiting')));const before=await page.evaluate(()=>({state:fixture.session.read(),writes:fixture.log.length}));await page.evaluate(()=>fixture.advance(500));expect(await page.evaluate(()=>fixture.session.read().progress)).toBe('active');expect(await page.evaluate(()=>fixture.log.length)).toBe(before.writes);await page.evaluate(()=>fixture.session.dispatch({type:'pause'}));await page.locator('.motion-pane video').evaluate(v=>v.dispatchEvent(new Event('canplay')));await page.evaluate(()=>fixture.advance(500));expect(await page.evaluate(()=>fixture.log.length)).toBe(before.writes);await page.evaluate(()=>{fixture.session.dispatch({type:'play'});fixture.session.dispatch({type:'jump',index:7});});await expect.poll(()=>page.evaluate(()=>fixture.session.read().index)).toBe(7);});
});
