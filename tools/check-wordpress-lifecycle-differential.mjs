import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SNAPSHOT_SCHEMA = 'localis.cim/r34-lifecycle-snapshot/v1';
const EVIDENCE_SCHEMA = 'localis.cim/r34-lifecycle-differential/v1';
const CONTROL_REASON =
  'Observed in the inert control lifecycle under the same WordPress/PHP/toolchain tuple.';

function fail(message) {
  throw new Error('R34 lifecycle differential: ' + message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

function equal(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function isDynamicNumber(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Math.abs(value) >= 100000000
  ) || (
    typeof value === 'string' &&
    /^\d{9,}$/.test(value)
  );
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function collectNormalization(value, path = '') {
  const numericValuePaths = [];
  const numericKeyParents = [];

  function visit(current, currentPath) {
    if (isDynamicNumber(current)) {
      numericValuePaths.push(currentPath || '/');
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, currentPath + '/' + index));
      return;
    }

    if (current && typeof current === 'object') {
      const keys = Object.keys(current);
      if (keys.some((key) => /^\d{9,}$/.test(key))) {
        numericKeyParents.push(currentPath || '/');
      }
      for (const key of keys) {
        visit(current[key], currentPath + '/' + escapePointer(key));
      }
    }
  }

  visit(value, path);
  return {
    numeric_value_paths: [...new Set(numericValuePaths)].sort(),
    numeric_key_parent_paths: [...new Set(numericKeyParents)].sort()
  };
}

function mergeNormalization(...specs) {
  return {
    numeric_value_paths: [...new Set(specs.flatMap((spec) => spec.numeric_value_paths))].sort(),
    numeric_key_parent_paths: [...new Set(specs.flatMap((spec) => spec.numeric_key_parent_paths))].sort()
  };
}

function normalizeWithSpec(value, spec, path = '') {
  const pointer = path || '/';
  if (spec.numeric_value_paths.includes(pointer) && isDynamicNumber(value)) {
    return '<control-derived-number>';
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      normalizeWithSpec(item, spec, path + '/' + index)
    );
  }

  if (value && typeof value === 'object') {
    const normalizeNumericKeys = spec.numeric_key_parent_paths.includes(pointer);
    const entries = Object.entries(value).map(([key, item]) => {
      const normalizedKey =
        normalizeNumericKeys && /^\d{9,}$/.test(key)
          ? '<control-derived-number-key>'
          : key;
      const childPath = path + '/' + escapePointer(normalizedKey);
      return [
        normalizedKey,
        normalizeWithSpec(item, spec, childPath)
      ];
    });

    entries.sort(([a], [b]) => a.localeCompare(b));

    const result = {};
    for (const [key, item] of entries) {
      if (Object.hasOwn(result, key)) {
        const existing = Array.isArray(result[key]) ? result[key] : [result[key]];
        existing.push(item);
        result[key] = existing;
      } else {
        result[key] = item;
      }
    }
    return result;
  }

  return value;
}

function normalizationForChange(change) {
  return mergeNormalization(
    collectNormalization(change.before),
    collectNormalization(change.after)
  );
}

function compareChange(control, candidate) {
  if (control.kind !== candidate.kind) return { ok: false, normalization: null };

  if (equal(control.before, candidate.before) && equal(control.after, candidate.after)) {
    return {
      ok: true,
      normalization: {
        mode: 'exact',
        numeric_value_paths: [],
        numeric_key_parent_paths: []
      }
    };
  }

  const spec = normalizationForChange(control);
  const hasNormalization =
    spec.numeric_value_paths.length > 0 ||
    spec.numeric_key_parent_paths.length > 0;

  if (!hasNormalization) return { ok: false, normalization: null };

  const beforeMatches = equal(
    normalizeWithSpec(control.before, spec),
    normalizeWithSpec(candidate.before, spec)
  );
  const afterMatches = equal(
    normalizeWithSpec(control.after, spec),
    normalizeWithSpec(candidate.after, spec)
  );

  return {
    ok: beforeMatches && afterMatches,
    normalization: beforeMatches && afterMatches
      ? { mode: 'control-derived-numeric-paths', ...spec }
      : null
  };
}

function assertSnapshot(snapshot, label) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    fail(label + ' must be an object.');
  }
  if (snapshot.schema !== SNAPSHOT_SCHEMA) {
    fail(label + ' schema must be ' + SNAPSHOT_SCHEMA + '.');
  }
  if (!snapshot.database || !Array.isArray(snapshot.database.records) ||
      !Array.isArray(snapshot.database.tables) || !Array.isArray(snapshot.filesystem)) {
    fail(label + ' has an invalid snapshot shape.');
  }

  const recordLocators = new Set();
  for (const record of snapshot.database.records) {
    if (!record || typeof record.locator !== 'string' || record.locator.length === 0) {
      fail(label + ' contains an invalid database locator.');
    }
    if (recordLocators.has(record.locator)) fail(label + ' duplicates locator ' + record.locator + '.');
    recordLocators.add(record.locator);
  }

  const filePaths = new Set();
  for (const file of snapshot.filesystem) {
    if (!file || typeof file.path !== 'string' || typeof file.sha256 !== 'string') {
      fail(label + ' contains an invalid filesystem entry.');
    }
    if (file.path === 'plugins/code-in-motion' || file.path.startsWith('plugins/code-in-motion/')) {
      fail(label + ' must exclude the plugin directory from the filesystem snapshot.');
    }
    if (filePaths.has(file.path)) fail(label + ' duplicates filesystem path ' + file.path + '.');
    filePaths.add(file.path);
  }
}

function mapRecords(records, key) {
  return new Map(records.map((entry) => [entry[key], entry]));
}

function deltaMap(beforeMap, afterMap, valueField) {
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  const changes = new Map();

  for (const key of keys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    if (before === undefined) {
      changes.set(key, { kind: 'added', before: null, after: after[valueField] });
    } else if (after === undefined) {
      changes.set(key, { kind: 'removed', before: before[valueField], after: null });
    } else if (!equal(before[valueField], after[valueField])) {
      changes.set(key, {
        kind: 'changed',
        before: before[valueField],
        after: after[valueField]
      });
    }
  }

  return changes;
}

function tableDelta(beforeTables, afterTables) {
  const before = new Set(beforeTables);
  const after = new Set(afterTables);
  const names = [...new Set([...before, ...after])].sort();
  const changes = new Map();
  for (const name of names) {
    if (!before.has(name)) changes.set(name, { kind: 'added', before: false, after: true });
    else if (!after.has(name)) changes.set(name, { kind: 'removed', before: true, after: false });
  }
  return changes;
}

function requireActivePluginsBaseline(snapshotBefore, snapshotAfter, label) {
  const before = mapRecords(snapshotBefore.database.records, 'locator').get('options:active_plugins');
  const after = mapRecords(snapshotAfter.database.records, 'locator').get('options:active_plugins');
  if (!before || !after || !equal(before.value, after.value)) {
    fail(label + ' active_plugins must return exactly to baseline after uninstall.');
  }
}

export function compareLifecycleDifferentials({
  controlBefore,
  controlAfter,
  cimBefore,
  cimAfter
}) {
  for (const [label, snapshot] of Object.entries({
    controlBefore,
    controlAfter,
    cimBefore,
    cimAfter
  })) {
    assertSnapshot(snapshot, label);
  }

  requireActivePluginsBaseline(controlBefore, controlAfter, 'control');
  requireActivePluginsBaseline(cimBefore, cimAfter, 'CiM');

  const scopes = [
    {
      scope: 'database',
      control: deltaMap(
        mapRecords(controlBefore.database.records, 'locator'),
        mapRecords(controlAfter.database.records, 'locator'),
        'value'
      ),
      candidate: deltaMap(
        mapRecords(cimBefore.database.records, 'locator'),
        mapRecords(cimAfter.database.records, 'locator'),
        'value'
      )
    },
    {
      scope: 'table',
      control: tableDelta(controlBefore.database.tables, controlAfter.database.tables),
      candidate: tableDelta(cimBefore.database.tables, cimAfter.database.tables)
    },
    {
      scope: 'filesystem',
      control: deltaMap(
        mapRecords(controlBefore.filesystem, 'path'),
        mapRecords(controlAfter.filesystem, 'path'),
        'sha256'
      ),
      candidate: deltaMap(
        mapRecords(cimBefore.filesystem, 'path'),
        mapRecords(cimAfter.filesystem, 'path'),
        'sha256'
      )
    }
  ];

  const exclusions = [];
  const findings = [];

  for (const { scope, control, candidate } of scopes) {
    for (const [locator, controlChange] of control) {
      exclusions.push({
        scope,
        locator,
        reason: CONTROL_REASON,
        control_change: controlChange,
        normalization: {
          mode: 'unused-by-cim',
          numeric_value_paths: [],
          numeric_key_parent_paths: []
        }
      });
    }

    for (const [locator, candidateChange] of candidate) {
      const controlChange = control.get(locator);
      if (!controlChange) {
        findings.push({
          scope,
          locator,
          reason: 'CiM lifecycle changed a location absent from the inert-control differential.',
          cim_change: candidateChange
        });
        continue;
      }

      const comparison = compareChange(controlChange, candidateChange);
      if (!comparison.ok) {
        findings.push({
          scope,
          locator,
          reason: 'CiM lifecycle delta is not value-equivalent to the exact inert-control delta.',
          control_change: controlChange,
          cim_change: candidateChange
        });
        continue;
      }

      const exclusion = exclusions.find(
        (entry) => entry.scope === scope && entry.locator === locator
      );
      exclusion.normalization = comparison.normalization;
    }
  }

  exclusions.sort((a, b) =>
    (a.scope + '\0' + a.locator).localeCompare(b.scope + '\0' + b.locator)
  );
  findings.sort((a, b) =>
    (a.scope + '\0' + a.locator).localeCompare(b.scope + '\0' + b.locator)
  );

  return {
    schema: EVIDENCE_SCHEMA,
    exclusion_policy: {
      locator_mode: 'exact-only',
      pattern_exclusions: false,
      blanket_transient_exclusions: false
    },
    control_exclusions: exclusions,
    findings,
    summary: {
      control_exclusions: exclusions.length,
      findings: findings.length
    }
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || value === undefined) fail('invalid CLI arguments.');
    result[flag.slice(2)] = value;
  }
  for (const required of [
    'control-before',
    'control-after',
    'cim-before',
    'cim-after',
    'evidence'
  ]) {
    if (!result[required]) fail('missing --' + required + '.');
  }
  return result;
}

export async function runLifecycleDifferential(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const evidence = compareLifecycleDifferentials({
    controlBefore: await readJson(options['control-before']),
    controlAfter: await readJson(options['control-after']),
    cimBefore: await readJson(options['cim-before']),
    cimAfter: await readJson(options['cim-after'])
  });

  await writeFile(
    resolve(options.evidence),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8'
  );

  if (evidence.findings.length > 0) {
    for (const finding of evidence.findings) {
      console.error(
        'R34 FINDING: ' + finding.scope + ':' + finding.locator + ' - ' + finding.reason
      );
    }
    fail(evidence.findings.length + ' unexplained lifecycle differential finding(s).');
  }

  console.log(
    'PASS: R34 lifecycle differential (' +
    evidence.control_exclusions.length +
    ' exact control-derived exclusion(s), 0 unexplained finding(s)).'
  );
  return evidence;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runLifecycleDifferential().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
