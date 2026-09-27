import { test, expect } from '@playwright/test';

import { probeCiMReadiness } from '../../tools/probe-wordpress-readiness.mjs';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
const ROOT_SELECTOR = '.cim[data-cim-experience="synthetic-wordpress"]';

test('RC1 F2 readiness probe returns mounted synthetic evidence only after ready', async ({ page }) => {
  const result = await probeCiMReadiness({
    page,
    url: `${BASE_URL}/?pagename=cim-e2e`,
    selector: ROOT_SELECTOR,
    timeoutMs: 10000
  });

  expect(result.ok).toBe(true);
  expect(result.state).toBe('ready');
  expect(result.rendererId).toBe('synthetic/v1');
  expect(result.step).toBe('initial');
  expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(result.dom).toContain('data-cim-state="ready"');
  expect(result.dom).toContain('data-cim-renderer="synthetic/v1"');
});
