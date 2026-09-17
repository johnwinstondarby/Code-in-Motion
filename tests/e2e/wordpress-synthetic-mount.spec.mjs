import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function diagnosticBlock(label, entries) {
  const body = entries.length > 0 ? entries.join('\n') : '(none)';
  return `\n[R8 ${label}]\n${body}`;
}

test('R8 mounts the synthetic WordPress Experience and navigates through production Transport', async ({ page }) => {
  const requested = [];
  const responses = [];
  const requestFailures = [];
  const consoleErrors = [];

  page.on('request', (request) => requested.push(request.url()));
  page.on('response', (response) => {
    const headers = response.headers();
    responses.push(`${response.status()} ${response.url()} :: ${headers['content-type'] ?? '(no content-type)'}`);
  });
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

  try {
    await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  } catch (error) {
    console.error(diagnosticBlock('console/page errors', consoleErrors));
    console.error(diagnosticBlock('request failures', requestFailures));
    console.error(diagnosticBlock('requests', requested));
    console.error(diagnosticBlock('responses', responses));
    throw error;
  }

  const rendererRoot = root.locator('[data-cim-renderer-root]');
  const rendered = rendererRoot.locator('section[data-cim-renderer="synthetic/v1"]');
  await expect(rendered).toHaveAttribute('data-step', 'initial');
  await expect(rendered).toHaveAttribute('data-node', 'A');
  await expect(rendered.locator('[data-role="label"]')).toHaveText('Node A');
  await expect(rendered.locator('[data-role="detail"]')).toHaveText('Initial WordPress packaging state');

  await expect(root).toHaveAttribute('tabindex', '0');
  await root.focus();
  await expect(root).toBeFocused();
  await page.keyboard.press('ArrowRight');

  await expect(rendered).toHaveAttribute('data-step', 'step-01');
  await expect(rendered).toHaveAttribute('data-node', 'B');
  await expect(rendered.locator('[data-role="label"]')).toHaveText('Node B');
  await expect(rendered.locator('[data-role="detail"]')).toHaveText('First mounted transition');

  const paths = requested.map(pathOf);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/bootstrap.js'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/bootstrap-module.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/transport-binding.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/experiences/synthetic-wordpress.json'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/host/wordpress-live-host.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/runtime/cim-instance.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/transport/transport-controller.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/transport/keyboard-binding.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/renderers/subjects/synthetic/renderer.mjs'))).toBe(true);

  expect(requestFailures, `request failures:\n${requestFailures.join('\n')}`).toEqual([]);
  expect(consoleErrors, `browser console/page errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
