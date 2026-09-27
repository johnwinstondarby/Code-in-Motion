import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CiMReadinessProbeError,
  probeCiMReadiness
} from '../tools/probe-wordpress-readiness.mjs';

function fakePage(snapshots) {
  let index = 0;
  const calls = [];
  return {
    calls,
    async goto(url, options) {
      calls.push({ kind: 'goto', url, options });
    },
    async evaluate() {
      const snapshot = snapshots[Math.min(index, snapshots.length - 1)];
      index += 1;
      return { ...snapshot };
    }
  };
}

const URL = 'https://example.test/cim';
const SELECTOR = '.cim[data-cim-instance="probe"]';
const READY = {
  count: 1,
  state: 'ready',
  dom: '<div class="cim" data-cim-state="ready"><section data-cim-renderer="synthetic/v1" data-step="initial"></section></div>',
  rendererId: 'synthetic/v1',
  step: 'initial'
};

async function expectProbeError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CiMReadinessProbeError);
    assert.equal(error.code, code);
    return true;
  });
}

test('readiness probe returns mounted renderer evidence only after ready', async () => {
  const page = fakePage([READY]);
  const result = await probeCiMReadiness({ page, url: URL, selector: SELECTOR, timeoutMs: 100 });

  assert.equal(result.ok, true);
  assert.equal(result.state, 'ready');
  assert.equal(result.rendererId, 'synthetic/v1');
  assert.equal(result.step, 'initial');
  assert.match(result.dom, /data-cim-state="ready"/);
  assert.ok(Number.isInteger(result.elapsedMs));
  assert.deepEqual(page.calls, [{ kind: 'goto', url: URL, options: { waitUntil: 'domcontentloaded' } }]);
});

test('readiness probe waits through a delayed mount before producing success', async () => {
  const page = fakePage([
    { count: 1, state: null, dom: '<div class="cim">fallback</div>', rendererId: null, step: null },
    { count: 1, state: 'mounting', dom: '<div class="cim" data-cim-state="mounting">fallback</div>', rendererId: null, step: null },
    READY
  ]);

  const result = await probeCiMReadiness({ page, url: URL, selector: SELECTOR, timeoutMs: 250 });
  assert.equal(result.state, 'ready');
  assert.equal(result.rendererId, 'synthetic/v1');
  assert.ok(result.elapsedMs >= 50);
});

test('readiness probe rejects a selector with no matching root', async () => {
  const page = fakePage([{ count: 0 }]);
  await expectProbeError(
    probeCiMReadiness({ page, url: URL, selector: SELECTOR, timeoutMs: 100 }),
    'root_not_found'
  );
});

test('readiness probe rejects an ambiguous selector rather than choosing a root', async () => {
  const page = fakePage([{ count: 2 }]);
  await expectProbeError(
    probeCiMReadiness({ page, url: URL, selector: '.cim', timeoutMs: 100 }),
    'root_ambiguous'
  );
});

test('readiness timeout distinguishes an absent state attribute', async () => {
  const page = fakePage([
    { count: 1, state: null, dom: '<div class="cim">fallback</div>', rendererId: null, step: null }
  ]);

  await assert.rejects(
    probeCiMReadiness({ page, url: URL, selector: SELECTOR, timeoutMs: 10 }),
    (error) => {
      assert.equal(error.code, 'readiness_timeout');
      assert.equal(error.details.state, null);
      assert.match(error.message, /attribute absent/);
      assert.ok(error.details.elapsedMs >= 10);
      return true;
    }
  );
});

test('readiness timeout reports the observed non-ready state', async () => {
  const page = fakePage([
    { count: 1, state: 'faulted', dom: '<div class="cim" data-cim-state="faulted">fallback</div>', rendererId: null, step: null }
  ]);

  await assert.rejects(
    probeCiMReadiness({ page, url: URL, selector: SELECTOR, timeoutMs: 10 }),
    (error) => {
      assert.equal(error.code, 'readiness_timeout');
      assert.equal(error.details.state, 'faulted');
      assert.match(error.message, /state="faulted"/);
      return true;
    }
  );
});

test('readiness probe rejects ready without mounted renderer and step evidence', async () => {
  const page = fakePage([
    { count: 1, state: 'ready', dom: '<div class="cim" data-cim-state="ready"></div>', rendererId: null, step: null }
  ]);

  await expectProbeError(
    probeCiMReadiness({ page, url: URL, selector: SELECTOR, timeoutMs: 100 }),
    'render_evidence_missing'
  );
});
