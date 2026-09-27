import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 50;
const RENDERED_SELECTOR = '[data-cim-renderer-root] section[data-cim-renderer]';

export class CiMReadinessProbeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CiMReadinessProbeError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function assertInput(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

function describeState(state) {
  return state === null ? 'attribute absent' : `state=${JSON.stringify(state)}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function snapshotRoot(page, selector) {
  return page.evaluate(({ rootSelector, renderedSelector }) => {
    const roots = Array.from(document.querySelectorAll(rootSelector));
    if (roots.length !== 1) return { count: roots.length };

    const root = roots[0];
    const rendered = root.querySelector(renderedSelector);
    return {
      count: 1,
      state: root.getAttribute('data-cim-state'),
      dom: root.outerHTML,
      rendererId: rendered?.getAttribute('data-cim-renderer') ?? null,
      step: rendered?.getAttribute('data-step') ?? null
    };
  }, { rootSelector: selector, renderedSelector: RENDERED_SELECTOR });
}

export async function probeCiMReadiness({
  page,
  url,
  selector,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  if (!page || typeof page.goto !== 'function' || typeof page.evaluate !== 'function') {
    throw new TypeError('page must provide goto() and evaluate().');
  }
  assertInput(url, 'url');
  assertInput(selector, 'selector');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('timeoutMs must be a positive integer.');
  }

  const startedAt = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  let snapshot = await snapshotRoot(page, selector);
  if (snapshot.count === 0) {
    throw new CiMReadinessProbeError(
      'root_not_found',
      `CiM readiness probe found no root matching ${JSON.stringify(selector)}.`,
      { selector, elapsedMs: Date.now() - startedAt }
    );
  }
  if (snapshot.count !== 1) {
    throw new CiMReadinessProbeError(
      'root_ambiguous',
      `CiM readiness probe found ${snapshot.count} roots matching ${JSON.stringify(selector)}; exactly one is required.`,
      { selector, count: snapshot.count, elapsedMs: Date.now() - startedAt }
    );
  }

  while (snapshot.state !== 'ready') {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new CiMReadinessProbeError(
        'readiness_timeout',
        `CiM readiness probe timed out after ${elapsedMs} ms: ${describeState(snapshot.state)}.`,
        { selector, state: snapshot.state, elapsedMs }
      );
    }
    await delay(Math.min(POLL_INTERVAL_MS, timeoutMs - elapsedMs));
    snapshot = await snapshotRoot(page, selector);
    if (snapshot.count !== 1) {
      const code = snapshot.count === 0 ? 'root_not_found' : 'root_ambiguous';
      throw new CiMReadinessProbeError(
        code,
        `CiM readiness probe root cardinality changed to ${snapshot.count} for ${JSON.stringify(selector)}.`,
        { selector, count: snapshot.count, elapsedMs: Date.now() - startedAt }
      );
    }
  }

  const elapsedMs = Date.now() - startedAt;
  return Object.freeze({
    ok: true,
    url,
    selector,
    elapsedMs,
    state: snapshot.state,
    rendererId: snapshot.rendererId,
    step: snapshot.step,
    dom: snapshot.dom
  });
}

async function runCli() {
  const [url, selector] = process.argv.slice(2);
  if (!url || !selector || process.argv.length !== 4) {
    console.error('Usage: node tools/probe-wordpress-readiness.mjs <url> <unique-cim-root-selector>');
    process.exitCode = 2;
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error('CiM readiness probe requires the repository-pinned @playwright/test runtime.');
    process.exitCode = 2;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const result = await probeCiMReadiness({ page, url, selector });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof CiMReadinessProbeError) {
      console.error(JSON.stringify({ ok: false, code: error.code, message: error.message, ...error.details }, null, 2));
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runCli();
}
