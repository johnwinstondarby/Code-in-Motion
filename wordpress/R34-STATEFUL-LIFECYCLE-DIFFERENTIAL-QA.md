# R34 Stateful Lifecycle Differential QA

## Scope

R34 begins from protected `main` at:

`7b48b182fe9da4e046998e70726b4633f6b3654b`

This QA record establishes the mandatory lifecycle-proof sequence for the first checkpoint that introduces persistent CiM WordPress state.

## Governing decision

R34 is governed by:

- `docs/adr/0042-stateful-wordpress-lifecycle-differential-gate.md`;
- this QA record.

ADR 0042 is `Accepted for R34` after the completed A→B→C lifecycle audit.

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

## Commit B selected state contract

ADR 0043 selects the first canonical persistent CiM state:

`localis_cim_motion_policy`

Policy values:

- `system`;
- `reduce`.

Effective Host rule:

`browserReducedMotion || siteMotionPolicy === "reduce"`

The setting cannot force motion against a learner's browser preference.

Commit B prediction, recorded before the production state write:

- scope: `database`;
- locator: `options:localis_cim_motion_policy`;
- differential kind: `added`;
- exercised value: `reduce`;
- expected after deactivation: still present with value `reduce`;
- expected after delete in Commit B: still present because cleanup is deliberately absent;
- control exclusion check: the locator is not one of Commit A's six exact control-derived exclusions.

Approved Commit B persistence surface:

- file: `wordpress/admin-console.php`;
- API: `update_option()`;
- exact option: `localis_cim_motion_policy`;
- no activation-time initialization;
- no other persistent write API.

A failure at another locator or with another differential kind must be investigated and does not count as the expected-red proof.

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

## Commit B expected-red evidence

The first production state-write commit is:

`3db9adc02e6b622f11ca08505a20e1149e46e403`

Commit message:

`R34: add persistent motion policy without cleanup`

That commit introduced:

- release version `0.1.6`;
- canonical option `localis_cim_motion_policy`;
- allowed values `system` and `reduce`;
- one approved non-autoloaded `update_option()` call in `wordpress/admin-console.php`;
- authenticated Admin Console mutation through `manage_options`, nonce verification, and `admin-post.php`;
- no activation-time initialization;
- no `delete_option()`;
- no uninstall hook or `uninstall.php`;
- post-deactivation lifecycle snapshots.

The first exact-head run exposed one unrelated Plugin Check REVIEW finding for input sanitization syntax. It did not change the lifecycle result. The correction landed as:

`994ff50d133daa782024849f7867375a1c8188de`

Commit message:

`R34: sanitize motion policy input at source`

The correction changed only the input-sanitization expression and its static test. It did not change the option name, stored value, persistence API, deactivation semantics, or absence of uninstall cleanup.

The corrected Commit B negative-control checkpoint is therefore:

`994ff50d133daa782024849f7867375a1c8188de`

Exact-head workflow evidence on that checkpoint:

- Verify CiM contracts run `35675261155`: PASS;
- WordPress Floor QA run `35675261108`: PASS;
- WordPress Playground PR Preview run `35675261109`: PASS;
- WordPress Browser E2E run `35675261116`: FAIL only because the required R34 lifecycle differential failed;
- Node 20: 707/707 tests PASS;
- Node 22: 707/707 tests PASS;
- Plugin Check 2.1.0: 0 FAIL, 0 REVIEW, 2 accepted enqueue-scope exceptions;
- WordPress compatibility matrix: PASS;
- PHP 7.4 and 8.5: PASS;
- Chromium, Firefox, and WebKit: PASS;
- fresh ZIP install and real upgrade path: PASS.

The R34 lifecycle-differential job is `106580341013`.

Its retained evidence artifact is:

- artifact ID: `10672788211`;
- artifact name: `r34-lifecycle-differential`;
- artifact digest: `sha256:aac363faa93d52b321bddbdfdd0c8945553d755e9a39d82ee590f4ab4a8104dd`.

The differential contains exactly one unexplained finding:

```text
scope: database
locator: options:localis_cim_motion_policy
kind: added
before: null
after: reduce
```

The finding exactly matches the prediction recorded before Commit B implementation.

The post-deactivation CiM snapshot contains:

```text
options:localis_cim_motion_policy = reduce
```

The final post-delete Commit B snapshot also contains:

```text
options:localis_cim_motion_policy = reduce
```

The inert control before, post-deactivation, and post-delete snapshots contain no locator matching `localis_cim_motion_policy`.

This proves all three intended Commit B facts:

1. production state is created through the approved CiM write surface;
2. deactivation preserves the configuration;
3. omission of uninstall cleanup is detected by the broad lifecycle differential at the predeclared exact locator.

No filesystem finding or additional database finding accompanied the expected residue.

The corrected Commit B `0.1.6` artifact identity is:

- 66 staged files;
- 456,633 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `b59a7fb1f4c1ca13678df9f5617cfee6150ddac8ad72311880b95a2e0da55c0d`;
- R23 manifest SHA-256 `ed969c83b01178eacf73baebdc3c6ae2638a9fd7370dcbed8c123013bd385e6e`.

Commit B is intentionally non-mergeable evidence. Commit C must add uninstall-only cleanup for the exact option, preserve the post-deactivation `reduce` value, remove the option during delete/uninstall, and return the same broad differential and terminal Browser gate to green.

## Commit C green evidence

The uninstall-only cleanup implementation landed at:

`c540cd631aebcc951cdf1f7c8021ff116d98a224`

Commit message:

`R34: add uninstall-only motion policy cleanup`

That commit added the root production cleanup surface:

`uninstall.php`

with exactly one state deletion:

`delete_option( 'localis_cim_motion_policy' )`

and extended the release builder, R23 exact-path supply-chain approval, static persistence scanner, and lifecycle proof accordingly.

The lifecycle workflow was then corrected at:

`71435661b543c7f25be85c54f416698275bbbf62`

Commit message:

`R34: execute real WordPress uninstall lifecycle`

The control and CiM paths now both use WordPress's real:

`wp plugin uninstall code-in-motion`

command rather than deleting plugin files directly. This ensures the accepted proof actually executes `uninstall.php`.

The stored motion policy was then connected to Host composition at:

`252934157fe67883d2f002741424256b9cde9875`

Commit message:

`R34: project motion policy into Host reduced motion`

The final policy projection is:

`WordPress option → script data attribute → external bootstrap query → Host motion-policy matchMedia facade`

with effective semantics:

`browserReducedMotion || siteMotionPolicy === "reduce"`

The existing `createWordPressLiveHost()` option key set remains unchanged.

A follow-up contract-preservation commit:

`74475e7c8e3fdfabd00197fb2ed6e3b7ac91d7b2`

kept the live Host public option surface exact while retaining the motion-policy composition.

The final test-only correction:

`88cc0cbf1024643c8dfa00d84ec2cc926eea8325`

aligned the forced-reduced-motion disposal test with the implementation invariant that forced mode never subscribes to native `matchMedia`; therefore there is no native listener to remove.

### Exact-head final evidence

Final implementation head:

`88cc0cbf1024643c8dfa00d84ec2cc926eea8325`

Protected workflow evidence:

- Verify CiM contracts run `35690521735`: PASS;
- WordPress Floor QA run `35690521949`: PASS;
- WordPress Browser E2E run `35690521750`: PASS;
- WordPress Playground PR Preview run `35690521713`: PASS;
- Node 20: 710/710 PASS;
- Node 22: 710/710 PASS;
- WordPress 6.5.10 through 7.1.1: PASS;
- PHP 7.4 and 8.5: PASS;
- Chromium, Firefox, and WebKit: PASS;
- Plugin Check: PASS;
- real 0.1.5 → 0.1.6 upgrade path: PASS.

R34 lifecycle differential job:

`106626344223`

Result:

`PASS: R34 lifecycle differential (6 exact control-derived exclusion(s), 0 unexplained finding(s)).`

Retained lifecycle evidence artifact:

- artifact ID: `10678159481`;
- artifact name: `r34-lifecycle-differential`;
- artifact digest: `sha256:b107fb735fc725e95d8fd58319a992aca89565297f0b6b6107b2ff671d631de7`.

The live lifecycle proves:

1. `localis_cim_motion_policy = reduce` is created through the production write surface;
2. the value remains `reduce` after plugin deactivation;
3. WordPress executes the plugin's real uninstall surface;
4. the option is absent after uninstall;
5. the plugin directory is absent after uninstall;
6. the broad database/table/filesystem differential returns to zero unexplained findings.

No additional filesystem or database residue is present.

### Final 0.1.6 artifact identity

- 67 staged files;
- 458,920 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `e3671ceb74224577d10b4613631bd4c6010b18eee09e3144df0251c8b9ff3f0f`;
- R23 manifest SHA-256 `c0bd1ee1d3341052384f831b253cc03d16b4a1123dc4c2ca67de7e7a9635dc9e`.

The extra staged file relative to Commit B is the exact root cleanup surface:

`uninstall.php`

ADR 0042 and ADR 0043 are accepted for R34.

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
