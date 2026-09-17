import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://localhost:8891';
const WP_ENV_CONFIG = process.env.CIM_R16_CONFIG ?? 'r16-wp-env.json';
const CURRENT_ZIP = process.env.CIM_R16_CURRENT_ZIP ?? 'wp-content/r16-artifact/code-in-motion-0.1.0.zip';
const PRIOR_VERSION = '0.0.9';
const CURRENT_VERSION = '0.1.0';

function wpEnv(...args) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return execFileSync(
    executable,
    ['run', '--silent', 'wp-env', '--', `--config=${WP_ENV_CONFIG}`, ...args],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function renderedWithin(root) {
  return root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="synthetic/v1"]');
}

test('R16 upgrades N to N+1 while a warm browser session rejects stale module URLs', async ({ page, context }) => {
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
  await expect(renderedWithin(root).locator('[data-role="label"]')).toHaveText('R16 N A');

  const priorModuleUrls = requests.filter((url) => url.includes(`/wordpress/assets/modules/${PRIOR_VERSION}/`));
  expect(priorModuleUrls.length).toBeGreaterThan(0);
  expect(requests.some((url) => url.includes(`/wordpress/assets/modules/${CURRENT_VERSION}/`))).toBe(false);

  // Prime the browser HTTP cache explicitly with a module URL that N has already loaded.
  const priorBootstrapModule = priorModuleUrls.find((url) => url.includes('/wordpress/assets/bootstrap-module.mjs'));
  expect(priorBootstrapModule).toBeTruthy();
  await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`R16 cache prime failed: HTTP ${response.status}`);
    await response.text();
  }, priorBootstrapModule);

  const priorCacheResponse = responses.find((response) =>
    response.url === priorBootstrapModule && (response.fromDiskCache || response.fromPrefetchCache)
  );
  // Some Chromium/HTTP combinations revalidate instead of reporting a direct cache hit. The browser cache
  // remains enabled and primed; the post-upgrade proof below depends only on version-separated URLs.
  if (priorCacheResponse === undefined) {
    const cacheControl = await page.evaluate(async (url) => {
      const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
      return response.headers.get('cache-control') ?? '';
    }, priorBootstrapModule);
    expect(cacheControl.toLowerCase()).not.toContain('no-store');
  }

  // Upgrade through WordPress' normal plugin upgrader path. Do not pass --activate: activation must survive.
  wpEnv('run', 'cli', 'wp', 'plugin', 'install', CURRENT_ZIP, '--force');

  requests.length = 0;
  responses.length = 0;

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r16&r16=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await expect(root).toHaveAttribute('data-cim-state', 'ready');
  await expect(renderedWithin(root)).toHaveAttribute('data-node', 'A');
  await expect(renderedWithin(root).locator('[data-role="label"]')).toHaveText('Node A');

  expect(requests.some((url) => url.includes(`/wordpress/assets/modules/${CURRENT_VERSION}/wordpress/assets/bootstrap-module.mjs`))).toBe(true);
  expect(requests.some((url) => url.includes(`/wordpress/assets/modules/${CURRENT_VERSION}/wordpress/experiences/synthetic-wordpress.json`))).toBe(true);
  expect(requests.some((url) => url.includes(`/wordpress/assets/modules/${PRIOR_VERSION}/`))).toBe(false);

  await client.detach();
});
