import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8894';
const PLUGIN_VERSION = process.env.CIM_PLUGIN_VERSION ?? '0.1.0';
const PLUGIN_PREFIX = '/wp-content/plugins/code-in-motion/';
const MODULE_PREFIX = `${PLUGIN_PREFIX}wordpress/assets/modules/${PLUGIN_VERSION}/`;
const EXPERIENCE_ROUTE = '**/wordpress/experiences/synthetic-wordpress.json*';

function renderedWithin(root) {
  return root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="synthetic/v1"]');
}

function observePage(page) {
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

  return { requested, requestFailures, consoleErrors };
}

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

test.beforeAll(async ({ browser }) => {
  console.log(
    `R20 browser: ${browser.browserType().name()} ${browser.version()}; Playwright 1.63.0`
  );
});

test('R20 installed artifact mounts and navigates through the production command path', async ({ page }) => {
  const observed = observePage(page);

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  const rendered = renderedWithin(root);
  await expect(rendered).toHaveAttribute('data-step', 'initial');
  await expect(rendered).toHaveAttribute('data-node', 'A');

  await root.focus();
  await expect(root).toBeFocused();
  await page.keyboard.press('ArrowRight');

  await expect(rendered).toHaveAttribute('data-step', 'step-01');
  await expect(rendered).toHaveAttribute('data-node', 'B');

  const paths = observed.requested.map(pathOf);
  expect(paths).toContain(`${PLUGIN_PREFIX}wordpress/assets/bootstrap.js`);
  expect(paths.some((path) =>
    path.startsWith(MODULE_PREFIX) && path.endsWith('/wordpress/assets/bootstrap-module.mjs')
  )).toBe(true);
  expect(paths.some((path) =>
    path.startsWith(MODULE_PREFIX) && path.endsWith('/src/host/wordpress-live-host.mjs')
  )).toBe(true);

  expect(observed.requestFailures).toEqual([]);
  expect(observed.consoleErrors).toEqual([]);
});

test('R20 keeps three same-Experience instances isolated', async ({ page }) => {
  const observed = observePage(page);

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r9`, { waitUntil: 'domcontentloaded' });

  const one = page.locator('.cim[data-cim-instance="r9-one"]');
  const two = page.locator('.cim[data-cim-instance="r9-two"]');
  const three = page.locator('.cim[data-cim-instance="r9-three"]');

  await expect(one).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  await expect(two).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  await expect(three).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  await two.focus();
  await page.keyboard.press('ArrowRight');

  await expect(renderedWithin(two)).toHaveAttribute('data-node', 'B');
  await expect(renderedWithin(one)).toHaveAttribute('data-node', 'A');
  await expect(renderedWithin(three)).toHaveAttribute('data-node', 'A');

  expect(observed.requestFailures).toEqual([]);
  expect(observed.consoleErrors).toEqual([]);
});

test('R20 preserves static fallback when the Experience cannot be delivered', async ({ page }) => {
  await page.route(EXPERIENCE_ROUTE, async (route) => route.abort('failed'));

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state', 'fallback', { timeout: 10000 });
  await expect(root.locator('.cim-fallback')).toBeVisible();
  await expect(renderedWithin(root)).toHaveCount(0);
});

test.describe('R20 reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('navigation succeeds without frame scheduling while reduced motion is active', async ({ page }) => {
    const observed = observePage(page);

    await page.addInitScript(() => {
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      window.__cimR20ForbidRaf = false;
      window.requestAnimationFrame = (callback) => {
        if (window.__cimR20ForbidRaf === true) {
          throw new Error('R20 reduced-motion path scheduled requestAnimationFrame.');
        }
        return nativeRequestAnimationFrame(callback);
      };
    });

    await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

    expect(
      await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ).toBe(true);

    const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
    await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

    const rendered = renderedWithin(root);
    await expect(rendered).toHaveAttribute('data-node', 'A');

    await page.evaluate(() => {
      window.__cimR20ForbidRaf = true;
    });
    await root.focus();
    await page.keyboard.press('ArrowRight');
    await expect(rendered).toHaveAttribute('data-node', 'B');
    await page.evaluate(() => {
      window.__cimR20ForbidRaf = false;
    });

    expect(observed.requestFailures).toEqual([]);
    expect(observed.consoleErrors).toEqual([]);
  });
});

test('R20 permanent root removal disposes the mounted instance', async ({ page }) => {
  const observed = observePage(page);

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  await expect(root).toHaveAttribute('tabindex', '0');

  const rootHandle = await root.elementHandle();
  if (rootHandle === null) throw new Error('R20 detachable root handle missing.');

  await rootHandle.evaluate((element) => element.remove());

  await expect.poll(
    () => rootHandle.evaluate((element) => element.getAttribute('data-cim-state')),
    { timeout: 10000 }
  ).toBe('fallback');
  await expect.poll(
    () => rootHandle.evaluate((element) => element.getAttribute('tabindex')),
    { timeout: 10000 }
  ).toBe(null);

  expect(observed.requestFailures).toEqual([]);
  expect(observed.consoleErrors).toEqual([]);
});
