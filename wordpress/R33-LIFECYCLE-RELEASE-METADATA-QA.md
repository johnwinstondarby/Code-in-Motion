# R33 WordPress Lifecycle Hygiene and Release Metadata QA

## Scope

R33 begins from protected `main` at:

`13a7118c4a232bdb88c3ca7bd81585cfe440d467`

R33 asks:

> Can WordPress prove that the currently state-free CiM plugin leaves no persistent residue across its full lifecycle, while exposing canonical release metadata in the Admin Console without adding update, configuration, or Experience-semantic authority?

## Definition artifacts

R33 is governed by:

- `docs/adr/0041-wordpress-lifecycle-hygiene-and-release-metadata.md`;
- this QA record.

ADR 0041 is `Accepted for R33` after implementation audit.

## Branch and base

Branch:

`r33/wordpress-build-identity-support`

Protected-main base:

`13a7118c4a232bdb88c3ca7bd81585cfe440d467`

The branch name was created before scope review. R33's governing scope is the lifecycle/release-metadata contract in ADR 0041.

The final R33 head must merge through the active protected-`main` ruleset using a true merge commit.

## Why R33 follows R32

R31 and R32 established read-only inspection of:

- plugin/environment identity;
- Experience deployment inventory;
- renderer registration;
- static local artifact health.

Before CiM introduces persistent WordPress configuration, R33 pins the present state-free lifecycle and uninstall-cleanliness contract.

It also surfaces release metadata already owned by `readme.txt` and R22.

## R33 deliverables

### 1. Generated release-info projection

Add:

`wordpress/release/release-info.generated.json`

Schema:

`localis.cim/wordpress-release-info/v1`

Exact top-level keys:

- `schema`;
- `stable_tag`;
- `tested_up_to`;
- `current_release`;
- `support_uri`.

Exact `current_release` keys:

- `version`;
- `notes`.

### 2. Generation and freshness tooling

Add deterministic tooling that:

- reuses R22 readme parsing where appropriate;
- derives the current changelog entry from `readme.txt`;
- derives support URI from R22 canonical metadata;
- validates exact key sets and value shapes;
- writes the canonical JSON projection;
- fails verification when the committed projection is stale.

The checker must join `npm run verify`.

### 3. Release-builder integration

The release builder must verify release-info freshness before staging.

Stage:

`wordpress/release/release-info.generated.json`

at that exact stable path.

### 4. Supply-chain integration

R23 must approve exactly:

`wordpress/release/release-info.generated.json`

No `wordpress/release/**` wildcard is permitted.

### 5. Admin Console release information

Extend `wordpress/admin-console.php` with a defensive reader for the inert projection.

Display:

- Stable tag;
- Tested up to;
- Current release;
- Current release notes;
- Support link.

Malformed/unavailable projection data reports Unavailable.

### 6. State-free lifecycle proof

Add an isolated exact-ZIP lifecycle proof:

`install → activate → production shortcode/mount exercise → deactivate → uninstall/delete → residue inspection`

After uninstall, the isolated WordPress database must contain no CiM-attributable persistent option/transient/metadata rows or custom table.

The proof must use the release ZIP rather than the repository mount.

### 7. State-free static guard

Verification must prove the R33 production PHP does not introduce:

- activation hooks;
- deactivation hooks;
- uninstall hooks/file;
- Settings API registration;
- option/transient write APIs;
- database-table creation/mutation for persistent plugin state.

This guard describes R33 only. A later stateful checkpoint must replace it with explicit persistence/migration/uninstall contracts.

### 8. No custom update checker

Verification must prove R33 adds no update-transient filter, external latest-version request, or update installation action.

### 9. Release designation

R33 designates:

`0.1.5`

The real prior-release upgrade proof must resolve 0.1.4 as N and 0.1.5 as current.

## Pre-R33 release baseline

Frozen R32 artifact:

- 65 staged files;
- 449,348 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `8d7064bb23994afaf0b910a7c49269d184f7e6c7dfdcba07621be4a3a68f3e66`;
- R23 manifest SHA-256 `841e27c0621387e56a88f60594c8179931d49917a48a7ee4e142ab1a3c1fd301`.

These are historical comparison values, not R33 targets.

## Compatibility requirements

R33 must preserve:

- R30 Experience deployment registry authority;
- R31 deployment-mode invariant and authorization;
- R32 renderer registry and static-health contract;
- canonical shortcode markup;
- Runtime Experience ingestion;
- renderer resolution;
- front-end asset enqueue/versioning;
- deep-link grammar;
- multiple-instance isolation;
- root disposal;
- Transport bindings;
- WordPress 6.5 / PHP 7.4 floor;
- deterministic release packaging;
- exact-head protected-gate discipline.

## Acceptance gates

R33 closes only when all of the following are proven:

1. ADR 0041 is accepted and matches implementation.
2. `wordpress/release/release-info.generated.json` exists.
3. Release-info schema is `localis.cim/wordpress-release-info/v1`.
4. Release-info top-level key set is exact.
5. `current_release` key set is exactly `version`, `notes`.
6. Stable tag derives from `readme.txt`.
7. Tested-up-to derives from `readme.txt`.
8. Current release version derives from the current changelog heading.
9. Current release notes derive from that changelog entry.
10. Support URI derives from R22 canonical metadata.
11. Projection generation is deterministic.
12. Committed projection freshness is gated.
13. Direct release build fails on stale release-info projection.
14. Admin Console reads the inert projection defensively.
15. Admin Console does not parse `readme.txt`.
16. Malformed/unavailable projection fails closed.
17. Dynamic release text is HTML escaped.
18. Support URI is emitted through `esc_url()`.
19. R33 production PHP contains no Settings API registration.
20. R33 production PHP contains no option/transient persistence write.
21. R33 adds no custom persistent database table.
22. R33 adds no activation hook.
23. R33 adds no deactivation hook.
24. R33 adds no uninstall hook or `uninstall.php`.
25. Exact 0.1.5 release ZIP installs successfully.
26. Installed plugin activates successfully.
27. Production shortcode/mount path is exercised while active.
28. Installed plugin deactivates successfully.
29. Installed plugin uninstalls/deletes successfully.
30. Post-uninstall database inspection finds no CiM-attributable option/transient/metadata residue.
31. Post-uninstall database inspection finds no CiM-attributable custom table.
32. R33 adds no custom update-transient hook.
33. R33 adds no outbound latest-version/update request.
34. Existing Experience inventory remains unchanged.
35. Existing renderer inventory remains unchanged.
36. Existing static-health behavior remains green.
37. Generated release-info is staged at its exact stable path.
38. R23 approves that exact path without a directory wildcard.
39. Plugin/release metadata is internally consistent at 0.1.5.
40. The 0.1.5 ZIP is deterministic and reproducible.
41. Real warm-cache upgrade from 0.1.4 to 0.1.5 passes.
42. Plugin Check passes.
43. WordPress 6.5.10 through the current tested matrix remain green.
44. PHP 7.4 and PHP 8.5 remain green.
45. Chromium, Firefox, and WebKit remain green.
46. Node 20 verification passes.
47. Node 22 verification passes.
48. `CiM / Verify` passes on the frozen R33 head.
49. `CiM / Floor QA` passes on the frozen R33 head.
50. `CiM / Browser E2E` passes on the frozen R33 head.
51. `CiM / Playground` passes on the frozen R33 head.
52. Final 0.1.5 file count, staged bytes, module/import counts, ZIP SHA-256, and R23 manifest SHA-256 are recorded.
53. PR integration uses a true merge commit into protected `main`.
54. The frozen R33 implementation head is confirmed reachable from `main`.
55. Final closure evidence is recorded on the R33 PR.

## Stop conditions

R33 stops for review if implementation:

- introduces mutable WordPress state;
- adds a settings/configuration policy without an established Host seam;
- adds a custom update source or outbound update request;
- adds lifecycle hooks with no state ownership reason;
- parses Runtime Experience semantics in PHP;
- introduces a second invocation grammar;
- adds a block-editor integration;
- changes shortcode grammar;
- changes front-end Host/Runtime ownership;
- changes the WordPress/PHP support floor;
- produces unexplained release-tree movement.

## Boundary

R33 establishes:

`state-free lifecycle proof + canonical release metadata → read-only WordPress lifecycle/support visibility`

R33 does not establish:

`WordPress administration → persistent configuration or external update authority`


## Implementation audit

Accepted implementation head:

`ca8a1fa9eee2e82832d704ca2dbe1d56c0def6a1`

The implementation audit confirms:

- R33 production PHP remains state-free;
- no activation, deactivation, or uninstall hook was introduced;
- no `uninstall.php` was introduced;
- no Settings API registration, option/transient persistence write, or direct `$wpdb` persistence mutation was introduced;
- no custom update-transient hook or outbound latest-version/update request was introduced;
- `wordpress/release/release-info.generated.json` is the sole installed management projection for R33 release metadata;
- the projection is generated from canonical readme/R22 metadata and freshness-gated;
- a direct release build validates release-info freshness before staging;
- the projection key sets are exact and the current release notes derive only from the current changelog entry;
- the support URI derives from `R22_METADATA.supportUri`;
- PHP does not parse `readme.txt`;
- the Admin Console defensively reads the projection and fails closed when unusable;
- dynamic release metadata is HTML escaped and the support URI is emitted through `esc_url()`;
- R23 approves exactly `wordpress/release/release-info.generated.json` with no release-directory wildcard;
- repository-source Floor QA proves the release information is available and matches 0.1.5 / Tested up to 7.1;
- the exact 0.1.5 ZIP install proves the installed release-info projection is available and current;
- the exact-ZIP lifecycle proof captures CiM-attributable persistence before install, activates CiM, exercises the production browser mount path, deactivates and deletes the plugin, then requires the post-uninstall snapshot to match the pre-install snapshot;
- the lifecycle proof also requires the installed plugin directory to be absent after deletion;
- the state-free lifecycle residue proof passes;
- the real prior-release upgrade proof resolves 0.1.4 as N and 0.1.5 as current;
- R31 Experience inventory, R32 renderer inventory, and R32 static-health behavior remain green.

No ADR 0041 correction is required after implementation audit.

## Accepted 0.1.5 artifact identity

The accepted implementation build establishes:

- 66 staged files;
- 452,940 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `8bf7ed73e39789754ae029bc2c19dcd9eb9ba28c3a47ebe4232d54ebe6446e23`;
- R23 manifest SHA-256 `aba3ae9636b427533729a34dc8ada7600735c7ed435c01bb3fdfeba25d1c79d8`.

Relative to the frozen 0.1.4 baseline, the final R33 release adds exactly one staged file:

- `wordpress/release/release-info.generated.json`.

The JavaScript module graph remains unchanged at 36 modules / 54 import edges.

## Implementation-head verification

On `ca8a1fa9eee2e82832d704ca2dbe1d56c0def6a1`:

- Node 20: 699/699 PASS;
- Node 22: 699/699 PASS;
- R33 release-info generation/freshness: PASS;
- WordPress packaging state-free/update guards: PASS;
- release-tree contract: 36 modules / 54 import edges under `modules/0.1.5`;
- release build: PASS;
- release reproducibility: PASS;
- fresh 0.1.5 ZIP install: PASS;
- installed release-info projection: PASS;
- production browser mount against exact ZIP: PASS;
- R33 deactivate/delete lifecycle: PASS;
- R33 zero CiM-attributable persistence residue: PASS;
- real warm-cache 0.1.4 to 0.1.5 upgrade: PASS;
- Plugin Check: PASS;
- WordPress 6.5.10 through 7.1.1: PASS;
- PHP 7.4 and PHP 8.5: PASS;
- Chromium, Firefox, and WebKit: PASS;
- `CiM / Verify`: PASS;
- `CiM / Floor QA`: PASS;
- `CiM / Browser E2E`: PASS;
- `CiM / Playground`: PASS.

The ADR/QA acceptance update that records this audit is documentation-only and does not alter the 0.1.5 release artifact identity.
