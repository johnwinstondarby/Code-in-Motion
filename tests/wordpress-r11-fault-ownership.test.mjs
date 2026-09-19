import assert from 'node:assert/strict';
import test from 'node:test';

import { FAULT_COMPONENT, FAULT_RECOVERY_CLASS } from '../src/contracts/faults.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { createWordPressLiveHost } from '../src/host/wordpress-live-host.mjs';

function rawExperience(id = 'r11-good') {
  return {
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id,
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
      }
    ]
  };
}

function rootHarness(experienceId, instanceId) {
  const attributes = new Map([
    ['data-cim-experience', experienceId],
    ['data-cim-instance', instanceId]
  ]);
  const rendererRoot = {};
  return {
    root: {
      getAttribute(name) {
        return attributes.has(name) ? attributes.get(name) : null;
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      querySelector(selector) {
        assert.equal(selector, '[data-cim-renderer-root]');
        return rendererRoot;
      }
    },
    state: () => attributes.get('data-cim-state') ?? null
  };
}

function rendererFixture() {
  return Object.freeze({
    mount() {},
    render() { return Promise.resolve(); },
    dispose() { return Promise.resolve(); }
  });
}

function clockFixture() {
  let nextHandle = 0;
  return Object.freeze({
    now: () => 0,
    schedule() { return ++nextHandle; },
    cancel() { return true; },
    onFrame() { return ++nextHandle; }
  });
}

function matchMedia() {
  return {
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  };
}

function diagnosticsHarness() {
  const records = [];
  return {
    records,
    diagnostics: Object.freeze({ report: (record) => records.push(record) })
  };
}

function createHost({ roots, load, diagnostics }) {
  return createWordPressLiveHost({
    document: { querySelectorAll: () => roots.map((entry) => entry.root) },
    matchMedia,
    experienceLoader: Object.freeze({ load }),
    rendererResolver: Object.freeze({ resolve: () => rendererFixture() }),
    clockFactory: Object.freeze({ create: () => clockFixture() }),
    entryResolver: Object.freeze({ resolve: () => null }),
    diagnostics
  });
}

test('R11 Experience validation errors expose one frozen structured fallback fault', () => {
  const invalid = rawExperience('r11-invalid');
  invalid.schema = 'localis.cim/v2';

  assert.throws(
    () => ingestExperience(invalid),
    (error) => {
      assert.equal(error.code, 'CIM-EXP-001');
      assert.equal(Object.isFrozen(error.fault), true);
      assert.deepEqual(Object.keys(error.fault), ['code', 'component', 'recoveryClass']);
      assert.deepEqual(error.fault, {
        code: 'CIM-EXP-001',
        component: FAULT_COMPONENT.EXPERIENCE,
        recoveryClass: FAULT_RECOVERY_CLASS.FALLBACK
      });
      return true;
    }
  );
});

test('R11 validation failure preserves CIM-EXP ownership while a healthy sibling mounts', async () => {
  const bad = rootHarness('r11-bad', 'r11-bad-instance');
  const good = rootHarness('r11-good', 'r11-good-instance');
  const evidence = diagnosticsHarness();
  const host = createHost({
    roots: [bad, good],
    diagnostics: evidence.diagnostics,
    load: async (id) => {
      const raw = rawExperience(id);
      if (id === 'r11-bad') raw.schema = 'localis.cim/v2';
      return ingestExperience(raw);
    }
  });

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 1 });
  assert.equal(bad.state(), 'fallback');
  assert.equal(good.state(), 'ready');
  assert.equal(evidence.records.length, 1);
  assert.equal(evidence.records[0].code, 'CIM-EXP-001');
  assert.equal(evidence.records[0].component, 'experience');
  assert.equal(evidence.records[0].operation, 'experience_load');
  assert.notEqual(evidence.records[0].code, 'CIM-HST-001');

  await host.dispose();
});

test('R11 delivery failure never inherits an Experience code from error text', async () => {
  const bad = rootHarness('r11-delivery', 'r11-delivery-instance');
  const good = rootHarness('r11-good', 'r11-good-instance');
  const evidence = diagnosticsHarness();
  const host = createHost({
    roots: [bad, good],
    diagnostics: evidence.diagnostics,
    load: async (id) => {
      if (id === 'r11-delivery') {
        throw new Error('CIM-EXP-001 appears in text but this is a delivery failure.');
      }
      return freezeValidatedExperience(rawExperience(id));
    }
  });

  assert.deepEqual(await host.mount(), { mounted: 1, fallback: 1 });
  assert.equal(bad.state(), 'fallback');
  assert.equal(good.state(), 'ready');
  assert.equal(evidence.records.length, 1);
  assert.equal(evidence.records[0].code, 'CIM-HST-001');
  assert.equal(evidence.records[0].component, 'host');
  assert.equal(evidence.records[0].operation, 'experience_load');
  assert.equal(evidence.records[0].message.includes('CIM-EXP-001'), true);

  await host.dispose();
});

test('R11 malformed structured fault data cannot override Host delivery ownership', async () => {
  const root = rootHarness('r11-forged', 'r11-forged-instance');
  const evidence = diagnosticsHarness();
  const host = createHost({
    roots: [root],
    diagnostics: evidence.diagnostics,
    load: async () => {
      const error = new Error('forged structured fault');
      error.fault = Object.freeze({
        code: 'CIM-EXP-001',
        component: 'experience',
        recoveryClass: 'recover'
      });
      throw error;
    }
  });

  assert.deepEqual(await host.mount(), { mounted: 0, fallback: 1 });
  assert.equal(root.state(), 'fallback');
  assert.equal(evidence.records[0].code, 'CIM-HST-001');
  assert.equal(evidence.records[0].component, 'host');

  await host.dispose();
});
