import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
const EXPERIENCE_ROUTE = '**/wordpress/experiences/synthetic-wordpress.json*';
const BOOTSTRAP_MODULE_ROUTE = '**/wordpress/assets/bootstrap-module.mjs*';

function cimConsoleRecords(page) {
  const records = [];
  page.on('console', async (message) => {
    if (message.type() !== 'error') return;
    if (!message.text().startsWith('[CiM]')) return;
    const args = message.args();
    if (args.length < 2) return;
    try {
      const value = await args[1].jsonValue();
      if (value && typeof value === 'object') records.push(value);
    } catch {
      // A diagnostic serialization failure cannot make the page test pass.
    }
  });
  return records;
}

function cimConsoleTexts(page) {
  const entries = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('[CiM]')) entries.push(message.text());
  });
  return entries;
}

async function waitForDiagnostic(records, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = records.find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for CiM diagnostic. Records: ${JSON.stringify(records)}`);
}

async function waitForText(entries, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = entries.find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for CiM console evidence. Entries: ${JSON.stringify(entries)}`);
}

function renderedWithin(root) {
  return root
    .locator('[data-cim-renderer-root]')
    .locator('section[data-cim-renderer="synthetic/v1"]');
}

function validExperience(overrides = {}) {
  return {
    schema: 'localis.cim/v1',
    engine_min: '0.1.0',
    experience_version: '1.0.0',
    id: 'synthetic-wordpress',
    renderer: 'synthetic/v1',
    renderer_config: { prefix: 'Node ' },
    initial_state: { node: 'A', detail: 'Initial WordPress packaging state' },
    steps: [
      {
        id: 'step-01',
        label: 'Advance to B',
        commentary: { text: 'Advance.', links: [] },
        state: { node: 'B', detail: 'First mounted transition' }
      }
    ],
    ...overrides
  };
}

test('R11 keeps an unavailable Experience root local while a healthy sibling mounts', async ({ page }) => {
  const records = cimConsoleRecords(page);
  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r11-missing`, { waitUntil: 'domcontentloaded' });

  const bad = page.locator('.cim[data-cim-instance="r11-missing"]');
  const good = page.locator('.cim[data-cim-instance="r11-good"]');
  await expect(bad).toHaveAttribute('data-cim-state', 'fallback');
  await expect(good).toHaveAttribute('data-cim-state', 'ready');
  await expect(renderedWithin(good)).toHaveAttribute('data-node', 'A');

  const diagnostic = await waitForDiagnostic(
    records,
    (record) => record.instanceId === 'r11-missing' && record.operation === 'experience_load'
  );
  expect(diagnostic).toMatchObject({ code: 'CIM-HST-001', component: 'host' });
  expect(diagnostic.code.startsWith('CIM-EXP-')).toBe(false);
});

test('R11 classifies HTTP 200 HTML as delivery failure, never Experience validation', async ({ page }) => {
  const records = cimConsoleRecords(page);
  await page.route(EXPERIENCE_ROUTE, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>login wall</body></html>' });
  });

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });
  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state', 'fallback');

  const diagnostic = await waitForDiagnostic(records, (record) => record.operation === 'experience_load');
  expect(diagnostic).toMatchObject({ code: 'CIM-HST-001', component: 'host' });
  expect(diagnostic.code.startsWith('CIM-EXP-')).toBe(false);
});

test('R11 preserves structured Experience ownership after JSON parses', async ({ page }) => {
  const records = cimConsoleRecords(page);
  const invalid = validExperience({ schema: 'localis.cim/v2' });
  await page.route(EXPERIENCE_ROUTE, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invalid) });
  });

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });
  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state', 'fallback');

  const diagnostic = await waitForDiagnostic(records, (record) => record.operation === 'experience_load');
  expect(diagnostic).toMatchObject({ code: 'CIM-EXP-001', component: 'experience' });
  expect(diagnostic.code).not.toBe('CIM-HST-001');
});

test('R11 preserves renderer ownership for an unknown renderer identifier', async ({ page }) => {
  const records = cimConsoleRecords(page);
  const experience = validExperience({ renderer: 'unknown/v1' });
  await page.route(EXPERIENCE_ROUTE, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(experience) });
  });

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });
  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state', 'fallback');

  const diagnostic = await waitForDiagnostic(records, (record) => record.operation === 'renderer_resolve');
  expect(diagnostic).toMatchObject({ code: 'CIM-RND-001', component: 'renderer' });
});

test('R11 contains a duplicate explicit instance identity to the duplicate root', async ({ page }) => {
  const records = cimConsoleRecords(page);
  await page.goto(`${BASE_URL}/?pagename=cim-e2e-r11-duplicate`, { waitUntil: 'domcontentloaded' });

  const roots = page.locator('.cim[data-cim-instance="r11-duplicate"]');
  await expect(roots).toHaveCount(2);
  await expect(roots.nth(0)).toHaveAttribute('data-cim-state', 'ready');
  await expect(roots.nth(1)).toHaveAttribute('data-cim-state', 'fallback');

  const diagnostic = await waitForDiagnostic(
    records,
    (record) => record.operation === 'invocation' && record.code === 'CIM-HST-004'
  );
  expect(diagnostic).toMatchObject({ component: 'host' });
});

test('R11 leaves static fallback visible when the bootstrap module cannot load', async ({ page }) => {
  const texts = cimConsoleTexts(page);
  await page.route(BOOTSTRAP_MODULE_ROUTE, async (route) => route.abort('failed'));

  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });
  const root = page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveCount(1);
  await expect(root).not.toHaveAttribute('data-cim-state', 'ready');
  await expect(root.locator('.cim-fallback')).toBeVisible();
  await expect(renderedWithin(root)).toHaveCount(0);

  const entry = await waitForText(texts, (text) => text.includes('WordPress bootstrap failed'));
  expect(entry).toContain('[CiM]');
});
