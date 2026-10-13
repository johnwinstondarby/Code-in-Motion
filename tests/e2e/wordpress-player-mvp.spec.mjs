import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Test-only production-component composition. No fixture enters the release registry.
const repository = fileURLToPath(new URL('../../', import.meta.url));
let server;
let origin;
const fixture = `<!doctype html><link rel="stylesheet" href="/wordpress/assets/cim.css">
<style>body {background:#111;color:#ddd} section {background:magenta;color:yellow} p {color:red}</style>
<div class="cim" data-cim-experience="player-test" data-cim-instance="first"><div data-cim-renderer-root></div><div class="cim-fallback">Fallback</div></div>
<div class="cim" data-cim-experience="player-test" data-cim-instance="second"><div data-cim-renderer-root></div><div class="cim-fallback">Fallback</div></div>
<script type="module">
import { createWordPressLiveHost } from '/src/host/wordpress-live-host.mjs';
import { createWordPressClockFactory } from '/src/host/wordpress-browser-bindings.mjs';
import { freezeValidatedExperience } from '/src/experience/freeze-validated-experience.mjs';
import { createConsoleRenderer } from '/src/renderers/subjects/console/renderer.mjs';
import { createWordPressPlayerBinding } from '/wordpress/assets/player-binding.mjs';
const experience = freezeValidatedExperience(await (await fetch('/experiences/git/git-repository-practice.json')).json());
const errors = [];
const sources = [];
const host = createWordPressLiveHost({document,
 matchMedia: q => window.matchMedia(q),
 experienceLoader: Object.freeze({load: async () => experience}),
 rendererResolver: Object.freeze({resolve: async () => createConsoleRenderer()}),
 clockFactory: createWordPressClockFactory({now: () => performance.now(), setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame}),
 entryResolver: Object.freeze({resolve: () => null}), diagnostics: Object.freeze({report: record => errors.push(record)})});
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
window.playerTest = {host, roots, bindings, errors, frames, preReady, sources};
sampling = false;
</script>`;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
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
      response.setHeader('Content-Type', ({'.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[extname(target)] ?? 'text/plain');
      response.end(await readFile(target));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(async () => { await new Promise(done => server.close(done)); });

async function open(page, suffix = '') {
  await page.goto(origin + '/fixture' + suffix);
  await page.waitForFunction(() => !!window.playerTest);
}

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
  await expect(root.locator('[data-cim-player-title]')).toHaveCSS('color', 'rgb(230, 233, 239)');
  await expect(root.locator('[data-cim-pane="explanation"]')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(root.locator('[data-cim-control="restart"]')).toBeVisible();
});

test('reveal, Commentary navigation, protected links and Restart stay isolated', async ({ page }) => {
  await open(page);
  const first = page.locator('.cim').first();
  const second = page.locator('.cim').nth(1);
  await first.locator('[data-cim-control="end"]').click();
  await expect(first.locator('[data-cim-commentary-entry]:visible')).toHaveCount(18);
  await expect(second.locator('[data-cim-commentary-entry]:visible')).toHaveCount(0);
  await expect(first.locator('[data-role="risk-badge"]')).toHaveCSS('color', 'rgb(255, 122, 122)');
  await expect(first.locator('[data-role="copy"]').first()).toBeHidden();
  await expect(first.locator('[data-cim-commentary-entry] p').first()).toHaveCSS('user-select', 'text');
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
