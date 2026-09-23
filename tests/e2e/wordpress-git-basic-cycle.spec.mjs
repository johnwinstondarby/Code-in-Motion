import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).version;
const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
const PLUGIN_VERSION = process.env.CIM_PLUGIN_VERSION ?? PACKAGE_VERSION;
const PLUGIN_PREFIX = '/wp-content/plugins/code-in-motion/';
const MODULE_PREFIX = `${PLUGIN_PREFIX}wordpress/assets/modules/${PLUGIN_VERSION}/`;
const WORDPRESS_LAYOUT = process.env.CIM_WP_LAYOUT ?? 'source';

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

test('R27 Git basic cycle mounts through the production WordPress path and advances B-to-B semantics', async ({ page }) => {
  const requested = [];
  const requestFailures = [];
  const consoleErrors = [];

  page.on('request', (request) => requested.push(request.url()));
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown request failure'}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-git`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="git-basic-cycle"]');
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  const rendered = root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="git/v1"]');

  await expect(rendered).toHaveAttribute('data-step', 'initial');
  await expect(rendered).toHaveAttribute('data-git-focus', 'overview');
  await expect(rendered).toHaveCSS('color', 'rgb(23, 27, 34)');
  await expect(rendered).toHaveCSS('background-color', 'rgb(244, 246, 248)');

  const lanes = rendered.locator('[data-role="git-lanes"] > [data-git-lane]');
  await expect(lanes).toHaveCount(4);
  await expect(lanes.nth(0)).toHaveAttribute('data-git-lane', 'working-tree');
  await expect(lanes.nth(1)).toHaveAttribute('data-git-lane', 'index');
  await expect(lanes.nth(2)).toHaveAttribute('data-git-lane', 'local');
  await expect(lanes.nth(3)).toHaveAttribute('data-git-lane', 'remote');
  await expect(lanes.nth(0)).toHaveCSS('color', 'rgb(23, 27, 34)');
  await expect(lanes.nth(0)).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  const reflog = rendered.locator('[data-git-evidence="reflog"]');
  await expect(reflog).toHaveAttribute('data-git-grammar', 'evidence-timeline');
  await expect(rendered.locator('[data-role="git-lanes"] [data-git-evidence="reflog"]')).toHaveCount(0);

  await root.focus();
  await page.keyboard.press('ArrowRight');
  await expect(rendered).toHaveAttribute('data-step', 'step-01');
  await expect(rendered).toHaveAttribute('data-git-focus', 'overview');

  const statusLaneText = await lanes.allTextContents();

  await page.keyboard.press('ArrowRight');
  await expect(rendered).toHaveAttribute('data-step', 'step-02');
  await expect(rendered).toHaveAttribute('data-git-focus', 'working-tree');
  expect(await lanes.allTextContents()).toEqual(statusLaneText);

  await page.keyboard.press('ArrowRight');
  await expect(rendered).toHaveAttribute('data-step', 'step-03');
  await expect(rendered).toHaveAttribute('data-git-focus', 'index');
  await expect(lanes.nth(1).locator('[data-role="status"]')).toHaveText('staged for next commit');

  const paths = requested.map(pathOf);
  let expectedGitExperiencePath;
  let expectedGitRendererPath;

  if (WORDPRESS_LAYOUT === 'release') {
    expectedGitExperiencePath = `${MODULE_PREFIX}wordpress/experiences/git-basic-cycle.json`;
    expectedGitRendererPath = `${MODULE_PREFIX}src/renderers/subjects/git/renderer.mjs`;
  } else {
    const bootstrapPath = paths.find((path) => path.endsWith('/wordpress/assets/bootstrap.js'));
    expect(bootstrapPath).toBeDefined();
    const pluginRoot = bootstrapPath.slice(0, -'wordpress/assets/bootstrap.js'.length);
    expectedGitExperiencePath = `${pluginRoot}wordpress/experiences/git-basic-cycle.json`;
    expectedGitRendererPath = `${pluginRoot}src/renderers/subjects/git/renderer.mjs`;
  }

  expect(paths).toContain(expectedGitExperiencePath);
  expect(paths).toContain(expectedGitRendererPath);

  expect(requestFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);
});


test('R27 Git deep link enters directly and hashchange seeks the mounted instance', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(
    `${BASE_URL}/?pagename=cim-e2e-git#cim/git-basic-cycle/step-05`,
    { waitUntil: 'domcontentloaded' }
  );

  const root = page.locator('.cim[data-cim-experience="git-basic-cycle"]');
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  const rendered = root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="git/v1"]');

  await expect(rendered).toHaveAttribute('data-step', 'step-05');
  await expect(rendered).toHaveAttribute('data-git-focus', 'head');

  await page.evaluate(() => {
    window.location.hash = '#cim/git-basic-cycle/step-08';
  });

  await expect(rendered).toHaveAttribute('data-step', 'step-08');
  await expect(rendered).toHaveAttribute('data-git-focus', 'reflog');

  await page.evaluate(() => {
    window.location.hash = '#reference';
  });

  await expect(rendered).toHaveAttribute('data-step', 'step-08');
  expect(consoleErrors).toEqual([]);
});


test('R38 fixed instrument panel resists host styling and preserves controls, focus, and responsive layout', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${BASE_URL}/?pagename=cim-e2e-git`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="git-basic-cycle"]');
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  await root.evaluate((element) => {
    element.parentElement?.setAttribute('data-r38-host', 'dark');
  });
  await page.addStyleTag({
    content: `
      [data-r38-host="dark"] {
        padding: 2rem;
        color: rgb(245, 247, 250);
        background: rgb(11, 13, 16);
        font-family: Georgia, serif;
        text-align: center;
      }
      [data-r38-host="dark"] section,
      [data-r38-host="dark"] div,
      [data-r38-host="dark"] button,
      [data-r38-host="dark"] h2,
      [data-r38-host="dark"] h3,
      [data-r38-host="dark"] ul,
      [data-r38-host="dark"] li {
        color: rgb(224, 0, 160);
        background: rgb(8, 40, 60);
        border-color: rgb(0, 210, 120);
        border-radius: 2rem;
        font-family: Georgia, serif;
        font-weight: 300;
        line-height: 2;
        text-align: center;
        text-transform: uppercase;
      }
    `
  });

  const rendered = root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="git/v1"]');
  const laneRegion = rendered.locator('[data-role="git-lanes"]');
  const firstLane = laneRegion.locator('[data-git-lane]').first();
  const controls = root.getByRole('group', { name: 'Code in Motion controls' });
  const next = controls.getByRole('button', { name: 'Next' });
  const playback = controls.getByRole('button', { name: 'Play' });

  await expect(rendered).toHaveCSS('color', 'rgb(23, 27, 34)');
  await expect(rendered).toHaveCSS('background-color', 'rgb(244, 246, 248)');
  await expect(rendered).toHaveCSS('border-top-color', 'rgb(50, 58, 74)');
  await expect(rendered).toHaveCSS('border-radius', '8px');
  await expect(firstLane).toHaveCSS('color', 'rgb(23, 27, 34)');
  await expect(firstLane).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(firstLane).toHaveCSS('border-top-color', 'rgb(50, 58, 74)');

  await expect(controls).toHaveCount(1);
  await expect(controls).toHaveCSS('color', 'rgb(23, 27, 34)');
  await expect(controls).toHaveCSS('background-color', 'rgb(244, 246, 248)');
  await expect(controls).toHaveCSS('border-top-color', 'rgb(50, 58, 74)');
  await expect(controls.getByRole('button')).toHaveCount(6);
  await expect(controls.getByRole('button', { name: 'Start' })).toHaveCount(1);
  await expect(controls.getByRole('button', { name: 'Previous' })).toHaveCount(1);
  await expect(playback).toHaveCount(1);
  await expect(next).toHaveCount(1);
  await expect(controls.getByRole('button', { name: 'End' })).toHaveCount(1);
  await expect(controls.getByRole('button', { name: 'Restart' })).toHaveCount(1);
  await expect(next).toHaveCSS('color', 'rgb(23, 27, 34)');
  await expect(next).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(next).toHaveCSS('border-top-color', 'rgb(50, 58, 74)');
  await expect(next).toHaveCSS('font-weight', '700');

  await next.focus();
  await expect(next).toBeFocused();
  await expect(next).toHaveCSS('outline-style', 'solid');
  await expect(next).toHaveCSS('outline-width', '2px');
  await expect(next).toHaveCSS('outline-color', 'rgb(50, 58, 74)');
  await expect(next).toHaveCSS('outline-offset', '2px');

  await next.click();
  await expect(rendered).toHaveAttribute('data-step', 'step-01');

  await playback.click();
  await expect(controls.getByRole('button', { name: 'Pause' })).toHaveCount(1);
  await controls.getByRole('button', { name: 'Pause' }).click();
  await expect(controls.getByRole('button', { name: 'Play' })).toHaveCount(1);

  const columnCount = () => laneRegion.evaluate((element) => {
    const value = getComputedStyle(element).gridTemplateColumns.trim();
    return value === 'none' || value === '' ? 0 : value.split(/\s+/).length;
  });

  await page.setViewportSize({ width: 721, height: 900 });
  await expect.poll(columnCount).toBe(4);

  await page.setViewportSize({ width: 720, height: 900 });
  await expect.poll(columnCount).toBe(1);

  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(columnCount).toBe(1);
  expect(await root.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await controls.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
