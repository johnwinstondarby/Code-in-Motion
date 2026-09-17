import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
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

function renderedWithin(root) {
  return root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="synthetic/v1"]');
}

test('R10 direct connected reparent preserves one instance and permanent removal disposes only that root', async ({ page }) => {
  const observed = observePage(page);

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r9`, { waitUntil: 'domcontentloaded' });

  const one = page.locator('.cim[data-cim-instance="r9-one"]');
  const two = page.locator('.cim[data-cim-instance="r9-two"]');
  const three = page.locator('.cim[data-cim-instance="r9-three"]');

  await expect(one).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  await expect(two).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  await expect(three).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });

  const renderedOne = renderedWithin(one);
  const renderedTwo = renderedWithin(two);
  const renderedThree = renderedWithin(three);

  await two.focus();
  await page.keyboard.press('ArrowRight');
  await expect(renderedTwo).toHaveAttribute('data-step', 'step-01');
  await expect(renderedTwo).toHaveAttribute('data-node', 'B');

  await page.evaluate(() => {
    const root = document.querySelector('.cim[data-cim-instance="r9-two"]');
    if (!root) throw new Error('R10 reparent source root missing.');
    const destination = document.createElement('div');
    destination.id = 'r10-connected-destination';
    document.body.appendChild(destination);
    destination.appendChild(root);
  });

  await expect(two).toHaveAttribute('data-cim-state', 'ready');
  await expect(two).toHaveAttribute('tabindex', '0');
  await expect(renderedTwo).toHaveAttribute('data-step', 'step-01');
  await expect(renderedTwo).toHaveAttribute('data-node', 'B');

  await two.focus();
  await page.keyboard.press('ArrowRight');
  await expect(renderedTwo).toHaveAttribute('data-step', 'step-02');
  await expect(renderedTwo).toHaveAttribute('data-node', 'C');
  await expect(renderedOne).toHaveAttribute('data-step', 'initial');
  await expect(renderedThree).toHaveAttribute('data-step', 'initial');

  const oneHandle = await one.elementHandle();
  if (oneHandle === null) throw new Error('R10 detachable root handle missing.');
  await oneHandle.evaluate((root) => root.remove());

  await expect.poll(
    () => oneHandle.evaluate((root) => root.getAttribute('data-cim-state')),
    { timeout: 10000 }
  ).toBe('fallback');
  await expect.poll(
    () => oneHandle.evaluate((root) => root.getAttribute('tabindex')),
    { timeout: 10000 }
  ).toBe(null);

  await expect(two).toHaveAttribute('data-cim-state', 'ready');
  await expect(renderedTwo).toHaveAttribute('data-step', 'step-02');
  await expect(renderedTwo).toHaveAttribute('data-node', 'C');
  await expect(three).toHaveAttribute('data-cim-state', 'ready');
  await expect(renderedThree).toHaveAttribute('data-step', 'initial');
  await expect(renderedThree).toHaveAttribute('data-node', 'A');

  await page.evaluate((root) => document.body.appendChild(root), oneHandle);
  const reinsertedOne = page.locator('.cim[data-cim-instance="r9-one"]');
  await expect(reinsertedOne).toHaveAttribute('data-cim-state', 'fallback');
  await expect(reinsertedOne).not.toHaveAttribute('tabindex', '0');

  const paths = observed.requested.map(pathOf);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/root-lifecycle-binding.mjs'))).toBe(true);
  expect(observed.requestFailures, `request failures:\n${observed.requestFailures.join('\n')}`).toEqual([]);
  expect(observed.consoleErrors, `browser console/page errors:\n${observed.consoleErrors.join('\n')}`).toEqual([]);
});
