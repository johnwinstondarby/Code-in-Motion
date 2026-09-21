import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://localhost:8891';
const WP_ENV_CONFIG = process.env.CIM_R16_CONFIG ?? 'r16-wp-env.json';
const CURRENT_ZIP = process.env.CIM_R16_CURRENT_ZIP;
const PRIOR_VERSION = process.env.CIM_R16_PRIOR_VERSION;
const CURRENT_VERSION = process.env.CIM_R16_CURRENT_VERSION;

for (const [name, value] of Object.entries({
  CIM_R16_CURRENT_ZIP: CURRENT_ZIP,
  CIM_R16_PRIOR_VERSION: PRIOR_VERSION,
  CIM_R16_CURRENT_VERSION: CURRENT_VERSION
})) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' is required for the upgrade proof.');
  }
}
function wpEnv(...args) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return execFileSync(
    executable,
    ['run', '--silent', 'wp-env', '--', `--config=${WP_ENV_CONFIG}`, ...args],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}
function renderedWithin(root) {
  return root.locator('[data-cim-renderer-root]').locator('section[data-cim-renderer="synthetic/v1"]');
}
test('R16/R30 warm-cache prior-to-current WordPress upgrade proof', async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: false });
  const requests = [];
  const responses = [];
  client.on('Network.requestWillBeSent', ({ request }) => requests.push(request.url));
  client.on('Network.responseReceived', ({ response }) => responses.push({
    url: response.url,
    status: response.status,
    fromDiskCache: response.fromDiskCache === true,
    fromPrefetchCache: response.fromPrefetchCache === true
  }));

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r16`, { waitUntil: 'domcontentloaded' });
  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state', 'ready');
  await expect(renderedWithin(root)).toHaveAttribute('data-node', 'A');
  await expect(renderedWithin(root).locator('[data-role="label"]')).toHaveText('Node A');

  const priorModuleUrls = requests.filter((url) => url.includes(`/wordpress/assets/modules/${PRIOR_VERSION}/`));
  expect(priorModuleUrls.length).toBeGreaterThan(0);
  expect(requests.some((url) => url.includes(`/wordpress/assets/modules/${CURRENT_VERSION}/`))).toBe(false);

  const priorBootstrapModule = priorModuleUrls.find((url) => url.includes('/wordpress/assets/bootstrap-module.mjs'));
  expect(priorBootstrapModule).toBeTruthy();
  await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`upgrade cache prime failed: HTTP ${response.status}`);
    await response.text();
  }, priorBootstrapModule);

  const priorCacheResponse = responses.find((response) =>
    response.url === priorBootstrapModule && (response.fromDiskCache || response.fromPrefetchCache)
  );
  if (priorCacheResponse === undefined) {
    const cacheControl = await page.evaluate(async (url) => {
      const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
      return response.headers.get('cache-control') ?? '';
    }, priorBootstrapModule);
    expect(cacheControl.toLowerCase()).not.toContain('no-store');
  }

  wpEnv('run', 'cli', 'wp', 'plugin', 'install', CURRENT_ZIP, '--force');
  requests.length = 0;
  responses.length = 0;

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r16&r16=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await expect(root).toHaveAttribute('data-cim-state', 'ready');
  await expect(renderedWithin(root)).toHaveAttribute('data-node', 'A');
  await expect(renderedWithin(root).locator('[data-role="label"]')).toHaveText('Node A');

  expect(requests.some((url) =>
    url.includes(`/wordpress/assets/modules/${CURRENT_VERSION}/wordpress/assets/bootstrap-module.mjs`)
  )).toBe(true);
  expect(requests.some((url) =>
    url.includes(`/wordpress/assets/modules/${CURRENT_VERSION}/wordpress/experiences/synthetic-wordpress.json`)
  )).toBe(true);
  expect(requests.some((url) => url.includes(`/wordpress/assets/modules/${PRIOR_VERSION}/`))).toBe(false);

  await root.focus();
  await page.keyboard.press('ArrowRight');
  await expect(renderedWithin(root)).toHaveAttribute('data-step', 'step-01');
  await expect(renderedWithin(root)).toHaveAttribute('data-node', 'B');

  const rootHandle = await root.elementHandle();
  if (rootHandle === null) throw new Error('post-upgrade root handle missing.');
  await rootHandle.evaluate((element) => element.remove());
  await expect.poll(
    () => rootHandle.evaluate((element) => element.getAttribute('data-cim-state')),
    { timeout: 10000 }
  ).toBe('fallback');
  await expect.poll(
    () => rootHandle.evaluate((element) => element.getAttribute('tabindex')),
    { timeout: 10000 }
  ).toBe(null);
  await client.detach();
});
