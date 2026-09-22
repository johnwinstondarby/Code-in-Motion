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

## Stateful feature precondition

R34 must not create a persistent setting solely to exercise the gate.

Before Commit B, the proposed state must have a canonical CiM Host/runtime or product-policy owner.

If no canonical persistent seam is established, R34 closes or pauses after Commit A and ADR 0042 remains the prerequisite for the later stateful checkpoint.

## Negative-control evidence

Commit B must intentionally omit cleanup for the first real state write.

The lifecycle workflow is expected to fail.

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
22. Commit B does not include uninstall cleanup.
23. Commit B fails the live lifecycle differential.
24. Commit B's failure is retained as evidence.
25. Commit B remains reachable in branch history.
26. Commit C adds the required cleanup.
27. Commit C passes the same lifecycle differential.
28. No unrelated filesystem residue remains under `wp-content/`.
29. No unrelated database residue remains.
30. The final stateful feature has an explicit persistence namespace/schema.
31. The final stateful feature has migration semantics if needed.
32. The final stateful feature has uninstall semantics.
33. Existing R33 exact-ZIP lifecycle behavior remains covered.
34. Final exact-head protected gates pass before merge.
35. Integration uses a true merge commit into protected `main`.

## Stop conditions

Stop the stateful implementation if:

- Commit A is not green;
- an exclusion requires a prefix or pattern;
- a blanket transient exclusion appears necessary;
- the control plugin itself writes state;
- the filesystem comparison omits non-plugin `wp-content/` paths;
- the first setting has no canonical CiM policy owner;
- cleanup is bundled into the first state-write commit;
- the expected-red evidence is lost or rewritten from branch history.

## R33 relation

R33 remains accepted as the state-free 0.1.5 checkpoint.

R34 strengthens the proof before state ownership begins.
