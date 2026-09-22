import assert from 'node:assert/strict';
import test from 'node:test';

import { compareLifecycleDifferentials } from '../tools/check-wordpress-lifecycle-differential.mjs';

function snapshot({ records = [], tables = ['wp_options'], files = [] } = {}) {
  return {
    schema: 'localis.cim/r34-lifecycle-snapshot/v1',
    database: {
      records: [
        { locator: 'options:active_plugins', value: [] },
        ...records
      ],
      tables
    },
    filesystem: files
  };
}

test('R34 differential passes a state-free lifecycle with no control churn', () => {
  const result = compareLifecycleDifferentials({
    controlBefore: snapshot(),
    controlAfter: snapshot(),
    cimBefore: snapshot(),
    cimAfter: snapshot()
  });
  assert.equal(result.findings.length, 0);
  assert.equal(result.control_exclusions.length, 0);
  assert.deepEqual(result.exclusion_policy, {
    locator_mode: 'exact-only',
    pattern_exclusions: false,
    blanket_transient_exclusions: false
  });
});

test('R34 differential permits only exact control-observed numeric churn', () => {
  const result = compareLifecycleDifferentials({
    controlBefore: snapshot({ records: [{ locator: 'options:recently_activated', value: [] }] }),
    controlAfter: snapshot({
      records: [{
        locator: 'options:recently_activated',
        value: { 'code-in-motion/code-in-motion.php': 1780000000 }
      }]
    }),
    cimBefore: snapshot({ records: [{ locator: 'options:recently_activated', value: [] }] }),
    cimAfter: snapshot({
      records: [{
        locator: 'options:recently_activated',
        value: { 'code-in-motion/code-in-motion.php': 1780000017 }
      }]
    })
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.control_exclusions.length, 1);
  assert.equal(
    result.control_exclusions[0].normalization.mode,
    'control-derived-numeric-paths'
  );
  assert.deepEqual(
    result.control_exclusions[0].normalization.numeric_value_paths,
    ['/code-in-motion~1code-in-motion.php']
  );
});

test('R34 differential flattens only control-observed timestamp buckets and still compares payloads', () => {
  const beforeControl = {
    '1780000000': {
      recovery_mode_clean_expired_keys: { interval: 86400, schedule: 'daily' }
    },
    '1780000001': {
      wp_update_plugins: { interval: 43200, schedule: 'twicedaily' }
    },
    version: 2
  };
  const afterControl = {
    ...beforeControl,
    '1780000004': {
      wp_delete_temp_updater_backups: { interval: 604800, schedule: 'weekly' }
    }
  };
  const beforeCim = {
    '1780000100': {
      recovery_mode_clean_expired_keys: { interval: 86400, schedule: 'daily' },
      wp_update_plugins: { interval: 43200, schedule: 'twicedaily' }
    },
    version: 2
  };
  const afterCim = {
    ...beforeCim,
    '1780000104': {
      wp_delete_temp_updater_backups: { interval: 604800, schedule: 'weekly' }
    }
  };

  const result = compareLifecycleDifferentials({
    controlBefore: snapshot({ records: [{ locator: 'options:cron', value: beforeControl }] }),
    controlAfter: snapshot({ records: [{ locator: 'options:cron', value: afterControl }] }),
    cimBefore: snapshot({ records: [{ locator: 'options:cron', value: beforeCim }] }),
    cimAfter: snapshot({ records: [{ locator: 'options:cron', value: afterCim }] })
  });

  assert.equal(result.findings.length, 0);
  assert.deepEqual(
    result.control_exclusions[0].normalization.numeric_key_parent_paths,
    ['/']
  );

  const badAfter = structuredClone(afterCim);
  badAfter['1780000104'].wp_delete_temp_updater_backups.interval = 604801;
  const bad = compareLifecycleDifferentials({
    controlBefore: snapshot({ records: [{ locator: 'options:cron', value: beforeControl }] }),
    controlAfter: snapshot({ records: [{ locator: 'options:cron', value: afterControl }] }),
    cimBefore: snapshot({ records: [{ locator: 'options:cron', value: beforeCim }] }),
    cimAfter: snapshot({ records: [{ locator: 'options:cron', value: badAfter }] })
  });
  assert.equal(bad.findings.length, 1);
  assert.equal(bad.findings[0].locator, 'options:cron');
});
test('R34 differential compares identical cron payloads as a multiset across timestamp order', () => {
  const controlBefore = { version: 2 };
  const controlAfter = {
    '1780000004': {
      wp_delete_temp_updater_backups: {
        schedule: 'weekly',
        args: [],
        interval: 604800
      }
    },
    '1780000008': {
      wp_update_plugins: {
        schedule: 'twicedaily',
        args: [],
        interval: 43200
      }
    },
    version: 2
  };
  const cimBefore = { version: 2 };
  const cimAfter = {
    '1780000104': {
      wp_update_plugins: {
        schedule: 'twicedaily',
        args: [],
        interval: 43200
      }
    },
    '1780000108': {
      wp_delete_temp_updater_backups: {
        schedule: 'weekly',
        args: [],
        interval: 604800
      }
    },
    version: 2
  };

  const result = compareLifecycleDifferentials({
    controlBefore: snapshot({ records: [{ locator: 'options:cron', value: controlBefore }] }),
    controlAfter: snapshot({ records: [{ locator: 'options:cron', value: controlAfter }] }),
    cimBefore: snapshot({ records: [{ locator: 'options:cron', value: cimBefore }] }),
    cimAfter: snapshot({ records: [{ locator: 'options:cron', value: cimAfter }] })
  });

  assert.equal(result.findings.length, 0);
  assert.equal(
    result.control_exclusions[0].normalization.mode,
    'control-derived-numeric-paths'
  );
});

test('R34 differential rejects an extra generic database write', () => {
  const result = compareLifecycleDifferentials({
    controlBefore: snapshot(),
    controlAfter: snapshot(),
    cimBefore: snapshot(),
    cimAfter: snapshot({
      records: [{ locator: 'options:some_library_state', value: 'persisted' }]
    })
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].locator, 'options:some_library_state');
});

test('R34 differential rejects an extra wp-content filesystem write', () => {
  const result = compareLifecycleDifferentials({
    controlBefore: snapshot(),
    controlAfter: snapshot(),
    cimBefore: snapshot(),
    cimAfter: snapshot({
      files: [{ path: 'uploads/library-cache.dat', sha256: 'a'.repeat(64) }]
    })
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].locator, 'uploads/library-cache.dat');
});

test('R34 differential requires active_plugins to return exactly to baseline', () => {
  const bad = snapshot();
  bad.database.records[0] = {
    locator: 'options:active_plugins',
    value: ['code-in-motion/code-in-motion.php']
  };

  assert.throws(
    () => compareLifecycleDifferentials({
      controlBefore: snapshot(),
      controlAfter: snapshot(),
      cimBefore: snapshot(),
      cimAfter: bad
    }),
    /active_plugins must return exactly to baseline/
  );
});
