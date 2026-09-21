# R31 WordPress Admin Console Inventory QA

## Scope

R31 establishes the first read-only WordPress management surface for Code in Motion.

R31 begins from protected `main` at:

`8d353602f3c4a4404ec6be9feb3f3e7a8bc768ea`

R31 asks one question:

> Can WordPress expose a read-only Admin Console that reports authoritative plugin/environment identity and R30 Experience deployment inventory without creating a second Runtime, registry, or renderer authority?

## Why R31 follows R30

R30 established:

`validated Experience asset → canonical deployment registry → WordPress loader/release packaging`

Issue #6 still requires a WordPress administration surface for inspection and troubleshooting.

R31 uses the new registry as the first management input while keeping all mutation and semantic validation out of scope.

## Definition artifacts

R31 is governed by:

- `docs/adr/0039-wordpress-read-only-admin-console-inventory.md`;
- this QA record.

ADR 0039 remains `Proposed for R31` until implementation audit is complete.

## Branch and base

Branch:

`r31/wordpress-admin-inventory`

Protected-main base:

`8d353602f3c4a4404ec6be9feb3f3e7a8bc768ea`

The final R31 head must merge through the active protected-`main` ruleset using a true merge commit.

## R31 deliverables

### 1. Dedicated administration module

Add:

`wordpress/admin-console.php`

and load it from the existing WordPress implementation entry.

The module owns only WordPress administration inventory/status presentation.

### 2. Top-level Admin Console

Register:

- menu/page title: `Code in Motion`;
- menu label: `Code in Motion`;
- slug: `code-in-motion`;
- capability: `manage_options`.

The render callback must repeat the capability check.

### 3. Read-only identity panel

Display:

- CiM plugin version;
- current WordPress version;
- current PHP version;
- declared WordPress support floor;
- declared PHP support floor;
- registry schema;
- registered Experience count.

Plugin support-floor values must derive from the root plugin header.

### 4. Registry-backed Experience inventory

Read the stable canonical registry and display one row per entry:

- Experience ID;
- asset name;
- deployment-presence status;
- inert shortcode reference.

No directory scan may add inventory entries.

### 5. Defensive registry boundary

The PHP reader must fail closed on unreadable, undecodable, structurally unusable, or path-unsafe registry data.

It must not perform Runtime semantic validation or parse Experience state.

### 6. Deployment-presence status

Resolve each safe asset name beneath the version-bearing installed Experience directory.

Presence means file existence/readability only.

The status must not claim Runtime validity, renderer validity, or successful mountability.

### 7. Release integration

Stage `wordpress/admin-console.php` in the release artifact and extend independent supply-chain approval to that exact production PHP path.

R31 designates WordPress version:

`0.1.3`

The real prior-release upgrade proof must resolve 0.1.2 as N and 0.1.3 as current.

## Pre-R31 release baseline

The frozen pre-R31 artifact is 0.1.2:

- 62 staged files;
- 433,707 staged bytes;
- 35 modules;
- 53 import edges;
- ZIP SHA-256: `8988e2e4195456640bcf87f72a127a0db06aaef8cd772e950d2b462351938b19`;
- R23 manifest SHA-256: `3cfcaf018d4b9f642b72974c19b7b02ad31f582df0900f01a204ca35c02e7055`.

Those values are historical comparison evidence, not the R31 target identity.

## Explicit non-goals

R31 does not implement:

- mutable configuration;
- option storage or schema migration;
- update discovery/channel/action;
- renderer inventory or health;
- Runtime validation in PHP;
- full diagnostics/fault history;
- cache controls;
- Experience upload/delete;
- `.cim` upload/compile;
- registry mutation;
- automatic discovery;
- remote registries;
- block editor integration;
- REST/AJAX management;
- administration JavaScript application;
- activation/deactivation redesign;
- uninstall changes.

## Compatibility requirements

R31 must preserve:

- R30 registry authority and exact-set rules;
- existing Runtime Experience ingestion;
- `createWordPressExperienceLoader()`;
- renderer resolution;
- canonical shortcode markup;
- front-end asset enqueueing;
- root mounting/fallback;
- deep-link grammar;
- multiple-instance isolation;
- root disposal;
- Transport bindings;
- WordPress 6.5 / PHP 7.4 floor;
- deterministic release packaging;
- real prior-to-current upgrade testing.

## R31 acceptance gates

R31 closes only when all of the following are proven:

1. ADR 0039 is accepted and matches implementation.
2. `wordpress/admin-console.php` is the dedicated administration module.
3. A top-level `Code in Motion` Admin Console is registered.
4. The exact page slug is `code-in-motion`.
5. The exact capability is `manage_options`.
6. The render callback repeats the authorization check and fails closed for unauthorized access.
7. The R31 console exposes no write action, settings form, registry mutation, REST mutation, or AJAX mutation.
8. Plugin version derives from `LOCALIS_CIM_PLUGIN_VERSION`.
9. Current WordPress and PHP versions derive from their runtime authorities.
10. Declared WordPress/PHP support floors derive from the root plugin header.
11. Registry schema and Experience count derive from `wordpress/experiences/registry.json`.
12. Inventory membership derives only from the canonical registry.
13. Unsafe asset names cannot escape the plugin directory.
14. Registry-read failure produces an explicit unavailable state rather than partial inventory.
15. PHP does not add a Runtime Experience semantic validator.
16. PHP does not parse or interpret Runtime Experience state or renderer configuration.
17. Each safe inventory row displays ID, asset name, deployment-presence status, and inert shortcode reference.
18. The installed 0.1.3 release ZIP reports both current registered Experience assets present.
19. Admin Console markup contains no executable CiM engine/Host/Runtime/renderer/Transport/Commentary/bootstrap source.
20. Existing front-end shortcode and browser behavior remain unchanged.
21. `wordpress/admin-console.php` is staged by the deterministic release builder and approved by the independent supply-chain gate.
22. Plugin/release metadata is internally consistent at 0.1.3.
23. The 0.1.3 ZIP is deterministic and reproducible under the pinned release Node version.
24. Fresh install from the 0.1.3 ZIP passes.
25. Real warm-cache upgrade from 0.1.2 to 0.1.3 passes.
26. Node 20 verification passes.
27. Node 22 verification passes.
28. `CiM / Verify` passes on the frozen R31 head.
29. `CiM / Floor QA` passes on the frozen R31 head.
30. `CiM / Browser E2E` passes on the frozen R31 head.
31. `CiM / Playground` passes on the frozen R31 head.
32. Final 0.1.3 file count, staged bytes, module/import counts, ZIP SHA-256, and R23 manifest SHA-256 are recorded.
33. PR integration uses a true merge commit into protected `main`.
34. The frozen R31 implementation head is confirmed reachable from `main`.
35. Final closure evidence is recorded on the R31 PR.

## Stop conditions

R31 stops for review if implementation:

- writes WordPress options or registry files;
- adds a management mutation endpoint;
- creates a second Runtime validator;
- interprets Experience state in PHP;
- merges Experience and renderer authority;
- performs directory-based Experience discovery;
- permits asset-path traversal;
- introduces remote registry/network loading;
- changes shortcode grammar;
- changes front-end Host/Runtime ownership;
- alters the WordPress or PHP support floor;
- produces unexplained release-tree movement.

## Boundary

R31 establishes:

`canonical deployment registry → read-only WordPress administration inventory/status`

R31 does not establish:

`WordPress administration → configuration/update/authoring mutation`

Those management capabilities remain later checkpoints.
