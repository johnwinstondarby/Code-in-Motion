import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_PRESETS } from '../../wordpress/assets/theme-presets.mjs';

test.use({ colorScheme: 'dark', browserName: process.env.CIM_PLAYER_BROWSER ?? 'chromium' });

// Test-only production-component composition. No fixture enters the release registry.
const repository = fileURLToPath(new URL('../../', import.meta.url));
let server;
let origin;
const fixture = `<!doctype html><link rel="stylesheet" href="/wordpress/assets/cim.css">
<style>body {background:#111;color:#ddd} section {background:magenta;color:yellow} p {color:red}</style>
<div class="cim" data-cim-experience="git-repository-practice" data-cim-instance="first"><div data-cim-renderer-root></div><div class="cim-fallback">Fallback</div></div>
<div class="cim" data-cim-experience="git-repository-practice" data-cim-instance="second"><div data-cim-renderer-root></div><div class="cim-fallback">Fallback</div></div>
<script type="module">
import { createWordPressLiveHost } from '/src/host/wordpress-live-host.mjs';
import { createWordPressClockFactory } from '/src/host/wordpress-browser-bindings.mjs';
import { freezeValidatedExperience } from '/src/experience/freeze-validated-experience.mjs';
import { createConsoleRenderer } from '/src/renderers/subjects/console/renderer.mjs';
import { createWordPressPlayerBinding } from '/wordpress/assets/player-binding.mjs';
import { createWordPressDeepLinkResolver } from '/src/host/wordpress-deep-link.mjs';
const rawExperience = await (await fetch('/experiences/git/git-repository-practice.json')).json();
if (new URL(location.href).searchParams.has('copy-override')) {
 for (const state of [rawExperience.initial_state,...rawExperience.steps.map(step=>step.state)]) {
  for (const entry of state.transcript) if (entry.command==='git status') entry.copy='git status --short';
 }
}
if (new URL(location.href).searchParams.has('legacy-console')) {
 rawExperience.schema = 'localis.cim/v1'; delete rawExperience.presentation;
 for (const step of rawExperience.steps) { delete step.beat; delete step.commentary.anchor; delete step.commentary.evidence; delete step.commentary.risk; }
}
const experience = freezeValidatedExperience(rawExperience);
const errors = [];
const sources = [];
const rendererObservers = new Set();
const BrowserMutationObserver = window.MutationObserver;
window.MutationObserver = class extends BrowserMutationObserver {
 observe(target, options) {
  super.observe(target, options);
  if (target.matches?.('[data-cim-renderer-root]')) rendererObservers.add(this);
 }
 disconnect() { super.disconnect(); rendererObservers.delete(this); }
};
const host = createWordPressLiveHost({document,
 matchMedia: q => window.matchMedia(q),
 experienceLoader: Object.freeze({load: async () => experience}),
 rendererResolver: Object.freeze({resolve: async () => createConsoleRenderer()}),
 clockFactory: createWordPressClockFactory({now: () => performance.now(), setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame}),
 entryResolver: createWordPressDeepLinkResolver({readFragment:() => location.hash}), diagnostics: Object.freeze({report: record => errors.push(record)})});
const roots = [...document.querySelectorAll('.cim')];
const bindings = [];
const frames = [];
let sampling = true;
function sample() {
 for (const root of roots) {
  const player = root.querySelector('[data-cim-player]');
  const transport = root.querySelector('[data-cim-transport-controls]');
  frames.push({ready: root.dataset.cimState === 'ready', player: !!player, transport: !!transport,
   playerVisible: !!player && getComputedStyle(player).display !== 'none',
   transportVisible: !!transport && getComputedStyle(transport).display !== 'none'});
 }
 if (sampling) requestAnimationFrame(sample);
}
sample();
await host.mount();
const preReady = roots.map(root => ({state:root.dataset.cimState ?? null, rendererDisplay:getComputedStyle(root.querySelector('[data-cim-renderer-root]')).display, fallbackDisplay:getComputedStyle(root.querySelector('.cim-fallback')).display}));
for (const root of roots) {
 try {
  const originalCommands = host.commands(root);
  const commandPort = Object.freeze({...originalCommands, seek:(stepId, source) => {
    sources.push(source);
    return originalCommands.seek(stepId, source);
  }});
  const content = host.playerContent(root);
  const binding = createWordPressPlayerBinding({root, commandPort, observationPort:host.observations(root), content, onError:e => errors.push(String(e))});
  bindings.push(binding);
  if (new URL(location.href).searchParams.has('failure')) throw new Error('injected admission failure');
  // Deliberately span a browser frame with composition withheld.
  await new Promise(requestAnimationFrame);
  if (!host.present(root)) throw new Error('admission rejected');
 } catch(e) {
  bindings.at(-1)?.dispose();
  await host.disposeRoot(root);
  errors.push(String(e));
 }
}
window.playerTest = {host, roots, bindings, errors, frames, preReady, sources, rendererObservers};
sampling = false;
</script>`;

const productionFixture = `<!doctype html><link rel="stylesheet" href="/wordpress/assets/cim.css">
<div class="cim" data-cim-experience="git-repository-practice" data-cim-instance="production-v2"><div data-cim-renderer-root></div><div class="cim-fallback">Lesson unavailable.</div></div>
<div class="cim" data-cim-experience="git-basic-cycle" data-cim-instance="production-legacy"><div data-cim-renderer-root></div><div class="cim-fallback">Legacy lesson unavailable.</div></div>
<script type="module" src="/wordpress/assets/bootstrap-module.mjs"></script>`;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/mobile-gate') {
      response.setHeader('Content-Type', 'text/html');
      response.end(productionFixture.replace('type="module" src="/wordpress/assets/bootstrap-module.mjs"', 'src="/wordpress/assets/bootstrap.js"'));
      return;
    }
    if (pathname === '/production') {
      response.setHeader('Content-Type','text/html');response.end(productionFixture);return;
    }
    if (pathname === '/fixture') {
      response.setHeader('Content-Type', 'text/html');
      response.end(fixture);
      return;
    }
    const target = resolve(repository, '.' + decodeURIComponent(pathname));
    if (!target.startsWith(resolve(repository) + '/')) {
      // Windows path separator is handled by the URL-derived trusted fixture paths below.
      if (!target.startsWith(resolve(repository) + '\\')) { response.writeHead(403).end(); return; }
    }
    try {
      response.setHeader('Content-Type', ({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[extname(target)] ?? 'text/plain');
      response.end(await readFile(target));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(async () => { await new Promise(done => server.close(done)); });

test('mobile policy: narrow screens fetch no Player modules or lessons, including late embeds', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto(origin + '/mobile-gate');
  await expect(page.locator('[data-cim-state="desktop-required"]')).toHaveCount(2);
  await expect(page.locator('[data-cim-player]')).toHaveCount(0);
  await page.evaluate(() => {
    const root = document.createElement('div');
    root.setAttribute('data-cim-experience', 'git-basic-cycle');
    document.body.append(root);
  });
  await expect(page.locator('[data-cim-state="desktop-required"]')).toHaveCount(3);
  expect(requests.filter(path => path.endsWith('.mjs') || path.endsWith('.json'))).toEqual([]);
});

test('mobile policy: landscape touch-only devices do not load the Player', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(origin + '/mobile-gate');
    await expect(page.locator('[data-cim-state="desktop-required"]')).toHaveCount(2);
    await expect(page.locator('[data-cim-player]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('mobile policy: desktop still initializes the production Player', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/mobile-gate');
  await expect(page.locator('[data-cim-player="console-explanation"]')).toHaveCount(1);
  await expect(page.locator('[data-cim-state="desktop-required"]')).toHaveCount(0);
});

for (const [kind, role] of [['powershell','console-quiet'],['windows-cli','console-quiet'],['bash','console-quiet']]) {
  test(`CLI and copy: ${kind} badge uses neutral secondary Console text independently of kind and label`,async({page})=>{
    await page.route('**/experiences/git/git-repository-practice.json',async route=>{
      const response=await route.fetch();const lesson=await response.json();
      lesson.presentation.command_window={cli:{kind,label:'Custom shell label'}};
      await route.fulfill({response,json:lesson});
    });
    await open(page);const root=page.locator('.cim').first();const badge=root.locator('[data-cim-cli]');
    await expect(badge).toHaveText('Custom shell label');await expect(badge).toHaveAttribute('data-cim-cli',kind);
    for(const theme of ['localis','high-contrast','light']) {
      await root.getByLabel('Theme',{exact:true}).selectOption(theme);
      const hex=THEME_PRESETS[theme].colors[role];const rgb=`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
      await expect(badge).toHaveCSS('color',rgb);
    }
    const pane=await root.locator('[data-cim-pane="console"]').boundingBox();const box=await badge.boundingBox();
    expect(box.y).toBeLessThan(pane.y+60);await expect(badge).toHaveCSS('text-align','right');
    await expect(badge).toHaveCSS('font-size','20px');
  });
}

test('CLI and copy: exact authored override writes plain text without seeking and survives renderer replacement',async({page,context,browserName})=>{
  test.skip(browserName!=='chromium','Native clipboard permission proof runs in Chromium; binding behavior runs in all engines.');
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await open(page,'?copy-override');const root=page.locator('.cim').first();
  await root.locator('[data-cim-control="next"]').click();
  await root.locator('[data-role="copy"]').first().click();
  await expect(root.locator('[data-cim-copy-status]')).toHaveText('Copied command: git status --short');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('git status --short');
  expect(await page.evaluate(()=>playerTest.sources)).toEqual([]);
  await root.locator('[data-cim-control="end"]').click();
  await root.locator('[data-role="copy"]').last().click();
  const value=await root.locator('[data-role="copy"]').last().getAttribute('data-copy');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(value);
  await page.evaluate(()=>{const textarea=document.createElement('textarea');textarea.id='paste-target';document.body.appendChild(textarea);});
  await page.locator('#paste-target').focus();await page.keyboard.press('Control+V');
  await expect(page.locator('#paste-target')).toHaveValue(value);
});

test('CLI and copy: native drag selection and copy shortcuts leave navigation untouched',async({page,context,browserName})=>{
  if(browserName==='chromium') await context.grantPermissions(['clipboard-read','clipboard-write']);
  await open(page);const root=page.locator('.cim').first();await root.locator('[data-cim-control="next"]').click();
  const command=root.locator('[data-role="command"]').first();const box=await command.boundingBox();
  await page.mouse.move(box.x+1,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width-1,box.y+box.height/2,{steps:10});await page.mouse.up();
  expect(await page.evaluate(()=>getSelection().toString())).toBe('git status');
  await page.evaluate(()=>{
    window.copyEvents=[];document.addEventListener('copy',event=>copyEvents.push({prevented:event.defaultPrevented,selection:getSelection().toString()}));
    window.contextCopyEvents=[];document.addEventListener('contextmenu',event=>contextCopyEvents.push(event.defaultPrevented));
  });
  await page.keyboard.press('Control+C');
  await expect.poll(()=>page.evaluate(()=>copyEvents.length)).toBe(1);
  expect(await page.evaluate(()=>copyEvents[0])).toEqual({prevented:false,selection:'git status'});
  await command.click({button:'right'});
  expect(await page.evaluate(()=>contextCopyEvents)).toEqual([false]);
  for(const key of ['c','C']) expect(await command.evaluate((node,key)=>node.dispatchEvent(new KeyboardEvent('keydown',{key,metaKey:true,bubbles:true,cancelable:true})),key)).toBe(true);
  expect(await page.evaluate(()=>playerTest.sources)).toEqual([]);
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s02');
  if(browserName==='chromium') expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('git status');
});

test('CLI and copy: clipboard denial gives guidance, sibling stays usable and stale controls are inert',async({page})=>{
  await page.addInitScript(()=>{window.copyWrites=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:value=>{copyWrites.push(value);return Promise.reject(new Error('denied'));}}});});
  await open(page);const first=page.locator('.cim').first();const second=page.locator('.cim').nth(1);
  await first.locator('[data-cim-control="next"]').click();await first.locator('[data-role="copy"]').first().click();
  await expect(first.locator('[data-cim-copy-status]')).toContainText('Could not copy. Select the command text');
  await page.evaluate(()=>{const stale=playerTest.roots[0].querySelector('[data-role="copy"]');playerTest.bindings[0].dispose();stale.click();});
  expect(await page.evaluate(()=>copyWrites)).toEqual(['git status']);
  await second.locator('[data-cim-control="next"]').click();await second.locator('[data-role="copy"]').first().click();
  await expect(second.locator('[data-cim-copy-status]')).toContainText('Command: git status');
  expect(await page.evaluate(()=>copyWrites)).toEqual(['git status','git status']);
});

async function open(page, suffix = '') {
  await page.goto(origin + '/fixture' + suffix);
  await page.waitForFunction(() => !!window.playerTest);
}

test('line limn: all 18 Show entries target command, evidence or response after scrolling while paused', async ({page}) => {
  await open(page);
  const root = page.locator('.cim').first();
  await root.locator('[data-cim-control="end"]').click();
  const entries = await root.locator('[data-cim-commentary-entry]').evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute('data-cim-step-id'), anchor: node.getAttribute('data-cim-commentary-anchor'),
    evidence: JSON.parse(node.getAttribute('data-cim-commentary-evidence') ?? '[]')
  })));
  expect(entries).toHaveLength(18);
  for (const entry of entries) {
    await root.locator(`[data-cim-commentary-entry][data-cim-step-id="${entry.id}"] button`).first().click();
    const limned = root.locator('[data-cim-line-limn="flash"]');
    await expect(limned).toHaveCount(entry.anchor === 'output' ? entry.evidence.length : 1);
    const facts = await limned.evaluateAll(nodes => nodes.map(node => ({
      role: node.getAttribute('data-role'), output:node.getAttribute('data-output-id'),
      response:!!node.querySelector('[data-role="response"]'),
      top:node.getBoundingClientRect().top,
      paneTop:node.closest('[data-cim-console-viewport]').getBoundingClientRect().top,
      header:node.closest('[data-cim-renderer]').querySelector('[data-role="titlebar"]').getBoundingClientRect().height
    })));
    if (entry.anchor === 'command') expect(facts[0].role).toBe('command-line');
    if (entry.anchor === 'output') expect(facts.map(fact=>fact.output)).toEqual(entry.evidence);
    if (entry.anchor === 'response') expect(facts[0].response).toBe(true);
    expect(facts[0].top).toBeGreaterThanOrEqual(facts[0].paneTop + facts[0].header - 1);
    await expect(root.getByRole('button', {name:'Play',exact:true})).toBeVisible();
  }
  await expect(root.locator('[data-cim-line-limn="quiet"]')).toHaveCount(1,{timeout:3000});
  await expect(page.locator('.cim').nth(1).locator('[data-cim-line-limn]')).toHaveCount(0);
});

test('line limn: strong inset cue remains visible on all four sides in every theme', async ({page}) => {
  await open(page); const root=page.locator('.cim').first();
  await root.locator('[data-cim-control="next"]').click();
  const show=root.locator('[data-cim-commentary-anchor="command"] button').first();
  for(const theme of ['localis','high-contrast','light']) {
    await root.locator('[data-cim-theme-select]').selectOption(theme);
    await show.click(); const line=root.locator('[data-cim-line-limn="flash"]');
    await expect(line).toHaveCount(1);
    const read=()=>line.evaluate(node=>{
      const animation=node.getAnimations()[0]; animation.pause();
      try {
      animation.currentTime=200;
      const style=getComputedStyle(node),box=node.getBoundingClientRect();
      const pane=node.closest('[data-cim-console-viewport]').getBoundingClientRect();
      const width=parseFloat(style.outlineWidth),offset=parseFloat(style.outlineOffset);
      const prompt=node.querySelector('[data-role="prompt"]');
      const range=document.createRange(); range.setStart(prompt.firstChild,0); range.setEnd(prompt.firstChild,1);
      const textLeft=range.getBoundingClientRect().left;
      const backgrounds=[...node.querySelectorAll(':scope > span')].map(span=>getComputedStyle(span).backgroundColor);
      const edge=width+offset;
      const flash={width,offset,textGap:textLeft-box.left,backgrounds,color:style.outlineColor,background:style.backgroundColor,
        left:box.left-edge,right:box.right+edge,top:box.top-edge,bottom:box.bottom+edge,
        paneLeft:pane.left,paneRight:pane.right,paneTop:pane.top,paneBottom:pane.bottom};
      animation.currentTime=600; flash.midWidth=parseFloat(getComputedStyle(node).outlineWidth);
      animation.currentTime=1199; flash.quietBackground=getComputedStyle(node).backgroundColor;
      return flash;
      } finally { animation.cancel(); }
    });
    const cue=await read();
    expect(cue.width).toBe(3); expect(cue.offset).toBeLessThanOrEqual(-cue.width);
    expect(cue.textGap).toBeGreaterThan(cue.width + 1);
    expect(cue.backgrounds.every(color=>color==='rgba(0, 0, 0, 0)')).toBe(true);
    expect(cue.color).toBe(theme==='light'?'rgb(0, 0, 0)':'rgb(255, 255, 255)');
    expect(cue.background).not.toBe(cue.quietBackground); expect(cue.midWidth).toBe(3);
    expect(cue.left).toBeGreaterThanOrEqual(cue.paneLeft);
    expect(cue.right).toBeLessThanOrEqual(cue.paneRight);
    expect(cue.top).toBeGreaterThanOrEqual(cue.paneTop);
    expect(cue.bottom).toBeLessThanOrEqual(cue.paneBottom);
  }
});

test('line limn: tint retains readable dim text in flash and quiet across themes',async({page})=>{
  await open(page);const root=page.locator('.cim').first();await root.locator('[data-cim-control="end"]').click();
  for(const theme of ['localis','high-contrast','light']) {
    await root.locator('[data-cim-theme-select]').selectOption(theme);
    const ratios=await root.locator('[data-role="output-line"][data-tone="dim"]').first().evaluate(line=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
      const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
      const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const ratio=()=>{const a=lum(rgb(getComputedStyle(line.querySelector('[data-role="output-text"]')).color)),b=lum(rgb(getComputedStyle(line).backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
      line.setAttribute('data-cim-line-limn','flash');const animation=line.getAnimations()[0];animation.pause();
      try {animation.currentTime=200;const flash=ratio();line.setAttribute('data-cim-line-limn','quiet');return {flash,quiet:ratio()};}
      finally {animation.cancel();line.removeAttribute('data-cim-line-limn');}
    });
    expect(ratios.flash).toBeGreaterThanOrEqual(4.5);expect(ratios.quiet).toBeGreaterThanOrEqual(4.5);
  }
});

test('line limn: repeated clicks restart the cue, theme colors adapt and navigation clears it', async ({page}) => {
  await open(page); const root=page.locator('.cim').first();
  await root.locator('[data-cim-control="next"]').click();
  const show=root.locator('[data-cim-commentary-anchor="command"] button').first();
  for(const [theme,color] of [['localis','rgb(255, 255, 255)'],['high-contrast','rgb(255, 255, 255)'],['light','rgb(0, 0, 0)']]) {
    await root.locator('[data-cim-theme-select]').selectOption(theme);
    await show.click(); await expect(root.locator('[data-cim-line-limn="flash"]')).toHaveCount(1);
    expect(await root.locator('[data-cim-player]').evaluate(node=>getComputedStyle(node).getPropertyValue('--cim-limn').trim())).toBe(theme==='light'?'#000000':'#FFFFFF');
    await page.waitForTimeout(800);
    await show.click();
    await page.waitForTimeout(600);
    await expect(root.locator('[data-cim-line-limn="flash"]')).toHaveCount(1);
    const elapsed = await root.locator('[data-cim-line-limn="flash"]').evaluate(node=>node.getAnimations()[0]?.currentTime);
    expect(elapsed).toBeGreaterThan(400);
    expect(elapsed).toBeLessThan(1000);
    await expect(root.locator('[data-cim-line-limn="quiet"]')).toHaveCount(1,{timeout:2000});
    expect(await root.locator('[data-cim-line-limn="quiet"]').evaluate(node=>getComputedStyle(node).outlineColor)).not.toBe(color);
  }
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-line-limn]')).toHaveCount(0);
});

test('line limn: reduced motion stays steady and disposal clears emphasis', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'}); await open(page);
  const root=page.locator('.cim').first();
  await root.locator('[data-cim-control="next"]').click();
  await root.locator('[data-cim-commentary-anchor="command"] button').first().click();
  await expect(root.locator('[data-cim-line-limn="steady"]')).toHaveCount(1);
  expect(await root.locator('[data-cim-line-limn="steady"]').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
  await page.waitForTimeout(1400);
  await expect(root.locator('[data-cim-line-limn="steady"]')).toHaveCount(1);
  await page.evaluate(()=>playerTest.bindings[0].dispose());
  await expect(root.locator('[data-cim-line-limn]')).toHaveCount(0);
  expect(await page.evaluate(()=>playerTest.errors)).toEqual([]);
});

test('line limn: site-forced reduced motion stays steady without animation', async ({page}) => {
  await open(page,'?cim-motion-policy=reduce'); const root=page.locator('.cim').first();
  await root.locator('[data-cim-control="next"]').click();
  await root.locator('[data-cim-commentary-anchor="command"] button').first().click();
  await expect(root.locator('[data-cim-line-limn="steady"]')).toHaveCount(1);
  expect(await root.locator('[data-cim-line-limn="steady"]').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
});

test('line limn: disposal cancels a running cue without changing renderer canonical markup', async ({page}) => {
  await open(page); const root=page.locator('.cim').first();
  await root.locator('[data-cim-control="next"]').click();
  await root.locator('[data-cim-commentary-anchor="command"] button').first().click();
  await expect(root.locator('[data-cim-line-limn="flash"]')).toHaveCount(1);
  await page.evaluate(()=>playerTest.bindings[0].dispose());
  await page.waitForTimeout(1400);
  await expect(root.locator('[data-cim-line-limn]')).toHaveCount(0);
  expect(await page.evaluate(()=>playerTest.errors)).toEqual([]);
});

// Browser emulation can update prefers-contrast without notifying existing MQLs.
// Keep native objects/values and supply the missing OS-style notification only.
async function observeContrastQueries(page) {
  await page.addInitScript(()=>{
    const match=window.matchMedia.bind(window);window.testContrastQueries=[];
    window.matchMedia=query=>{const result=match(query);if(query==='(prefers-contrast: more)') testContrastQueries.push(result);return result;};
  });
}
async function updateContrastPreference(page,options) {
  await page.emulateMedia(options);
  await expect.poll(()=>page.evaluate(()=>matchMedia('(prefers-contrast: more)').matches)).toBe(options.contrast==='more');
  await page.evaluate(()=>{for(const query of [...testContrastQueries]) query.dispatchEvent(new Event('change'));});
}

test('production v2 admission uses registry loader bootstrap and final beat deep links alongside legacy',async({page})=>{
  const errors=[];page.on('console',async message=>{if(message.type()==='error') errors.push(...await Promise.all(message.args().map(argument=>argument.jsonValue().catch(()=>null))));});
  await page.goto(origin+'/production#cim/git-repository-practice/stage-hunk');
  const root=page.locator('[data-cim-instance="production-v2"]');
  const legacy=page.locator('[data-cim-instance="production-legacy"]');
  await expect(root).toHaveAttribute('data-cim-state','ready');
  await expect(legacy).toHaveAttribute('data-cim-state','ready');
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s04');
  await expect(root.locator('[data-cim-beat-progress]')).toHaveText('2 / 8 Â· Stage one change at a time');
  await expect(root.getByLabel('Theme',{exact:true})).toBeVisible();
  await expect(legacy.getByLabel('Theme',{exact:true})).toHaveCount(0);
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-beat-progress]')).toHaveText('3 / 8 Â· Review what is staged');
  await page.evaluate(()=>{location.hash='#cim/git-repository-practice/check-status';});
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s02');
  await page.evaluate(()=>{location.hash='#cim/git-repository-practice/stage-hunk';});
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s04');
  await page.evaluate(()=>{location.hash='#cim/git-repository-practice/stage-hunk--s03';});
  await expect.poll(()=>errors.some(record=>record?.code==='CIM-HST-002' && record?.operation==='deep_link_hashchange')).toBe(true);
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s04');
});

test('production v2 admission rejects incompatible engine minimum locally before any Console construction',async({page})=>{
  const errors=[];page.on('console',async message=>{if(message.type()==='error') errors.push(...await Promise.all(message.args().map(argument=>argument.jsonValue().catch(()=>null))));});
  await page.route('**/wordpress/experiences/git-repository-practice.json*',async route=>{
    const response=await route.fetch();const lesson=await response.json();lesson.engine_min='1.0.2';
    await route.fulfill({response,json:lesson});
  });
  await page.goto(origin+'/production');
  const root=page.locator('[data-cim-instance="production-v2"]');
  await expect(root).toHaveAttribute('data-cim-state','fallback');
  await expect(root.locator('[data-cim-player]')).toHaveCount(0);
  await expect(root.locator('[data-cim-renderer-root] > *')).toHaveCount(0);
  await expect(root.locator('.cim-fallback')).toBeVisible();
  await expect(page.locator('[data-cim-instance="production-legacy"]')).toHaveAttribute('data-cim-state','ready');
  await expect.poll(()=>errors.some(record=>record?.code==='CIM-EXP-015')).toBe(true);
});

test('v2 instructional consumers preserve phase evidence risk guidance ordering and renderer-owned focus',async({page})=>{
  await open(page);
  const root=page.locator('.cim').first();
  await expect(root.locator('[data-cim-commentary-risk]:visible')).toHaveCount(0);
  await root.locator('[data-cim-control="end"]').click();
  const lesson=await page.evaluate(async()=>await(await fetch('/experiences/git/git-repository-practice.json')).json());
  await expect(root.locator('[data-cim-commentary-evidence-label]')).toHaveCount(0);
  await expect(root).not.toContainText(/Related (output|response): \d+ lines?/);
  await expect(root.locator('[data-cim-commentary-risk]:visible')).toHaveCount(lesson.steps.filter(step=>step.commentary.risk).length);
  for(const step of lesson.steps) {
    const entry=root.locator(`[data-cim-commentary-entry][data-cim-step-id="${step.id}"]`);
    await expect(entry).toHaveAttribute('data-cim-commentary-anchor',step.commentary.anchor);
    await expect(entry.locator('[data-cim-commentary-phase]')).toHaveText({command:'Command',output:'Output',response:'Response'}[step.commentary.anchor]);
    if(step.commentary.evidence) await expect(entry).toHaveAttribute('data-cim-commentary-evidence',JSON.stringify(step.commentary.evidence));
    else await expect(entry).not.toHaveAttribute('data-cim-commentary-evidence',/./);
    if(step.commentary.risk) {
      await expect(entry.locator('[data-cim-commentary-risk]')).toHaveAttribute('data-cim-commentary-risk',step.commentary.risk.level);
      await expect(entry.locator('[data-cim-commentary-risk] [data-risk]')).toHaveText({'free-to-undo':'FREE TO UNDO','leaves-a-trace':'LEAVES A TRACE','cannot-be-undone':'CANNOT BE UNDONE'}[step.commentary.risk.level]);
      if(step.commentary.risk.guidance) await expect(entry.locator('[data-cim-risk-guidance]')).toHaveText(step.commentary.risk.guidance);
      expect(await entry.evaluate(node=>{
        const children=[...node.children];const prose=children.findIndex(child=>child.tagName==='P');
        const risk=children.findIndex(child=>child.hasAttribute('data-cim-commentary-risk'));
        const link=children.findIndex(child=>child.tagName==='A');return prose<risk && (link<0 || risk<link);
      })).toBe(true);
    }
    await entry.locator('button').click();
    await expect.poll(()=>root.locator('[data-role="output-line"][data-focused="true"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-output-id')))).toEqual(step.commentary.evidence??[]);
  }
});

test('learner themes render complete palettes without altering canonical state or Console DOM', async ({ page }) => {
  await open(page);
  const roots = page.locator('.cim');
  const first = roots.first();
  await first.locator('[data-cim-control="end"]').click();
  const before = await page.evaluate(() => ({
    canonical: playerTest.host.observations(playerTest.roots[0]).snapshot().canonical,
    renderer: playerTest.roots[0].querySelector('[data-cim-renderer="console/v1"]').innerHTML
  }));
  await page.addStyleTag({content: 'body { --cim-console-text: red; --cim-console-background: magenta; --cim-explanation-prose: yellow; --cim-wayfinding: red; } select { color:red; background:magenta }'});
  const rgb = hex => 'rgb(' + [1,3,5].map(index => parseInt(hex.slice(index,index+2),16)).join(', ') + ')';
  await expect(first.getByLabel('Theme', {exact:true})).toHaveCount(1);
  expect(await first.locator('[data-cim-theme-select] option').allTextContents()).toEqual(['Localis','High Contrast','Light']);
  for (const [id,{colors}] of Object.entries(THEME_PRESETS)) {
    await first.getByLabel('Theme',{exact:true}).selectOption(id);
    for (const root of [first,roots.nth(1)]) {
      await expect(root).toHaveAttribute('data-cim-theme',id);
      await expect(root.getByLabel('Theme',{exact:true})).toHaveValue(id);
      await expect(root).toHaveCSS('background-color',rgb(colors['frame-background']));
      await expect(root.locator('[data-cim-pane="console"]')).toHaveCSS('background-color',rgb(colors['console-background']));
      await expect(root.locator('[data-cim-pane="console"]')).toHaveCSS('color',rgb(colors['console-text']));
      await expect(root.locator('[data-cim-player-description]')).toHaveCSS('color',rgb(colors['explanation-prose']));
      await expect(root.locator('[data-cim-player-title]')).toHaveCSS('color',rgb(colors['explanation-heading']));
      await expect(root.getByLabel('Theme',{exact:true})).toHaveCSS('color',rgb(colors['control-text']));
    }
    await expect(first.locator('[data-cim-beat-heading]').first()).toHaveCSS('color',rgb(colors.wayfinding));
    await expect(first.locator('[data-role="risk-badge"]')).toHaveCSS('color',rgb(colors['risk-final']));
    await expect(first.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveCSS('border-color',rgb(colors.wayfinding));
    if (process.env.CIM_THEME_SCREENSHOT_DIRECTORY) await first.screenshot({path:resolve(process.env.CIM_THEME_SCREENSHOT_DIRECTORY,`player-theme-${id}.png`)});
  }
  const after = await page.evaluate(() => ({
    canonical: playerTest.host.observations(playerTest.roots[0]).snapshot().canonical,
    renderer: playerTest.roots[0].querySelector('[data-cim-renderer="console/v1"]').innerHTML
  }));
  expect(after).toEqual(before);
});

test('learner themes retain the explicit choice across reload and ignore device changes', async ({ page }) => {
  await open(page);
  await page.locator('.cim').first().getByLabel('Theme',{exact:true}).selectOption('light');
  expect(await page.evaluate(() => localStorage.getItem('cim.learnerTheme'))).toBe('light');
  await page.reload(); await page.waitForFunction(() => !!window.playerTest);
  await page.emulateMedia({contrast:'more',colorScheme:'dark'});
  await expect(page.locator('.cim').first()).toHaveAttribute('data-cim-theme','light');
  await expect(page.locator('.cim').nth(1)).toHaveAttribute('data-cim-theme','light');
});

test('learner themes follow device preference changes until an explicit choice and hide in forced colors', async ({ page }) => {
  await observeContrastQueries(page);
  await page.emulateMedia({colorScheme:'light'});
  await open(page);
  const root=page.locator('.cim').first();
  await expect(root).toHaveAttribute('data-cim-theme','light');
  await page.emulateMedia({colorScheme:'dark'});
  await expect(root).toHaveAttribute('data-cim-theme','localis');
  await updateContrastPreference(page,{colorScheme:'light',contrast:'more'});
  await expect(root).toHaveAttribute('data-cim-theme','high-contrast');
  expect(await page.evaluate(() => localStorage.getItem('cim.learnerTheme'))).toBeNull();
  await root.getByLabel('Theme',{exact:true}).selectOption('localis');
  await expect(root).toHaveAttribute('data-cim-theme','localis');
  await root.getByLabel('Theme',{exact:true}).selectOption('light');
  await page.emulateMedia({forcedColors:'active'});
  await expect(root.locator('[data-cim-theme-control]')).toHaveJSProperty('hidden',true);
  await expect(root.getByLabel('Theme',{exact:true})).toBeHidden();
  await expect(root.locator('[data-cim-pane="console"]')).not.toHaveCSS('color','rgb(26, 75, 140)');
  await page.emulateMedia({forcedColors:'none'});
  await expect(root.getByLabel('Theme',{exact:true})).toBeVisible();
  await expect(root).toHaveAttribute('data-cim-theme','light');
});

test('learner themes unavailable storage keeps an in-memory choice for siblings and remount', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new Error('storage blocked');}}));
  await open(page);
  await page.locator('.cim').first().getByLabel('Theme',{exact:true}).selectOption('light');
  await page.emulateMedia({contrast:'more'});
  await expect(page.locator('.cim').nth(1)).toHaveAttribute('data-cim-theme','light');
  await page.evaluate(async () => {
    const {createWordPressPlayerBinding}=await import('/wordpress/assets/player-binding.mjs');
    const root=playerTest.roots[0];
    playerTest.bindings[0].dispose();
    playerTest.bindings[0]=createWordPressPlayerBinding({root,commandPort:playerTest.host.commands(root),observationPort:playerTest.host.observations(root),content:playerTest.host.playerContent(root),onError:e=>playerTest.errors.push(String(e))});
  });
  await expect(page.locator('.cim').first().getByLabel('Theme',{exact:true})).toHaveValue('light');
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('learner themes invalid persisted ID falls back to current device preferences', async ({ page }) => {
  await observeContrastQueries(page);
  await page.addInitScript(() => localStorage.setItem('cim.learnerTheme','unknown'));
  await page.emulateMedia({colorScheme:'light'});
  await open(page);
  await expect(page.locator('.cim').first()).toHaveAttribute('data-cim-theme','light');
  await updateContrastPreference(page,{colorScheme:'dark',contrast:'more'});
  await expect(page.locator('.cim').first()).toHaveAttribute('data-cim-theme','high-contrast');
});

test('learner themes disposed selectors are inert and leave sibling controls functional', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.staleThemeSelect=playerTest.roots[0].querySelector('[data-cim-theme-select]');
    playerTest.bindings[0].dispose();
    staleThemeSelect.value='light';staleThemeSelect.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('.cim').first()).not.toHaveAttribute('data-cim-theme',/./);
  await expect(page.locator('.cim').nth(1).getByLabel('Theme',{exact:true})).toHaveValue('localis');
  await page.locator('.cim').nth(1).getByLabel('Theme',{exact:true}).selectOption('high-contrast');
  await expect(page.locator('.cim').nth(1)).toHaveAttribute('data-cim-theme','high-contrast');
});

test('atomic readiness, two panes, fixed colors and native opening content', async ({ page }) => {
  await open(page);
  const root = page.locator('.cim').first();
  const evidence = await page.evaluate(() => ({pre:playerTest.preReady, frames:playerTest.frames, errors:playerTest.errors}));
  expect(evidence.errors).toEqual([]);
  expect(evidence.pre.every(r => r.state !== 'ready' && r.rendererDisplay === 'none' && r.fallbackDisplay !== 'none')).toBe(true);
  expect(evidence.frames.every(f => !f.ready || (f.player && f.transport))).toBe(true);
  expect(evidence.frames.every(f => f.ready || (!f.playerVisible && !f.transportVisible))).toBe(true);
  await expect(root.locator('[data-cim-pane]')).toHaveCount(2);
  await expect(root.locator('[data-cim-pane="console"] [data-cim-renderer-root]')).toHaveCount(1);
  await expect(root.locator('[data-cim-player-title]')).toHaveText('Git Repository Practice');
  await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(0);
  await expect(root.locator('.cim-fallback')).toBeHidden();
  await expect(root.locator('[data-cim-pane="console"]')).toHaveCSS('color', 'rgb(124, 183, 255)');
  await expect(root.locator('[data-cim-pane="console"]')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(root.locator('[data-cim-player-title]')).toHaveCSS('color', 'rgb(232, 236, 242)');
  await expect(root.locator('[data-cim-player-title]')).toHaveCSS('font-family', /Catamaran/);
  await expect(root.locator('[data-cim-pane="explanation"]')).toHaveCSS('background-color', 'rgb(23, 27, 34)');
  await expect(root.locator('[data-cim-player-description]')).toHaveCSS('color', 'rgb(168, 179, 194)');
  await expect(root.locator('[data-cim-player-description]')).toHaveCSS('font-family', /IBM Plex Sans/);
  await expect(root.locator('[data-cim-player-description]')).toHaveCSS('font-weight', '500');
  await expect(root.locator('[data-cim-pane="explanation"]')).toHaveCSS('border-radius', '8px');
  await expect(root.locator('[data-cim-control="restart"]')).toBeVisible();
});

test('dark Player frame and Transport preserve keyboard focus and legacy presentation', async ({ page }) => {
  await open(page);
  const root = page.locator('.cim').first();
  const next = root.locator('[data-cim-control="next"]');
  const playback = root.locator('[data-cim-control="playback"]');
  await expect(root).toHaveCSS('background-color', 'rgb(23, 27, 34)');
  await expect(root.locator('[data-cim-transport-controls]')).toHaveCSS('color', 'rgb(168, 179, 194)');
  await expect(next).toHaveCSS('background-color', 'rgb(23, 27, 34)');
  await expect(next).toHaveCSS('color', 'rgb(232, 236, 242)');
  await expect(next).toHaveCSS('border-radius', '8px');
  await expect(next).toHaveCSS('font-family', /IBM Plex Mono/);
  await next.hover();
  await expect(next).toHaveCSS('background-color', 'rgb(50, 58, 74)');
  await page.mouse.move(0, 0);
  await next.focus();
  await expect(next).toHaveCSS('outline-color', 'rgb(168, 179, 194)');
  await expect(next).toHaveCSS('outline-width', '2px');
  await playback.click();
  await expect(playback).toHaveAttribute('data-cim-action', 'pause');
  await expect(playback).toHaveCSS('color', 'rgb(232, 236, 242)');
  await expect(playback).toHaveCSS('background-color', 'rgb(50, 58, 74)');
  await playback.click();
  await next.click();
  await expect(root.locator('[data-cim-beat-marker][aria-current="step"]')).toHaveCSS('border-color', 'rgb(90, 196, 200)');
  await page.emulateMedia({ forcedColors: 'active' });
  await next.focus();
  await expect(next).toHaveCSS('outline-style', 'solid');
  await expect(next).toHaveCSS('outline-width', '2px');
  await page.emulateMedia({ forcedColors: 'none' });
  // A neighboring legacy instance must not acquire the Console Player palette.
  await page.evaluate(() => {
    const legacy = document.createElement('div');
    legacy.id = 'legacy-presentation-proof';
    legacy.className = 'cim';
    legacy.dataset.cimState = 'ready';
    legacy.innerHTML = '<div data-cim-renderer="git/v1"></div><div data-cim-transport-controls><button type="button">Next</button></div>';
    document.body.appendChild(legacy);
  });
  await expect(page.locator('#legacy-presentation-proof')).toHaveCSS('background-color', 'rgb(244, 246, 248)');
  await expect(page.locator('#legacy-presentation-proof button')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('reveal, Commentary navigation, protected links and Restart stay isolated', async ({ page }) => {
  await open(page);
  const first = page.locator('.cim').first();
  const second = page.locator('.cim').nth(1);
  await first.locator('[data-cim-control="end"]').click();
  await expect(first.locator('[data-cim-commentary-entry]:visible')).toHaveCount(18);
  await expect(second.locator('[data-cim-commentary-entry]:visible')).toHaveCount(0);
  await expect(first.locator('[data-role="risk-badge"]')).toHaveCSS('color', 'rgb(255, 122, 122)');
  await expect(first.locator('[data-role="copy"]').first()).toBeVisible();
  await expect(first.locator('[data-cim-commentary-entry] p').first()).toHaveCSS('user-select', 'text');
  await expect(first.locator('[data-cim-commentary-entry] p').first()).toHaveCSS('color', 'rgb(168, 179, 194)');
  await expect(first.locator('[data-cim-beat-heading]').first()).toHaveCSS('color', 'rgb(90, 196, 200)');
  await expect(first.locator('[data-cim-beat-heading]').first()).toHaveCSS('font-weight', '700');
  await expect(first.locator('[data-cim-commentary-entry]').first()).toHaveCSS('border-radius', '8px');
  if (process.env.CIM_PLAYER_SCREENSHOT) await first.screenshot({path:process.env.CIM_PLAYER_SCREENSHOT});
  await first.locator('[data-cim-commentary-entry] button').first().click();
  await expect(first.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id', 'check-status--s01');
  expect(await page.evaluate(() => playerTest.sources)).toEqual(['commentary']);
  await expect(first.locator('[data-cim-commentary-entry]:visible')).toHaveCount(18);
  const link = first.locator('[data-cim-commentary-entry] a').first();
  await link.focus();
  await page.keyboard.press('Space');
  await expect(first.locator('[data-cim-control="playback"]')).toHaveText('Play');
  await first.locator('[data-cim-control="restart"]').click();
  await expect(first.locator('[data-cim-commentary-entry]:visible')).toHaveCount(0);
  await expect(first.locator('[data-cim-player-title]')).toBeVisible();
  expect(await page.evaluate(() => playerTest.host.observations(playerTest.roots[0]).snapshot().canonical.revealFrontier)).toBe('initial');
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('admission failure rolls back the full Player and synchronous disposal wins', async ({ page }) => {
  await open(page, '?failure');
  await expect(page.locator('[data-cim-player]')).toHaveCount(0);
  for (const root of await page.locator('.cim').all()) {
    await expect(root).toHaveAttribute('data-cim-state', 'fallback');
    await expect(root.locator('.cim-fallback')).toBeVisible();
    await expect(root.locator('[data-cim-transport-controls]')).toHaveCount(0);
  }
  expect(await page.evaluate(() => playerTest.roots.every(r => playerTest.host.playerContent(r) === null && !playerTest.host.present(r)))).toBe(true);
});

test('root teardown restores renderer position and preserves sibling Player', async ({ page }) => {
  await open(page);
  await page.locator('.cim').first().locator('[data-cim-control="end"]').click();
  await expect(page.locator('.cim').first().locator('[data-cim-commentary-entry]:visible')).toHaveCount(18);
  await page.evaluate(async () => {
    const staleButton = playerTest.roots[0].querySelector('[data-cim-commentary-entry] button');
    playerTest.bindings[0].dispose();
    staleButton.click();
    if (playerTest.sources.length !== 0) throw new Error('Commentary listener survived disposal');
    const pending = playerTest.host.disposeRoot(playerTest.roots[0]);
    if (playerTest.host.playerContent(playerTest.roots[0]) !== null || playerTest.host.present(playerTest.roots[0])) throw new Error('capability survived disposal');
    await pending;
  });
  await expect(page.locator('.cim').first().locator('[data-cim-player]')).toHaveCount(0);
  await expect(page.locator('.cim').nth(1)).toHaveAttribute('data-cim-state', 'ready');
  await expect(page.locator('.cim').nth(1).locator('[data-cim-player]')).toHaveCount(1);
  expect(await page.evaluate(() => playerTest.rendererObservers.size)).toBe(1);
});

test('narrow layout stacks panes without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await open(page);
  const panes = page.locator('.cim').first().locator('[data-cim-pane]');
  const consoleBox = await panes.nth(0).boundingBox();
  const explanationBox = await panes.nth(1).boundingBox();
  expect(explanationBox.y).toBeGreaterThan(consoleBox.y + consoleBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Console wraps with hanging continuations and preserves authored leading spaces', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await open(page);
  const evidence = await page.evaluate(() => {
    const transcript = document.querySelector('[data-role="transcript"]');
    const measure = (role, text) => {
      const line = document.createElement('div');
      line.dataset.role = role;
      const span = document.createElement('span');
      span.textContent = text;
      line.appendChild(span);
      transcript.appendChild(line);
      const range = document.createRange();
      range.selectNodeContents(span);
      // Preserved spaces can create several rectangles on the same visual row.
      const visualRows = new Map();
      for (const rect of range.getClientRects()) {
        if (rect.width === 0) continue;
        const key = rect.y.toFixed(2);
        visualRows.set(key, Math.min(visualRows.get(key) ?? Infinity, rect.x));
      }
      const rows = [...visualRows.values()].map(x => ({x}));
      const style = getComputedStyle(line);
      range.setStart(span.firstChild, 0);
      range.setEnd(span.firstChild, Math.min(4,text.length));
      const result = {text:span.textContent, rows,
        prefixWidth:range.getBoundingClientRect().width,
        indent:parseFloat(style.paddingInlineStart),
        overflow:line.scrollWidth > line.clientWidth};
      line.remove();
      return result;
    };
    const long = 'to discard changes in working directory ' + 'a'.repeat(120);
    return {output:measure('output-line',long), command:measure('command-line',long),
      spaced:measure('output-line','    modified: src/HeaderFix.jsx'),
      short:measure('output-line','On branch main')};
  });
  for (const result of [evidence.output,evidence.command]) {
    expect(result.rows.length).toBeGreaterThan(1);
    expect(result.overflow).toBe(false);
    expect(result.rows[1].x - result.rows[0].x).toBeCloseTo(result.indent,0);
  }
  expect(evidence.spaced.text).toBe('    modified: src/HeaderFix.jsx');
  expect(evidence.spaced.prefixWidth).toBeCloseTo(evidence.spaced.indent * 2,0);
  expect(evidence.short.rows).toHaveLength(1);
});

test('known issue: continuation must begin beyond authored indentation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await open(page);
  const root = page.locator('.cim').first();
  await root.locator('[data-cim-control="end"]').click();
  const line = root.locator('[data-role="output-line"]').filter({hasText:'to discard changes in working directory'}).first();
  const evidence = await line.locator('[data-role="output-text"]').evaluate(span => {
    const text = span.firstChild;
    const firstNonSpace = text.textContent.search(/\S/);
    const range = document.createRange();
    range.selectNodeContents(span);
    const visualRows = new Map();
    for (const rect of range.getClientRects()) {
      if (rect.width === 0) continue;
      const key = rect.y.toFixed(2);
      visualRows.set(key, Math.min(visualRows.get(key) ?? Infinity, rect.x));
    }
    range.setStart(text, firstNonSpace);
    range.setEnd(text, firstNonSpace + 1);
    return {firstNonSpace, firstTextX:range.getBoundingClientRect().x,
      rows:[...visualRows.values()]};
  });
  // Fixture/setup failures must remain unexpected failures.
  expect(evidence.firstNonSpace).toBe(2);
  expect(evidence.rows.length).toBeGreaterThan(1);
  test.fail(true, 'Fixed 2ch continuation collides with two authored spaces; awaiting Console renderer review.');
  expect(evidence.rows[1]).toBeGreaterThan(evidence.firstTextX + 0.5);
});

async function atBottom(viewport) {
  return viewport.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop <= 1);
}

async function revealBoundary(page, index) {
  await page.evaluate(async index => {
    const root = playerTest.roots[0];
    await playerTest.host.commands(root).seek(playerTest.host.playerContent(root).boundaryIds[index], 'transport');
  }, index);
  await expect(page.locator('.cim').first().locator('[data-cim-commentary-entry]:visible')).toHaveCount(index);
}

async function appendConsoleOutput(viewport) {
  await viewport.evaluate(node => {
    const transcript = node.querySelector('[data-role="transcript"]');
    for (let index = 0; index < 8; index += 1) {
      const line = document.createElement('div');
      line.dataset.role = 'output-line';
      line.textContent = 'Additional presentation output ' + transcript.children.length;
      transcript.appendChild(line);
    }
  });
}

test('pane follow survives real renderer replacement and keeps both newest views visible', async ({ page }) => {
  await open(page);
  await page.mouse.move(0, 0);
  await revealBoundary(page, 10);
  const root = page.locator('.cim').first();
  const consoleViewport = root.locator('[data-cim-console-viewport]');
  const explanationViewport = root.locator('[data-cim-commentary-viewport]');
  const originalViewport = await consoleViewport.elementHandle();
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  await expect.poll(() => atBottom(explanationViewport)).toBe(true);
  await revealBoundary(page, 18);
  expect(await originalViewport.evaluate(node => node === playerTest.roots[0].querySelector('[data-cim-console-viewport]'))).toBe(true);
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  await expect.poll(() => atBottom(explanationViewport)).toBe(true);
  await expect(root.locator('[data-cim-console-resume]')).toBeHidden();
  await expect(root.locator('[data-cim-commentary-resume]')).toBeHidden();
  const viewportBox = await consoleViewport.boundingBox();
  const badgeBox = await root.locator('[data-role="risk-badge"]').boundingBox();
  expect(badgeBox.y).toBeGreaterThanOrEqual(viewportBox.y);
  expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
  await expect(page.locator('.cim').nth(1).locator('[data-cim-commentary-entry]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('Console pointer focus and selection holds catch up without taking scroll ownership', async ({ page }) => {
  await open(page);
  await page.mouse.move(0, 0);
  await revealBoundary(page, 10);
  const root = page.locator('.cim').first();
  const viewport = root.locator('[data-cim-console-viewport]');
  const resume = root.locator('[data-cim-console-resume]');
  await expect.poll(() => atBottom(viewport)).toBe(true);
  const before = await viewport.evaluate(node => node.scrollTop);
  await viewport.hover();
  await appendConsoleOutput(viewport);
  await expect(resume).toHaveText('New output below');
  await expect(resume).toBeVisible();
  expect(await viewport.evaluate(node => node.scrollTop)).toBe(before);
  await page.mouse.move(0, 0);
  await expect.poll(() => atBottom(viewport)).toBe(true);
  await expect(resume).toBeHidden();

  await viewport.evaluate(node => node.focus({preventScroll:true}));
  const focusedTop = await viewport.evaluate(node => node.scrollTop);
  await appendConsoleOutput(viewport);
  await expect(resume).toBeVisible();
  expect(await viewport.evaluate(node => node.scrollTop)).toBe(focusedTop);
  await viewport.evaluate(node => node.blur());
  await expect.poll(() => atBottom(viewport)).toBe(true);

  await viewport.evaluate(node => {
    const text = node.querySelector('[data-role="output-text"]').firstChild;
    const range = document.createRange();
    range.setStart(text, 0); range.setEnd(text, Math.min(4,text.length));
    const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  const selectedTop = await viewport.evaluate(node => node.scrollTop);
  await appendConsoleOutput(viewport);
  await expect(resume).toBeVisible();
  expect(await viewport.evaluate(node => node.scrollTop)).toBe(selectedTop);
  await page.evaluate(() => document.getSelection().removeAllRanges());
  await expect.poll(() => atBottom(viewport)).toBe(true);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('Explanation overlapping holds and pane-owned scrolling remain independent', async ({ page }) => {
  await open(page);
  await page.mouse.move(0, 0);
  await revealBoundary(page, 10);
  const root = page.locator('.cim').first();
  const explanation = root.locator('[data-cim-commentary-viewport]');
  const consoleViewport = root.locator('[data-cim-console-viewport]');
  const resume = root.locator('[data-cim-commentary-resume]');
  await expect.poll(() => atBottom(explanation)).toBe(true);
  await explanation.hover();
  await explanation.evaluate(node => node.focus({preventScroll:true}));
  const heldTop = await explanation.evaluate(node => node.scrollTop);
  await revealBoundary(page, 11);
  await expect(resume).toHaveText('New explanation below');
  await expect(resume).toBeVisible();
  expect(await explanation.evaluate(node => node.scrollTop)).toBe(heldTop);
  await page.mouse.move(0, 0);
  expect(await explanation.evaluate(node => node.scrollTop)).toBe(heldTop);
  await explanation.evaluate(node => node.blur());
  await expect.poll(() => atBottom(explanation)).toBe(true);

  await explanation.evaluate(node => {
    const text = node.querySelector('p').firstChild;
    const range = document.createRange(); range.setStart(text,0); range.setEnd(text,4);
    document.getSelection().removeAllRanges(); document.getSelection().addRange(range);
  });
  const selectionTop = await explanation.evaluate(node => node.scrollTop);
  await revealBoundary(page, 12);
  await expect(resume).toBeVisible();
  expect(await explanation.evaluate(node => node.scrollTop)).toBe(selectionTop);
  await page.evaluate(() => document.getSelection().removeAllRanges());
  await expect.poll(() => atBottom(explanation)).toBe(true);

  await explanation.hover();
  await page.mouse.wheel(0, -500);
  await expect.poll(() => explanation.evaluate(node => node.scrollTop)).toBeLessThan(selectionTop);
  await page.mouse.move(0, 0);
  const ownedTop = await explanation.evaluate(node => node.scrollTop);
  await revealBoundary(page, 13);
  await expect(resume).toBeVisible();
  expect(await explanation.evaluate(node => node.scrollTop)).toBe(ownedTop);
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  await resume.click();
  await expect.poll(() => atBottom(explanation)).toBe(true);
  await expect(resume).toBeHidden();
  await page.mouse.move(0, 0);
  await resume.evaluate(node => node.blur());
  await revealBoundary(page, 14);
  await expect.poll(() => atBottom(explanation)).toBe(true);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('Console scroll ownership waits for explicit return and stale pane listeners are withdrawn', async ({ page }) => {
  await open(page);
  await page.mouse.move(0, 0);
  await revealBoundary(page, 10);
  const root = page.locator('.cim').first();
  const viewport = root.locator('[data-cim-console-viewport]');
  const resume = root.locator('[data-cim-console-resume]');
  await expect.poll(() => atBottom(viewport)).toBe(true);
  await viewport.hover();
  await page.mouse.wheel(0, -500);
  await expect.poll(() => atBottom(viewport)).toBe(false);
  await page.mouse.move(0, 0);
  const ownedTop = await viewport.evaluate(node => node.scrollTop);
  await appendConsoleOutput(viewport);
  await expect(resume).toBeVisible();
  expect(await viewport.evaluate(node => node.scrollTop)).toBe(ownedTop);
  // Manual return to the newest content is explicit learner action.
  await viewport.hover();
  await page.mouse.wheel(0, 100000);
  await expect.poll(() => atBottom(viewport)).toBe(true);
  await expect(resume).toBeHidden();
  await page.mouse.move(0, 0);
  await appendConsoleOutput(viewport);
  await expect.poll(() => atBottom(viewport)).toBe(true);
  await page.evaluate(() => {
    const staleViewport = playerTest.roots[0].querySelector('[data-cim-console-viewport]');
    const staleButton = playerTest.roots[0].querySelector('[data-cim-console-resume]');
    playerTest.bindings[0].dispose();
    staleViewport.scrollTo = () => { throw new Error('stale listener moved disposed pane'); };
    staleViewport.dispatchEvent(new Event('pointerenter'));
    staleViewport.dispatchEvent(new Event('scroll'));
    staleButton.click();
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(page.locator('.cim').nth(1).locator('[data-cim-player]')).toHaveCount(1);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('deliberate navigation repositions both held panes while preserving Commentary provenance', async ({ page }) => {
  await open(page);
  await page.mouse.move(0, 0);
  await revealBoundary(page, 18);
  const root = page.locator('.cim').first();
  const consoleViewport = root.locator('[data-cim-console-viewport]');
  const explanation = root.locator('[data-cim-commentary-viewport]');
  await explanation.evaluate(node => node.focus({preventScroll:true}));
  await root.locator('[data-cim-commentary-entry] button').first().click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s01');
  await expect.poll(() => explanation.evaluate(node => node.scrollTop)).toBe(0);
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  expect(await page.evaluate(() => playerTest.sources)).toEqual(['commentary']);
  await root.locator('[data-cim-control="end"]').click();
  await expect.poll(() => atBottom(explanation)).toBe(true);
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  await root.locator('[data-cim-control="restart"]').click();
  await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(0);
  expect(await explanation.evaluate(node => node.scrollTop)).toBe(0);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('offscreen link focus scrolls natively without claiming viewport ownership', async ({ page }) => {
  await open(page);
  await page.mouse.move(0,0);
  await revealBoundary(page,10);
  const root = page.locator('.cim').first();
  const viewport = root.locator('[data-cim-commentary-viewport]');
  const link = root.locator('[data-cim-commentary-entry] a').first();
  await expect.poll(() => atBottom(viewport)).toBe(true);
  await link.focus(); // Browser may scroll to expose the focused link.
  await expect.poll(() => atBottom(viewport)).toBe(false);
  const focusedTop = await viewport.evaluate(node => node.scrollTop);
  await revealBoundary(page,11);
  await expect(root.locator('[data-cim-commentary-resume]')).toBeVisible();
  expect(await viewport.evaluate(node => node.scrollTop)).toBe(focusedTop);
  await link.evaluate(node => node.blur());
  await expect.poll(() => atBottom(viewport)).toBe(true);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('pinned Console title and its lower gap cover scrolling transcript text', async ({ page }) => {
  await open(page);
  await page.mouse.move(0,0);
  await revealBoundary(page,18);
  const title = page.locator('.cim').first().locator('[data-role="titlebar"]');
  const evidence = await title.evaluate(node => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    const padding = parseFloat(style.paddingBottom);
    const gapY = box.bottom - padding / 2;
    const hit = document.elementFromPoint(box.left + box.width / 2,gapY);
    const transcript = node.nextElementSibling;
    const range = document.createRange(); range.selectNodeContents(transcript);
    return {background:style.backgroundColor, margin:parseFloat(style.marginBottom),padding,
      titleOwnsGap:hit === node || node.contains(hit),
      transcriptBehindGap:[...range.getClientRects()].some(rect => rect.top < gapY && rect.bottom > gapY)};
  });
  expect(evidence.transcriptBehindGap).toBe(true);
  expect(evidence.background).toBe('rgb(0, 0, 0)');
  expect(evidence.margin).toBe(0);
  expect(evidence.padding).toBe(16);
  expect(evidence.titleOwnsGap).toBe(true);
});

test('Copy button edge stays covered when its command scrolls behind the pinned title',async({page})=>{
  await open(page);await revealBoundary(page,18);await page.mouse.move(0,0);
  const viewport=page.locator('.cim').first().locator('[data-cim-console-viewport]');
  const result=await viewport.evaluate(view=>{
    const title=view.querySelector('[data-role="titlebar"]');
    const button=view.querySelector('[data-role="copy"]');
    const command=button.parentElement.querySelector('[data-role="command"]');
    view.scrollTop=0;
    const range=document.createRange();range.selectNodeContents(command);
    const textBox=[...range.getClientRects()].at(-1);
    const lineHeight=parseFloat(getComputedStyle(command).lineHeight);
    const buttonHeight=button.getBoundingClientRect().height;
    view.scrollTop += textBox.bottom-title.getBoundingClientRect().bottom+1;
    const pinned=title.getBoundingClientRect();const box=button.getBoundingClientRect();
    const x=box.left+box.width/2;
    return {buttonHeight,lineHeight,edgeCovered:box.bottom<=pinned.bottom,
      visibleEdge:[1,2,3,4,5].some(offset=>document.elementFromPoint(x,pinned.bottom+offset)?.closest('[data-role="copy"]')===button)};
  });
  expect(result.buttonHeight).toBeLessThanOrEqual(result.lineHeight);
  expect(result.edgeCovered).toBe(true);expect(result.visibleEdge).toBe(false);
});

test('selection holds only the intersected pane while its peer follows', async ({ page }) => {
  await open(page); await page.mouse.move(0,0);
  await revealBoundary(page,10);
  const root = page.locator('.cim').first();
  const consoleViewport = root.locator('[data-cim-console-viewport]');
  const explanation = root.locator('[data-cim-commentary-viewport]');
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  await expect.poll(() => atBottom(explanation)).toBe(true);
  await explanation.evaluate(node => {
    const text = node.querySelector('p').firstChild;
    const range = document.createRange(); range.setStart(text,0); range.setEnd(text,4);
    document.getSelection().removeAllRanges(); document.getSelection().addRange(range);
  });
  const heldTop = await explanation.evaluate(node => node.scrollTop);
  await revealBoundary(page,11);
  await expect(root.locator('[data-cim-commentary-resume]')).toBeVisible();
  expect(await explanation.evaluate(node => node.scrollTop)).toBe(heldTop);
  await expect.poll(() => atBottom(consoleViewport)).toBe(true);
  await expect(root.locator('[data-cim-console-resume]')).toBeHidden();
  await page.evaluate(() => document.getSelection().removeAllRanges());
  await expect.poll(() => atBottom(explanation)).toBe(true);

  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});

test('pointer already present at pane binding construction holds new output', async ({ page }) => {
  await open(page);
  const root = page.locator('.cim').first();
  const viewport = root.locator('[data-cim-console-viewport]');
  await revealBoundary(page,10);
  await viewport.hover();
  const initial = await viewport.evaluate(async node => {
    const {createPaneHoldBinding} = await import('/wordpress/assets/pane-hold-binding.mjs');
    const {createConsoleFollowController} = await import('/wordpress/assets/console-follow-controller.mjs');
    const {createCommentaryScrollBinding} = await import('/src/commentary/scroll-binding.mjs');
    const pane = node.closest('[data-cim-pane]');
    const indicator = document.createElement('button'); indicator.type = 'button'; pane.appendChild(indicator);
    const follow = createConsoleFollowController({readContent:() => node.querySelector('[data-role="transcript"]').textContent});
    const scroll = createCommentaryScrollBinding({viewport:node,indicator,follow,
      newerStepsLabel:'New output below',scrollIntent:Object.freeze({read:() => false})});
    // The pointer is stationary throughout construction; no new pointerenter is dispatched.
    const holds = createPaneHoldBinding({pane,follow,refresh:() => scroll.refresh()});
    window.initialPointerProof = {follow,scroll,holds,indicator};
    return {hovered:pane.matches(':hover'),held:follow.read().held};
  });
  expect(initial).toEqual({hovered:true,held:true});
  const top = await viewport.evaluate(node => node.scrollTop);
  await appendConsoleOutput(viewport);
  const held = await page.evaluate(() => initialPointerProof.scroll.refresh());
  expect(held.held).toBe(true);
  expect(held.newerStepsAvailable).toBe(true);
  expect(await viewport.evaluate(node => node.scrollTop)).toBe(top);
  await page.mouse.move(0,0);
  await expect.poll(() => atBottom(viewport)).toBe(true);
  await page.evaluate(() => {
    initialPointerProof.holds.dispose(); initialPointerProof.scroll.dispose(); initialPointerProof.indicator.remove();
  });
});

test('authored beat headings progress and button keyboard navigation use eight beats', async ({ page }) => {
  await open(page);
  const root = page.locator('.cim').first();
  const progress = root.locator('[data-cim-beat-progress]');
  const position = () => page.evaluate(() => playerTest.host.observations(playerTest.roots[0]).snapshot().canonical.currentStepId);
  await expect(root.locator('[data-cim-beat-marker]')).toHaveCount(8);
  await expect(root.locator('[data-cim-beat-heading]:visible')).toHaveCount(0);
  await expect(progress).toHaveText('Start Â· 8 beats');
  await root.locator('[data-cim-control="next"]').click();
  await expect.poll(position).toBe('check-status--s02');
  await expect(root.locator('[data-cim-beat-heading]:visible')).toHaveText(['1 Check the repository state']);
  await expect(progress).toHaveText('1 / 8 Â· Check the repository state');
  await root.locator('[data-cim-control="next"]').click();
  await expect.poll(position).toBe('stage-hunk--s04');
  await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(6);
  await root.locator('[data-cim-control="previous"]').click();
  await expect.poll(position).toBe('check-status--s02');
  await expect(progress).toHaveText('1 / 8 Â· Check the repository state');
  await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(6);
  await root.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(position).toBe('stage-hunk--s04');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(position).toBe('check-status--s02');
  expect(await page.evaluate(() => playerTest.sources)).toEqual([]); // Next remains Next, not a substituted seek.
  await root.locator('[data-cim-control="end"]').click();
  await expect(root.locator('[data-cim-beat-heading]:visible')).toHaveCount(8);
  await expect(progress).toHaveText('8 / 8 Â· Recover the commit');
  expect(await root.locator('[data-cim-commentary-entry] button').allTextContents()).not.toContain('Step 18');
  await root.locator('[data-cim-control="home"]').click();
  await expect(progress).toHaveText('Start Â· 8 beats');
  await expect(root.locator('[data-cim-beat-heading]:visible')).toHaveCount(8);
  await root.locator('[data-cim-control="restart"]').click();
  await expect(root.locator('[data-cim-beat-heading]:visible')).toHaveCount(0);
  await expect(progress).toHaveText('Start Â· 8 beats');
  await expect(page.locator('.cim').nth(1).locator('[data-cim-beat-progress]')).toHaveText('Start Â· 8 beats');
});

test('beat markers capture final destinations while Commentary retains individual segments', async ({ page }) => {
  await open(page);
  const root = page.locator('.cim').first();
  const marker = root.locator('[data-cim-beat-marker="stage-hunk"]');
  await marker.evaluate(node => node.setAttribute('data-cim-beat-marker','tampered'));
  await root.locator('[data-cim-beat-marker="tampered"]').focus();
  await page.keyboard.press('Space');
  await expect(root.locator('[data-cim-control="playback"]')).toHaveText('Play');
  await expect(root.locator('[data-cim-beat-progress]')).toHaveText('2 / 8 Â· Stage one change at a time');
  await expect.poll(() => page.evaluate(() => playerTest.host.observations(playerTest.roots[0]).snapshot().canonical.currentStepId)).toBe('stage-hunk--s04');
  await root.locator('[data-cim-commentary-entry][data-cim-step-id="stage-hunk--s02"] button').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s02');
  await expect(root.locator('[data-cim-beat-progress]')).toHaveText('2 / 8 Â· Stage one change at a time');
  await root.locator('[data-cim-control="next"]').click();
  await expect.poll(() => page.evaluate(() => playerTest.host.observations(playerTest.roots[0]).snapshot().canonical.currentStepId)).toBe('stage-hunk--s04');
  await expect(root.locator('[data-cim-beat-progress]')).toHaveText('2 / 8 Â· Stage one change at a time');
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-beat-progress]')).toHaveText('3 / 8 Â· Review what is staged');
  await expect.poll(() => page.evaluate(() => playerTest.host.observations(playerTest.roots[0]).snapshot().canonical.currentStepId)).toBe('review-staged--s02');
  expect(await page.evaluate(() => playerTest.sources)).toEqual(['marker','commentary']);
});

test('public beat deep links mount directly at final boundaries before presentation admission', async ({ page }) => {
  await open(page,'#cim/git-repository-practice/stage-hunk');
  for (const root of await page.locator('.cim').all()) {
    await expect(root).toHaveAttribute('data-cim-state','ready');
    await expect(root.locator('[data-cim-beat-progress]')).toHaveText('2 / 8 Â· Stage one change at a time');
    await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(6);
    await expect(root.locator('[data-cim-beat-marker][aria-current="step"]')).toHaveAttribute('data-cim-beat-marker','stage-hunk');
  }
  expect(await page.evaluate(() => playerTest.roots.every(root => playerTest.host.observations(root).snapshot().canonical.currentStepId === 'stage-hunk--s04'))).toBe(true);
  expect(await page.evaluate(() => playerTest.frames.every(frame => !frame.ready || (frame.player && frame.transport)))).toBe(true);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
  await page.locator('.cim').first().locator('[data-cim-control="next"]').click();
  await expect(page.locator('.cim').first().locator('[data-cim-beat-progress]')).toHaveText('3 / 8 Â· Review what is staged');
  await expect(page.locator('.cim').nth(1).locator('[data-cim-beat-progress]')).toHaveText('2 / 8 Â· Stage one change at a time');
});

test('deep links reject public v2 segment IDs and preserve legacy direct step links', async ({ page }) => {
  await open(page,'#cim/git-repository-practice/stage-hunk--s02');
  await expect(page.locator('.cim').first().locator('[data-cim-beat-progress]')).toHaveText('Start Â· 8 beats');
  expect(await page.evaluate(() => playerTest.errors.every(error => error.code === 'CIM-HST-002'))).toBe(true);
  expect(await page.evaluate(() => playerTest.errors.length)).toBe(2);
  await open(page,'?legacy-console#cim/git-repository-practice/stage-hunk--s02');
  await expect(page.locator('[data-cim-beat-controls]')).toHaveCount(0);
  await expect(page.locator('.cim').first().locator('[data-cim-commentary-entry]:visible')).toHaveCount(4);
  await expect(page.locator('.cim').first().locator('[data-cim-commentary-entry] button').first()).toHaveText('Step 1');
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
  await page.locator('.cim').first().locator('[data-cim-control="next"]').click();
  await expect.poll(() => page.evaluate(() => playerTest.host.observations(playerTest.roots[0]).snapshot().canonical.currentStepId)).toBe('stage-hunk--s03');
});

test('disposed beat markers lose their listeners and preserve sibling controls', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const stale = playerTest.roots[0].querySelector('[data-cim-beat-marker="commit"]');
    playerTest.bindings[0].dispose(); stale.click();
  });
  expect(await page.evaluate(() => playerTest.sources)).toEqual([]);
  await expect(page.locator('.cim').first().locator('[data-cim-beat-controls]')).toHaveCount(0);
  await expect(page.locator('.cim').nth(1).locator('[data-cim-beat-marker]')).toHaveCount(8);
  expect(await page.evaluate(() => playerTest.errors)).toEqual([]);
});
