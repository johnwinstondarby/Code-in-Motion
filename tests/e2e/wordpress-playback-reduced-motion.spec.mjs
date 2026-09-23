import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
const ROOT_SELECTOR = '.cim[data-cim-experience="synthetic-wordpress"]';
const RENDERED_SELECTOR = '[data-cim-renderer-root] section[data-cim-renderer="synthetic/v1"]';

async function installAnimationFrameGate(page) {
  await page.addInitScript(() => {
    let nextHandle = 0;
    const callbacks = new Map();

    window.requestAnimationFrame = (callback) => {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    };

    window.cancelAnimationFrame = (handle) => {
      callbacks.delete(handle);
    };

    Object.defineProperty(window, '__cimAnimationFrameGate', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        pending() {
          return callbacks.size;
        },
        runOne() {
          const first = callbacks.entries().next();
          if (first.done) return false;
          const [handle, callback] = first.value;
          callbacks.delete(handle);
          callback(window.performance.now());
          return true;
        }
      })
    });
  });
}

async function openSynthetic(page, reducedMotion) {
  await installAnimationFrameGate(page);
  await page.emulateMedia({ reducedMotion });
  await page.goto(`${BASE_URL}/?pagename=cim-e2e`, { waitUntil: 'domcontentloaded' });

  const root = page.locator(ROOT_SELECTOR);
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute('data-cim-state', 'ready', { timeout: 10000 });
  await root.focus();
  await expect(root).toBeFocused();
  return root;
}

async function pendingAnimationFrames(page) {
  return page.evaluate(() => window.__cimAnimationFrameGate.pending());
}

async function runOneAnimationFrame(page) {
  const ran = await page.evaluate(() => window.__cimAnimationFrameGate.runOne());
  expect(ran).toBe(true);
}

test('R36 WordPress Space playback reaches the animated production path under normal motion', async ({ page }) => {
  const root = await openSynthetic(page, 'no-preference');
  const rendered = root.locator(RENDERED_SELECTOR);

  await page.keyboard.press('Space');
  await expect.poll(() => pendingAnimationFrames(page)).toBe(1);
  await expect(rendered).toHaveAttribute('data-step', 'initial');

  await runOneAnimationFrame(page);
  await expect.poll(() => pendingAnimationFrames(page)).toBe(1);
  await expect(rendered).toHaveAttribute('data-step', 'initial');

  await runOneAnimationFrame(page);
  await expect(rendered).toHaveAttribute('data-step', 'step-01');
  await expect.poll(() => pendingAnimationFrames(page)).toBe(1);

  await runOneAnimationFrame(page);
  await expect.poll(() => pendingAnimationFrames(page)).toBe(1);
  await expect(rendered).toHaveAttribute('data-step', 'step-01');

  await runOneAnimationFrame(page);
  await expect(rendered).toHaveAttribute('data-step', 'step-02');
  await expect(rendered).toHaveAttribute('data-node', 'C');
  await expect.poll(() => pendingAnimationFrames(page)).toBe(0);
});

test('R36 effective reduced motion completes the same Space playback path without animation frames', async ({ page }) => {
  const root = await openSynthetic(page, 'reduce');
  const rendered = root.locator(RENDERED_SELECTOR);

  await page.keyboard.press('Space');
  await expect(rendered).toHaveAttribute('data-step', 'step-02', { timeout: 10000 });
  await expect(rendered).toHaveAttribute('data-node', 'C');
  await expect.poll(() => pendingAnimationFrames(page)).toBe(0);
});
