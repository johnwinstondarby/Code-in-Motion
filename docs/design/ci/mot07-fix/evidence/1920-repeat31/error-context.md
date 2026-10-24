# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/motion-pane.spec.mjs >> 1920x1080 >> [MOT-07] verified Blob playback captions pause resume completion and hold
- Location: tests/e2e/motion-pane.spec.mjs:38:2

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 30000ms exceeded.
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {createHash} from 'node:crypto';
  3  | import {createServer} from 'node:http';
  4  | import {readFile,writeFile} from 'node:fs/promises';
  5  | import {resolve,extname,sep} from 'node:path';
  6  | import {fileURLToPath} from 'node:url';
  7  | import {fixtureExperience} from '../helpers/multipane-experience.mjs';
  8  | import {motionFixture} from '../helpers/motion-fixture.mjs';
  9  | import {installMotionDiagnostics,observeMotionSession,recordMotionCheck,recordMotionFailure} from '../helpers/motion-diagnostics.mjs';
  10 | test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium',trace:'retain-on-failure',screenshot:'only-on-failure'});
  11 | test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)await recordMotionFailure(page,info);});
  12 | const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));let server,origin;
  13 | const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/multipane/controls.css"><link rel="stylesheet" href="/src/multipane/motion.css"><main id="fixture"></main><script type="module">
  14 | import {createMotionFixtureDriver,attachMotionFixtureSurface} from '/harness/motion-test-driver.mjs';
  15 | import {createVerifiedMediaAccess} from '/src/multipane/motion-media.mjs';
  16 | import {mountMultiPaneControls} from '/src/multipane/controls.mjs';
  17 | const {experience,media}=await(await fetch('/data'+location.search)).json();
  18 | const mode=new URLSearchParams(location.search).get('mode')??'good';
  19 | const bindings={'pack:media/placeholder.mp4':'/__cim_fixture_media/'+mode+'.mp4','pack:media/placeholder.vtt':'/__cim_fixture_media/captions.vtt','attachment:10':'/__cim_fixture_media/'+mode+'.mp4','attachment:20':'/__cim_fixture_media/captions.vtt'};
  20 | const access=createVerifiedMediaAccess(media,{origin:location.origin,bindings,timeoutMs:1500});
  21 | const slots=Object.fromEntries(experience.renderer_config.panes.map(p=>[p.id,document.createElement(p.id==='motion'?'div':'pre')]));
  22 | const driver=createMotionFixtureDriver(experience,slots,{access,media,...(window.__motionCompleted?{observeMotionCompletion:window.__motionCompleted}:{}),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  23 | const view=mountMultiPaneControls({root:document.querySelector('#fixture'),session:driver.session,experience,slots,instanceId:'motion'});
  24 | const surface=attachMotionFixtureSurface(document.querySelector('#fixture'),driver.session);
  25 | window.fixture={...driver,slots,access,media,view,dispose(){surface.dispose();view.dispose();driver.dispose();access.dispose();}};
  26 | </script>`;
  27 | const released=new Set();
  28 | test.beforeAll(async()=>{server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(url.pathname==='/data'){const {map,bytes}=motionFixture({format:"mp4"});if(url.searchParams.get('mode')==='undecodable')map.assets[0].sha256=createHash('sha256').update(Buffer.alloc(bytes.length)).digest('hex');if(url.searchParams.has('attachment')){map.assets[0].source={type:'attachment',id:10};map.assets[0].captions.source={type:'attachment',id:20};}map.assets.push({...structuredClone(map.assets[0]),id:'mlflow-missing',alt:'Second simulated GUI clip: metadata view, not lab evidence.'});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({experience:fixtureExperience(),media:map}));return;}
  29 |  if(url.pathname==='/__cim_fixture_media/missing.mp4'){res.writeHead(404).end();return;}
  30 |  if(['/__cim_fixture_media/tampered.mp4','/__cim_fixture_media/undecodable.mp4'].includes(url.pathname)){res.setHeader('Content-Type','video/mp4');const {bytes}=motionFixture({format:"mp4"});res.end(Buffer.alloc(bytes.length));return;}
  31 |  if(url.pathname.startsWith('/__cim_fixture_media/')){const captions=url.pathname.endsWith('.vtt');res.setHeader('Content-Type',captions?'text/vtt':'video/mp4');res.end((await readFile(resolve(root,'tests/fixtures/motion/placeholder.'+(captions?'vtt':'mp4')))));return;}
  32 |  const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',extname(path)==='.css'?'text/css':'text/javascript');res.end(await readFile(path));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});
  33 | test.afterAll(async()=>new Promise(r=>server.close(r)));
  34 | const open=async(page,query='')=>{await page.goto(origin+query);await page.waitForFunction(()=>window.fixture?.session);};
  35 | const gui=page=>page.evaluate(()=>{fixture.session.dispatch({type:'jump',index:1});fixture.session.dispatch({type:'play'});});
  36 | for(const[width,height]of [[1366,768],[1536,864],[1920,1080]])test.describe(`${width}x${height}`,()=>{
  37 |  test.use({viewport:{width,height}});
  38 |  test('[MOT-07] verified Blob playback captions pause resume completion and hold',async({page},info)=>{
> 39 |   await installMotionDiagnostics(page);await open(page);await observeMotionSession(page);if(process.env.CIM_MOTION_DIAGNOSTICS!=='1'){expect(await page.evaluate(()=>typeof window.__motionDiagnosticSnapshot)).toBe('undefined');expect(await page.evaluate(()=>Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime').set.toString())).toContain('[native code]');}await gui(page);const pane=page.locator('.motion-pane');await expect(pane).toContainText('Placeholder GUI · simulated');await expect(pane).toContainText('Placeholder content');await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);const video=pane.locator('video');await video.evaluate(v=>{window.videoEvents=[];for(const event of ['play','playing','pause','seeking','seeked','waiting','canplay'])v.addEventListener(event,()=>videoEvents.push({event,time:v.currentTime,paused:v.paused,intent:fixture.session.read().playing}));});await expect(video).toHaveAttribute('src',/^blob:/);await expect(pane.locator('track')).toHaveAttribute('src',/^blob:/);
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ^ Error: page.waitForFunction: Test timeout of 30000ms exceeded.
  40 |   expect(await video.evaluate(v=>v.textTracks[0].mode)).toBe('showing');await expect.poll(()=>video.evaluate(v=>[...(v.textTracks[0].activeCues??[])].map(c=>c.text).join(' '))).toContain('Placeholder GUI recording');await page.screenshot({path:info.outputPath('motion-active.png')});await page.evaluate(()=>fixture.session.dispatch({type:'tab',tab:'console'}));await expect(page.getByRole('tabpanel')).toHaveCount(1);await expect(page.locator('[data-mp-panel=motion]')).toHaveAttribute('aria-hidden','true');await page.evaluate(()=>fixture.advance(400));await page.evaluate(()=>fixture.session.dispatch({type:'pause'}));await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);await expect.poll(()=>video.evaluate(v=>v.seeking)).toBe(false);const at=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(120);const after=await video.evaluate(v=>({time:v.currentTime,paused:v.paused,seeking:v.seeking,intent:fixture.session.read().playing}));if(Math.abs(after.time-at)>=0.05)console.log('Pause drift',JSON.stringify({at,after,clock:await page.evaluate(()=>fixture.clockEvents),video:await page.evaluate(()=>window.videoEvents)}));expect(after.time).toBeCloseTo(at,1);
  41 |   await page.evaluate(()=>fixture.session.dispatch({type:'play'}));await page.evaluate(()=>fixture.advance(1500));await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');expect(await recordMotionCheck(page,video,info)).toBe(true);
  42 |   const sha=await video.evaluate(async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(v.src)).arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''));expect(sha).toBe(await page.evaluate(()=>fixture.media.assets[0].sha256));await page.evaluate(()=>{fixture.session.dispatch({type:'next'});fixture.session.dispatch({type:'tab',tab:'motion'});});await expect(page.locator('[data-mp-panel="motion"]')).toContainText('Waiting on next GUI action');expect(await video.evaluate(v=>v.paused)).toBe(true);await page.screenshot({path:info.outputPath('motion.png')});
  43 |  });
  44 |  test('[MOT-22] native play from an ended verified clip preserves its final hold',async({page})=>{
  45 |   await open(page);await gui(page);await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);await page.evaluate(()=>fixture.advance(1500));await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');
  46 |   const state=await page.locator('.motion-pane video').evaluate(async v=>{let observed=false;v.addEventListener('play',()=>{observed=true;},{once:true});try{await v.play();}catch{}return{observed,time:v.currentTime,duration:v.duration,paused:v.paused};});
  47 |   expect(state.observed).toBe(true);expect(state.paused).toBe(true);expect(state.time>=state.duration-0.15).toBe(true);
  48 |  });
  49 |  test('[MOT-08] reduced motion shows still and alternative with no automatic play',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await open(page,'?attachment');await gui(page);await expect(page.locator('.motion-pane')).toContainText('Simulated GUI test pattern');await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);expect(await page.locator('.motion-pane video').evaluate(v=>v.paused)).toBe(true);await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');});
  50 |  test('[MOT-09] missing and tampered clips fail safely and retain fallback while held',async({page},info)=>{for(const mode of ['missing','tampered','undecodable']){await open(page,'?mode='+mode);await gui(page);const pane=page.locator('.motion-pane');await expect(pane).toContainText('GUI recording unavailable');await expect(pane).toContainText('CIM-PANE-MEDIA-UNAVAILABLE');await expect(pane).toContainText('Simulated GUI test pattern');await page.evaluate(()=>fixture.advance(500));await expect.poll(()=>page.evaluate(()=>fixture.session.read().progress)).toBe('settled');await page.evaluate(()=>{fixture.session.dispatch({type:'next'});fixture.session.dispatch({type:'tab',tab:'motion'});});await expect(pane).toContainText('GUI recording unavailable');await expect(page.locator('[data-mp-panel="motion"]')).toContainText('Waiting on next GUI action');await expect(page.locator('[data-mp-context="explanation"]')).toBeVisible();await page.screenshot({path:info.outputPath('fallback-'+mode+'.png')});}});
  51 |  test('[MOT-16] preparation holds peers and a jump cancels without waiting',async({page})=>{
  52 |   let release;const held=new Promise(resolve=>{release=resolve;});await page.route('**/__cim_fixture_media/good.mp4',async route=>{await held;await route.continue();});
  53 |   await open(page);await gui(page);const writes=await page.evaluate(()=>fixture.log.length);await page.evaluate(()=>fixture.advance(500));expect(await page.evaluate(()=>fixture.log.length)).toBe(writes);expect(await page.evaluate(()=>fixture.session.read().progress)).toBe('active');
  54 |   await page.evaluate(()=>fixture.session.dispatch({type:'pause'}));release();await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);expect(await page.evaluate(()=>fixture.session.read().playing)).toBe(false);expect(await page.locator('.motion-pane video').evaluate(v=>v.paused)).toBe(true);
  55 |   await page.evaluate(()=>{fixture.session.dispatch({type:'play'});fixture.session.dispatch({type:'jump',index:7});});expect(await page.evaluate(()=>fixture.session.read().index)).toBe(7);
  56 |  });
  57 |  test('[MOT-17] navigation cancels preparation and late results cannot replace the destination',async({page})=>{
  58 |   let release;const held=new Promise(resolve=>{release=resolve;});await page.route('**/__cim_fixture_media/good.mp4',async route=>{await held;try{await route.continue();}catch{/* Navigation may already have aborted this request. */}});
  59 |   await open(page);await gui(page);await page.evaluate(()=>fixture.session.dispatch({type:'jump',index:7}));expect(await page.evaluate(()=>fixture.session.read().index)).toBe(7);release();await expect(page.locator('.motion-pane')).toContainText('Second simulated GUI clip');await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);await page.waitForTimeout(150);await expect(page.locator('.motion-pane')).toContainText('Second simulated GUI clip');expect(await page.evaluate(()=>fixture.session.read().index)).toBe(7);
  60 |  });
  61 |  test('[MOT-18] native playback cannot override a paused shared clock',async({page})=>{
  62 |   await open(page);await gui(page);await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);await expect.poll(()=>page.evaluate(()=>fixture.clockEvents.length)).toBeGreaterThan(0);const video=page.locator('.motion-pane video');await expect.poll(()=>video.evaluate(v=>!v.paused&&v.currentTime>0.05)).toBe(true);await page.evaluate(()=>fixture.session.dispatch({type:'pause'}));await expect.poll(()=>video.evaluate(v=>v.seeking)).toBe(false);await page.waitForTimeout(60);await video.evaluate(v=>{window.nativePlayAttempted=false;v.addEventListener('play',()=>{window.nativePlayAttempted=true;},{once:true});const probe=document.createElement('button');probe.id='native-play-probe';probe.textContent='Probe native play';probe.onclick=()=>{v.play().catch(()=>{});};document.body.append(probe);});await page.locator('#native-play-probe').click();await expect.poll(()=>page.evaluate(()=>window.nativePlayAttempted)).toBe(true);await expect.poll(()=>video.evaluate(v=>v.paused),{timeout:400}).toBe(true);expect(await page.evaluate(()=>fixture.session.read().playing)).toBe(false);
  63 |  });
  64 |  test('[MOT-21] disposing Motion revokes its verified URLs and removes its DOM',async({page})=>{
  65 |   await open(page);await gui(page);await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);await expect.poll(()=>page.evaluate(()=>fixture.clockEvents.length)).toBeGreaterThan(0);const url=await page.locator('.motion-pane video').getAttribute('src');await page.evaluate(()=>fixture.adapter.pane.dispose());await expect(page.locator('.motion-pane')).toHaveCount(0);expect(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},url)).toBe(true);await page.evaluate(()=>fixture.advance(500));await expect(page.locator('[data-mp-context="explanation"]')).toBeVisible();
  66 |  });
  67 |  test('[MOT-10] buffering holds every pane and never means completion',async({page})=>{await open(page);await gui(page);await page.waitForFunction(()=>document.querySelector('.motion-pane video')?.readyState>=2);await page.locator('.motion-pane video').evaluate(v=>{v.blockReady=e=>e.stopImmediatePropagation();v.addEventListener('canplay',v.blockReady,true);v.dispatchEvent(new Event('waiting'));});const before=await page.evaluate(()=>({state:fixture.session.read(),writes:fixture.log.length}));await page.evaluate(()=>fixture.advance(500));expect(await page.evaluate(()=>fixture.session.read().progress)).toBe('active');expect(await page.evaluate(()=>fixture.log.length)).toBe(before.writes);await page.evaluate(()=>fixture.session.dispatch({type:'pause'}));await page.locator('.motion-pane video').evaluate(v=>{v.removeEventListener('canplay',v.blockReady,true);v.dispatchEvent(new Event('canplay'));});await page.evaluate(()=>fixture.advance(500));expect(await page.evaluate(()=>fixture.log.length)).toBe(before.writes);await page.evaluate(()=>{fixture.session.dispatch({type:'play'});fixture.session.dispatch({type:'jump',index:7});});await expect.poll(()=>page.evaluate(()=>fixture.session.read().index)).toBe(7);});
  68 | });
  69 | 
```