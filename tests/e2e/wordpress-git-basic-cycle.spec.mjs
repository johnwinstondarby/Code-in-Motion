import { expect, test } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
const PLUGIN_VERSION = process.env.CIM_PLUGIN_VERSION ?? '0.1.0';
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

  const lanes = rendered.locator('[data-role="git-lanes"] > [data-git-lane]');
  await expect(lanes).toHaveCount(4);
  await expect(lanes.nth(0)).toHaveAttribute('data-git-lane', 'working-tree');
  await expect(lanes.nth(1)).toHaveAttribute('data-git-lane', 'index');
  await expect(lanes.nth(2)).toHaveAttribute('data-git-lane', 'local');
  await expect(lanes.nth(3)).toHaveAttribute('data-git-lane', 'remote');

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
  const expectedGitExperiencePath = WORDPRESS_LAYOUT === 'release'
    ? `${MODULE_PREFIX}experiences/git/git-basic-cycle.json`
    : `${PLUGIN_PREFIX}experiences/git/git-basic-cycle.json`;
  const expectedGitRendererPath = WORDPRESS_LAYOUT === 'release'
    ? `${MODULE_PREFIX}src/renderers/subjects/git/renderer.mjs`
    : `${PLUGIN_PREFIX}src/renderers/subjects/git/renderer.mjs`;

  expect(paths).toContain(expectedGitExperiencePath);
  expect(paths).toContain(expectedGitRendererPath);

  expect(requestFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
