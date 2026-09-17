import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
const EXPERIENCE_PATH = '/wordpress/experiences/synthetic-wordpress.json';

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function diagnosticBlock(gate, label, entries) {
  const body = entries.length > 0 ? entries.join('\n') : '(none)';
  return `\n[${gate} ${label}]\n${body}`;
}

function observePage(page) {
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

  return { requested, responses, requestFailures, consoleErrors };
}

function logDiagnostics(gate, observed) {
  console.error(diagnosticBlock(gate, 'console/page errors', observed.consoleErrors));
  console.error(diagnosticBlock(gate, 'request failures', observed.requestFailures));
  console.error(diagnosticBlock(gate, 'requests', observed.requested));
  console.error(diagnosticBlock(gate, 'responses', observed.responses));
}

function renderedWithin(root) {
  return root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="synthetic/v1"]');
}

async function expectInitial(rendered) {
  await expect(rendered).toHaveAttribute('data-step', 'initial');
  await expect(rendered).toHaveAttribute('data-node', 'A');
  await expect(rendered.locator('[data-role="label"]')).toHaveText('Node A');
}

test('R8 mounts the synthetic WordPress Experience and navigates through production Transport', async ({ page }) => {
  const observed = observePage(page);

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveCount(1);

  try {
    await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  } catch (error) {
    logDiagnostics('R8', observed);
    throw error;
  }

  const rendered = renderedWithin(root);
  await expectInitial(rendered);
  await expect(rendered.locator('[data-role="detail"]')).toHaveText('Initial WordPress packaging state');

  await expect(root).toHaveAttribute('tabindex', '0');
  await root.focus();
  await expect(root).toBeFocused();
  await page.keyboard.press('ArrowRight');

  await expect(rendered).toHaveAttribute('data-step', 'step-01');
  await expect(rendered).toHaveAttribute('data-node', 'B');
  await expect(rendered.locator('[data-role="label"]')).toHaveText('Node B');
  await expect(rendered.locator('[data-role="detail"]')).toHaveText('First mounted transition');

  const paths = observed.requested.map(pathOf);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/bootstrap.js'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/bootstrap-module.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/wordpress/assets/transport-binding.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith(EXPERIENCE_PATH))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/host/wordpress-live-host.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/runtime/cim-instance.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/transport/transport-controller.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/transport/keyboard-binding.mjs'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/src/renderers/subjects/synthetic/renderer.mjs'))).toBe(true);

  expect(observed.requestFailures, `request failures:\n${observed.requestFailures.join('\n')}`).toEqual([]);
  expect(observed.consoleErrors, `browser console/page errors:\n${observed.consoleErrors.join('\n')}`).toEqual([]);
});

test('R9 keeps three same-Experience WordPress instances isolated', async ({ page }) => {
  const observed = observePage(page);

  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r9`, { waitUntil: 'domcontentloaded' });

  const roots = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(roots).toHaveCount(3);

  const one = page.locator('.cim[data-cim-instance="r9-one"]');
  const two = page.locator('.cim[data-cim-instance="r9-two"]');
  const three = page.locator('.cim[data-cim-instance="r9-three"]');

  try {
    await expect(one).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
    await expect(two).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
    await expect(three).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  } catch (error) {
    logDiagnostics('R9', observed);
    throw error;
  }

  const renderedOne = renderedWithin(one);
  const renderedTwo = renderedWithin(two);
  const renderedThree = renderedWithin(three);

  await expectInitial(renderedOne);
  await expectInitial(renderedTwo);
  await expectInitial(renderedThree);
  await expect(one).toHaveAttribute('tabindex', '0');
  await expect(two).toHaveAttribute('tabindex', '0');
  await expect(three).toHaveAttribute('tabindex', '0');

  const experienceRequests = observed.requested
    .map(pathOf)
    .filter((path) => path.endsWith(EXPERIENCE_PATH));
  expect(experienceRequests).toHaveLength(1);

  await two.focus();
  await expect(two).toBeFocused();
  await page.keyboard.press('ArrowRight');

  await expect(renderedTwo).toHaveAttribute('data-step', 'step-01');
  await expect(renderedTwo).toHaveAttribute('data-node', 'B');
  await expect(renderedOne).toHaveAttribute('data-step', 'initial');
  await expect(renderedOne).toHaveAttribute('data-node', 'A');
  await expect(renderedThree).toHaveAttribute('data-step', 'initial');
  await expect(renderedThree).toHaveAttribute('data-node', 'A');

  await one.focus();
  await expect(one).toBeFocused();
  await page.keyboard.press('End');

  await expect(renderedOne).toHaveAttribute('data-step', 'step-02');
  await expect(renderedOne).toHaveAttribute('data-node', 'C');
  await expect(renderedTwo).toHaveAttribute('data-step', 'step-01');
  await expect(renderedTwo).toHaveAttribute('data-node', 'B');
  await expect(renderedThree).toHaveAttribute('data-step', 'initial');
  await expect(renderedThree).toHaveAttribute('data-node', 'A');

  expect(observed.requestFailures, `request failures:\n${observed.requestFailures.join('\n')}`).toEqual([]);
  expect(observed.consoleErrors, `browser console/page errors:\n${observed.consoleErrors.join('\n')}`).toEqual([]);
});
