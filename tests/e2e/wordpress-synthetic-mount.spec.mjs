import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

test('R8a mounts the synthetic WordPress Experience through the production browser path', async ({ page }) => {
  const requested = [];
  const consoleErrors = [];

  page.on('request', (request) => requested.push(request.url()));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute('data-cim-state', 'ready');

  const rendererRoot = root.locator('[data-cim-renderer-root]');
  const rendered = rendererRoot.locator('section[data-cim-renderer="synthetic/v1"]');
  await expect(rendered).toHaveAttribute('data-step', 'initial');
  await expect(rendered).toHaveAttribute('data-node', 'A');
  await expect(rendered.locator('[data-role="label"]')).toHaveText('Node A');
  await expect(rendered.locator('[data-role="detail"]')).toHaveText('Initial WordPress packaging state');

  const paths = requested.map(pathOf);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/bootstrap.js'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/bootstrap-module.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/experiences/synthetic-wordpress.json'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/host/wordpress-live-host.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/runtime/cim-instance.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/renderers/subjects/synthetic/renderer.mjs'))).toBe(true);

  expect(consoleErrors, `browser console/page errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
