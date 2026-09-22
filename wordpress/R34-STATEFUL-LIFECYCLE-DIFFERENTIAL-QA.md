# R34 Stateful Lifecycle Differential QA

## Scope

R34 begins from protected `main` at:

`7b48b182fe9da4e046998e70726b4633f6b3654b`

This QA record establishes the mandatory lifecycle-proof sequence for the first checkpoint that introduces persistent CiM WordPress state.

## Governing decision

R34 is governed by:

- `docs/adr/0042-stateful-wordpress-lifecycle-differential-gate.md`;
- this QA record.

ADR 0042 remains `Proposed for R34` until the differential gate is implemented and audited.

## Branch

`r34/stateful-lifecycle-differential`

## Core rule

Persistent CiM state may not be introduced until a broader live lifecycle differential has landed and passed independently.

The required sequence is:

1. **Commit A:** differential gate only, green;
2. **Commit B:** first persistent write without cleanup, expected red;
3. **Commit C:** uninstall cleanup, green.

Commit B is intentional negative-control evidence and must remain in history.

## Differential coverage

### Database

The live proof must compare baseline and post-uninstall values for:

- options;
- post metadata;
- user metadata;
- term metadata;
- comment metadata;
- custom table names.

The representation must include exact values or deterministic value hashes sufficient to detect mutation.

### Filesystem

The live proof must compare `wp-content/` recursively using exact relative paths and content hashes.

The plugin directory itself is excluded from the path differential and is checked separately for absence after uninstall.

No other directory-wide or pattern exclusion is permitted.

## Inert control

A generated inert plugin runs the same lifecycle in an isolated environment under the same WordPress/PHP/toolchain tuple.

The control plugin must use the same plugin basename inside its own environment so WordPress lifecycle behavior referring to the plugin basename is comparable.

The control plugin performs no persistence or filesystem writes.

## Exclusion contract

The control differential defines candidate WordPress-owned churn.

Acceptance requires:

- exact database locator or exact filesystem path only;
- no prefix exclusions;
- no suffix exclusions;
- no wildcard/glob exclusions;
- no regex exclusions;
- no transient-family exclusions;
- no metadata-family exclusions;
- one-line reason per excluded location;
- value-aware comparison at every excluded location.

A same-run generated reason such as `Observed in inert control lifecycle under the same WordPress/PHP/toolchain tuple` is acceptable.

## Value rules

Presence alone is insufficient.

At an exact control-observed key:

- if control returns to baseline, CiM must return to baseline;
- if control leaves a changed value, CiM may match only the equivalent narrowly normalized control delta.

`active_plugins` must equal baseline exactly after uninstall.

Any normalization must be locator-specific and documented.

## Filesystem rules

Any new or changed path beneath `wp-content/` after the CiM lifecycle is a finding unless the exact same path-level lifecycle change is control-proven.

Files written to `uploads/`, cache directories, or third-party directories remain in scope.

## First live differential finding

The first successfully executing R34 lifecycle-differential run was Browser E2E run `35669391174`, job `106562218695`, on branch head `b55e1feb8723132803cb8854e5fdb46df1394f78`.

Both lifecycle executions completed successfully. The comparison then reported exactly one finding:

`database:options:cron - CiM lifecycle delta is not value-equivalent to the exact inert-control delta.`

Inspection of all four retained snapshots established:

- control and CiM changed the same database locator set;
- each lifecycle produced five added locators, one changed locator, and zero removed locators;
- database table-name sets were identical across all four snapshots;
- filesystem snapshots contained 1,432 files and zero before/after changes in either lifecycle;
- the sole mismatch was `options:cron`;
- both cron deltas added the WordPress-owned `wp_delete_temp_updater_backups` weekly event with no arguments;
- the raw cron option differed only in absolute timestamp keys because the two isolated lifecycles ran at different wall-clock times;
- both control and CiM installed under the same basename, `code-in-motion/code-in-motion.php`, so WordPress plugin-identity bookkeeping did not require slug normalization.

The finding was classified as WordPress lifecycle timing churn rather than CiM persistence.

The comparator was made more precise rather than more permissive:

- normalization remains scoped to exact control-observed database locators and JSON paths;
- only control-observed timestamp-sized numeric values or keys normalize;
- timestamp buckets are flattened into their hook/payload entries and compared as a canonically sorted multiset;
- cron schedule names, intervals, arguments, and hook names remain under exact comparison;
- intervals such as `43200`, `86400`, and `604800` do not meet the timestamp threshold and therefore remain exact;
- a new hook, changed interval, changed arguments, or changed schedule remains a finding;
- identical cron payloads remain equivalent if their absolute timestamps or relative timestamp ordering differ between isolated runs.

The failed first comparison and its retained evidence are part of the R34 record because they demonstrate that the strengthened gate detected a real control/CiM difference and was corrected by increasing comparison precision rather than by adding an exclusion.

## Commit A green evidence

Commit A implementation head:

`ced5a2ce07bbf693262885c8dcef6fa4fc2b91eb`

This head contains the strengthened lifecycle differential and no persistent CiM state.

Exact-head workflow evidence:

- Verify CiM contracts run `35670705799`: PASS;
- WordPress Floor QA run `35670705897`: PASS;
- WordPress Browser E2E run `35670705842`: PASS;
- WordPress Playground PR Preview run `35670705906`: PASS;
- Node 20: 706/706 tests PASS;
- Node 22: 706/706 tests PASS;
- R34 lifecycle differential: PASS with 6 exact control-derived exclusions and 0 unexplained findings;
- exact 0.1.5 ZIP lifecycle: PASS;
- WordPress compatibility matrix: PASS;
- PHP 7.4 and 8.5: PASS;
- Chromium, Firefox, and WebKit: PASS.

Commit A lifecycle evidence artifact:

- artifact ID: `10671305089`;
- artifact name: `r34-lifecycle-differential`;
- artifact digest: `sha256:b9fc729b48d902912643df5f3d4e90520a558911df299a69836386ff56ed1a84`.

The control-derived exclusion set contains exactly six database locators:

1. `options:_site_transient_theme_roots` — exact control-equivalent value;
2. `options:_site_transient_timeout_theme_roots` — exact locator with control-derived timestamp-value normalization;
3. `options:_site_transient_update_core` — exact locator with control-derived `last_checked` timestamp normalization;
4. `options:_site_transient_update_themes` — exact locator with control-derived `last_checked` timestamp normalization;
5. `options:cron` — exact locator with control-derived timestamp-bucket normalization and canonical payload-multiset comparison;
6. `options:recently_activated` — exact locator with control-derived activation timestamp normalization for the common `code-in-motion/code-in-motion.php` basename.

No filesystem path and no database-table name required exclusion.

Commit A does not change release bytes. The R33 0.1.5 artifact identity remains:

- 66 staged files;
- 452,940 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `8bf7ed73e39789754ae029bc2c19dcd9eb9ba28c3a47ebe4232d54ebe6446e23`;
- R23 manifest SHA-256 `aba3ae9636b427533729a34dc8ada7600735c7ed435c01bb3fdfeba25d1c79d8`.

The next production state-writing commit must therefore be Commit B. It must introduce a canonical CiM persistent state write without uninstall cleanup and is expected to fail this live differential.

## Stateful feature precondition

R34 must not create a persistent setting solely to exercise the gate.

Before Commit B, the proposed state must have a canonical CiM Host/runtime or product-policy owner.

If no canonical persistent seam is established, R34 closes or pauses after Commit A and ADR 0042 remains the prerequisite for the later stateful checkpoint.

## Commit B prediction contract

Before Commit B is written, the stateful-feature decision record must name:

- the canonical product/Host policy represented by the state;
- the exact production persistence locator;
- the production file and persistence API that will write it;
- the expected value after activation/first use;
- the expected differential kind;
- the expected deactivation behavior;
- confirmation that the exact locator/path is absent from the current six-item inert-control exclusion set.

For an option-backed first state, the predicted red finding must use the production option name and should have this form:

`database:options:<exact-option-name> — kind: added — present only in CiM final delta`

The hostile unit test using `options:some_library_state` remains the proof that the comparator no longer relies on CiM naming. Production code must use the actual product option name.

If Commit B fails anywhere other than the predicted state locator, the failure is investigated before cleanup work begins.

## Deactivation and uninstall semantics

For an ordinary configuration option, the default R34 lifecycle contract is:

- deactivation preserves configuration;
- uninstall/delete removes configuration.

The lifecycle workflow must add a post-deactivation snapshot before delete.

Commit B must prove the new state exists after deactivation.

Commit C must prove the same state exists after deactivation and is absent after delete.

An option disappearing at deactivation is a failure unless the feature decision record explicitly defines deactivation cleanup semantics.

## Static guard transition

The current static scanner remains authoritative during the transition to state ownership.

Commit B may replace the blanket prohibition only with an exact allowlist for:

- one named production file;
- one approved persistence API;
- one exact option/locator where static analysis can verify it.

All other persistence APIs and call sites remain forbidden.

Commit C adds only the exact uninstall cleanup authorization required by the same state contract.

No broad removal of the R33 persistence guard is acceptable.

## Negative-control evidence

Commit B must intentionally omit cleanup for the first real state write.

The lifecycle workflow is expected to fail at the predeclared locator.

The QA record must capture:

- Commit B SHA;
- workflow run ID;
- failing job/step;
- exact differential finding;
- confirmation that the failure is caused by the newly introduced state.

Commit C then adds cleanup and must turn the same proof green.

## Acceptance gates

The first stateful checkpoint cannot close until all of the following are proven:

1. ADR 0042 is accepted and matches implementation.
2. Commit A is identifiable and predates all persistent CiM state.
3. Commit A changes no release persistence semantics.
4. Commit A live differential passes.
5. The inert control plugin contains no runtime behavior beyond its header.
6. Control and CiM lifecycle runs use the same WordPress version.
7. Control and CiM lifecycle runs use the same PHP version.
8. Control and CiM lifecycle runs use the same lifecycle commands.
9. Database snapshots include key values or deterministic value hashes.
10. Database scope includes options and standard metadata tables.
11. Custom table names are compared.
12. `wp-content/` is recursively compared.
13. The plugin directory is checked separately for post-delete absence.
14. Control-derived exclusions are exact names/paths only.
15. Every exclusion has a one-line reason.
16. No prefix/pattern/wildcard/regex exclusion exists.
17. No blanket transient-family exclusion exists.
18. Value-aware comparison is enforced.
19. `active_plugins` returns exactly to baseline.
20. Control-observed changed values require equivalent CiM deltas.
21. Commit B introduces the first canonical persistent CiM state.
22. The exact Commit B residue locator and differential kind are recorded before implementation.
23. The Commit B locator is absent from the inert-control exclusion set.
24. The production state name is chosen from product semantics rather than test convenience.
25. Commit B static verification authorizes only the exact approved write surface.
26. Commit B does not include uninstall cleanup.
27. Commit B post-deactivation snapshot proves uninstall-only state survives deactivation.
28. Commit B fails the live lifecycle differential at the predicted locator and kind.
29. A Commit B failure at any other locator is investigated separately.
30. Commit B's failure is retained as evidence.
31. Commit B remains reachable in branch history.
32. Commit C adds the required uninstall cleanup.
33. Commit C does not erase uninstall-only configuration at deactivation.
34. Commit C post-deactivation snapshot still contains the state.
35. Commit C final post-delete snapshot no longer contains the state.
36. Commit C passes the same lifecycle differential.
37. No unrelated filesystem residue remains under `wp-content/`.
38. No unrelated database residue remains.
39. The final stateful feature has an explicit persistence namespace/schema.
40. The final stateful feature has migration semantics if needed.
41. The final stateful feature has uninstall semantics.
42. Existing R33 exact-ZIP lifecycle behavior remains covered.
43. Final exact-head protected gates pass before merge.
44. Integration uses a true merge commit into protected `main`.

## Stop conditions

Stop the stateful implementation if:

- Commit A is not green;
- an exclusion requires a prefix or pattern;
- a blanket transient exclusion appears necessary;
- the control plugin itself writes state;
- the filesystem comparison omits non-plugin `wp-content/` paths;
- the first setting has no canonical CiM policy owner;
- the predicted Commit B locator/kind has not been written down before implementation;
- the static persistence guard is broadly disabled instead of surgically widened;
- uninstall-only state disappears at deactivation;
- cleanup is bundled into the first state-write commit;
- the expected-red evidence is lost or rewritten from branch history.

## R33 relation

R33 remains accepted as the state-free 0.1.5 checkpoint.

R34 strengthens the proof before state ownership begins.
