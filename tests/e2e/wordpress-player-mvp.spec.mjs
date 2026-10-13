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
window.playerTest = {host, roots, bindings, errors, frames, preReady, sources, rendererObservers};
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
