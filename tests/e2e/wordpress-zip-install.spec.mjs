import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8890';
const PLUGIN_VERSION = process.env.CIM_PLUGIN_VERSION ?? '0.1.0';
const PLUGIN_PREFIX = '/wp-content/plugins/code-in-motion/';
const MODULE_PREFIX = `${PLUGIN_PREFIX}wordpress/assets/modules/${PLUGIN_VERSION}/`;

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

test('R15 runs the production path from the freshly installed release ZIP', async ({ page }) => {
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

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  const rendered = root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="synthetic/v1"]');
  await expect(rendered).toHaveAttribute('data-step', 'initial');
  await expect(rendered).toHaveAttribute('data-node', 'A');

  const paths = requested.map(pathOf);
  expect(paths).toContain(`${PLUGIN_PREFIX}wordpress/assets/bootstrap.js`);
  expect(paths.some((path) => path.startsWith(MODULE_PREFIX) && path.endsWith('/wordpress/assets/bootstrap-module.mjs'))).toBe(true);
  expect(paths.some((path) => path.startsWith(MODULE_PREFIX) && path.endsWith('/wordpress/experiences/synthetic-wordpress.json'))).toBe(true);
  expect(paths.some((path) => path.startsWith(MODULE_PREFIX) && path.endsWith('/src/host/wordpress-live-host.mjs'))).toBe(true);
  expect(paths.some((path) => path.startsWith(MODULE_PREFIX) && path.endsWith('/src/runtime/cim-instance.mjs'))).toBe(true);
  expect(paths.some((path) => path.startsWith(MODULE_PREFIX) && path.endsWith('/src/transport/transport-controller.mjs'))).toBe(true);
  expect(paths).not.toContain(`${PLUGIN_PREFIX}wordpress/assets/bootstrap-module.mjs`);

  expect(requestFailures, `request failures:\n${requestFailures.join('\n')}`).toEqual([]);
  expect(consoleErrors, `browser console/page errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
