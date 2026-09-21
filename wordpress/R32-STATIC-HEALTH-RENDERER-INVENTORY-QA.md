# R32 WordPress Static Health and Renderer Inventory QA

## Scope

R32 establishes the second read-only WordPress management checkpoint.

R32 begins from protected `main` at:

`780bfb0c60d8c866d6c275b7cd2008dde99c9faf`

R32 asks:

> Can WordPress expose renderer registration and useful deployment/version health using only deterministic local artifact facts, without giving PHP renderer authority or introducing network-dependent health checks?

## Definition artifacts

R32 is governed by:

- `docs/adr/0040-wordpress-static-health-and-renderer-inventory.md`;
- this QA record.

ADR 0040 is `Accepted for R32` after implementation audit.

## Branch and base

Branch:

`r32/wordpress-static-health-renderers`

Protected-main base:

`780bfb0c60d8c866d6c275b7cd2008dde99c9faf`

The final R32 head must merge through the active protected-`main` ruleset using a true merge commit.

## Why R32 follows R31

R31 established:

`canonical Experience deployment registry → read-only WordPress administration inventory/status`

R31 deliberately left renderer discovery and broader health information deferred.

The current browser bootstrap still owns renderer-factory registration directly.

R32 separates that registration into one production JavaScript registry module and gives the Admin Console a generated inert view of renderer IDs plus static deployment/version health.

## R32 deliverables

### 1. Production renderer registry module

Add:

`wordpress/assets/renderer-registry.mjs`

It must own the shipped WordPress renderer factory registrations.

It must export:

- the deterministic registered renderer IDs;
- a function creating the renderer-factory `Map`.

`bootstrap-module.mjs` must use this module and must no longer own the renderer registration map directly.

### 2. Generated renderer inventory projection

Add:

`wordpress/renderers/inventory.generated.json`

Schema:

`localis.cim/wordpress-renderer-inventory/v1`

Exact top-level keys:

- `schema`;
- `renderers`.

Exact renderer-entry keys:

- `id`.

Records must be sorted by renderer ID using bytewise lexical ordering.

The projection is generated from the production JavaScript renderer registry and freshness-gated.

### 3. Renderer projection tooling

Add a deterministic generation/check surface.

It must:

- import the production renderer registry IDs;
- reject duplicate or malformed IDs;
- generate the exact inert JSON projection;
- fail when the committed projection is stale;
- verify shipped registered Experiences resolve to registered renderer IDs using the production Experience ingestion path;
- avoid parsing bootstrap source text as the renderer authority.

The checker must join `npm run verify`.

### 4. Admin renderer inventory

Extend `wordpress/admin-console.php` with a defensive reader for the generated renderer inventory.

The Admin Console displays one row per renderer ID:

- Renderer ID;
- Registration status: `Registered`.

Unreadable or structurally unusable renderer inventory reports Unavailable rather than partial data.

PHP must not load renderer JavaScript, instantiate factories, or inspect Runtime Experience renderer fields.

### 5. Static health panel

Add read-only statuses for:

- deployment mode;
- bootstrap module presence;
- Experience registry status;
- renderer inventory status;
- registered renderer count;
- plugin-version consistency.

R31's one-mode deployment invariant remains the only deployment-mode rule.

### 6. Version consistency

Compare:

- root plugin header `Version`;
- `LOCALIS_CIM_PLUGIN_VERSION`.

The Admin Console reports only Consistent or Mismatch.

R22 remains the complete build-time release-metadata authority.

### 7. No-network health boundary

The Admin Console must contain no outbound health probing.

No R32 management code may call WordPress HTTP APIs, cURL, sockets, or remote URLs to determine status.

### 8. Release integration

Stage the generated renderer inventory at:

`wordpress/renderers/inventory.generated.json`

The R23 gate must approve that exact path only.

The renderer registry JavaScript module must enter the release through the version-bearing module graph.

R32 designates:

`0.1.4`

The real prior-release upgrade proof must resolve 0.1.3 as N and 0.1.4 as current.

## Pre-R32 release baseline

Frozen R31 artifact:

- 63 staged files;
- 441,067 staged bytes;
- 35 modules;
- 53 import edges;
- ZIP SHA-256 `bd164a828fe506e533e31f30a940c5a54154ca5edf31bdcbc38ae53295458426`;
- R23 manifest SHA-256 `aeec0ce5538630c6f56920066a182ac77339f26282b0ca1caef8fa54c975e9b8`.

These are historical comparison values, not R32 targets.

## Explicit non-goals

R32 does not implement:

- mutable host configuration;
- renderer install/remove/enable/disable;
- renderer execution tests;
- live Experience fetch checks;
- HTTP health probes;
- loopback requests;
- remote registry checks;
- update-channel behavior;
- cache purge;
- fault-history persistence;
- Runtime telemetry administration;
- Runtime semantic validation in PHP;
- Experience editing;
- registry mutation;
- `.cim` upload/compile;
- directory-scanned renderer discovery;
- remote renderer catalogs;
- REST/AJAX management mutation;
- block editor integration;
- activation/deactivation redesign;
- uninstall changes.

## Compatibility requirements

R32 must preserve:

- R30 Experience deployment registry authority;
- R31 deployment-mode invariant;
- R31 read-only Admin Console authorization and escaping;
- Runtime Experience ingestion;
- `createWordPressExperienceLoader()`;
- `createWordPressRendererResolver()`;
- canonical shortcode markup;
- front-end enqueueing;
- root mounting/fallback;
- deep-link grammar;
- multiple-instance isolation;
- root disposal;
- Transport bindings;
- WordPress 6.5 / PHP 7.4 floor;
- deterministic release packaging;
- real prior-to-current upgrade testing.

## Acceptance gates

R32 closes only when all of the following are proven:

1. ADR 0040 is accepted and matches implementation.
2. `wordpress/assets/renderer-registry.mjs` is the sole production WordPress renderer-registration module.
3. Browser bootstrap no longer owns a handwritten renderer factory map.
4. Browser bootstrap does not directly own subject renderer registration imports.
5. Registered renderer IDs are deterministic, unique, and canonically ordered.
6. `wordpress/renderers/inventory.generated.json` uses schema `localis.cim/wordpress-renderer-inventory/v1`.
7. Generated inventory top-level key set is exact.
8. Generated renderer entry key set is exactly `id`.
9. Generated inventory contains no module paths, factory names, URLs, callbacks, configuration, or Runtime state.
10. A freshness gate proves the committed renderer inventory matches the production renderer registry.
11. Every shipped registered Experience renderer resolves through the production WordPress renderer registry in Node verification.
12. Experience and renderer registries remain separate authorities.
13. PHP reads the renderer inventory projection defensively and fails closed.
14. PHP does not parse renderer JavaScript.
15. PHP does not inspect Runtime Experience renderer fields.
16. PHP does not instantiate or execute renderer factories.
17. Admin Console lists every projected renderer ID with Registered status.
18. Deployment mode reuses R31's one-mode invariant.
19. Bootstrap presence is resolved from the active deployment mode.
20. Experience registry health reuses the existing R31 inventory boundary.
21. Renderer inventory health reports Available/Unavailable only from local projection readability/structure.
22. Plugin-version consistency compares root plugin header Version with `LOCALIS_CIM_PLUGIN_VERSION`.
23. Version mismatch is visible as Mismatch rather than silently normalized.
24. R32 Admin Console code performs no WordPress HTTP API request.
25. R32 Admin Console code performs no cURL/socket/remote probe.
26. No displayed R32 health status depends on network availability.
27. Dynamic Admin Console output remains escaped.
28. Existing R31 authorization behavior remains unchanged.
29. Generated renderer inventory is staged at its exact stable path.
30. R23 approves that exact generated JSON path without a renderer-directory wildcard.
31. The renderer registry JavaScript module is included through the version-bearing module graph.
32. Plugin/release metadata is internally consistent at 0.1.4.
33. The 0.1.4 ZIP is deterministic and reproducible under pinned release Node.
34. Fresh install from the 0.1.4 ZIP passes.
35. Real warm-cache upgrade from 0.1.3 to 0.1.4 passes.
36. Node 20 verification passes.
37. Node 22 verification passes.
38. `CiM / Verify` passes on the frozen R32 head.
39. `CiM / Floor QA` passes on the frozen R32 head.
40. `CiM / Browser E2E` passes on the frozen R32 head.
41. `CiM / Playground` passes on the frozen R32 head.
42. Final 0.1.4 file count, staged bytes, module/import counts, ZIP SHA-256, and R23 manifest SHA-256 are recorded.
43. PR integration uses a true merge commit into protected `main`.
44. The frozen R32 implementation head is confirmed reachable from `main`.
45. Final closure evidence is recorded on the R32 PR.

## Stop conditions

R32 stops for review if implementation:

- gives PHP renderer factory authority;
- parses or executes renderer JavaScript in PHP;
- inspects Runtime Experience renderer semantics in PHP;
- combines Experience and renderer registry ownership;
- uses directory scanning to discover renderers;
- uses dynamic remote imports;
- performs HTTP/network health probing;
- creates a management mutation endpoint;
- changes shortcode grammar;
- changes front-end Host/Runtime ownership;
- changes the WordPress/PHP support floor;
- introduces unexplained release-tree movement.

## Boundary

R32 establishes:

`production renderer registration + local artifact facts → read-only WordPress renderer inventory/static health`

R32 does not establish:

`WordPress administration → live runtime/network diagnostics or mutation`


## Implementation audit

Accepted implementation head:

`c4181b0af4269d4fe7101efc0d328a483cb16a28`

The implementation audit confirms:

- `wordpress/assets/renderer-registry.mjs` owns the shipped WordPress renderer-factory registrations;
- `bootstrap-module.mjs` consumes `createWordPressRendererRegistry()` and no longer imports subject renderers for registration;
- registered renderer IDs are `git/v1` and `synthetic/v1`, in canonical lexical order;
- `wordpress/renderers/inventory.generated.json` contains only schema plus ID-only renderer records;
- the generated renderer inventory is freshness-gated against the production renderer registry;
- the release builder invokes the renderer-registry check before staging, so a direct release build cannot package stale renderer management data;
- Node verification proves both registered Experiences resolve through the production WordPress renderer registry;
- the Experience deployment registry and renderer factory registry remain separate authorities;
- `wordpress/admin-console.php` reads only the inert generated renderer inventory for renderer display;
- PHP does not import, parse, or execute renderer JavaScript;
- PHP does not inspect Runtime Experience renderer fields;
- the renderer inventory displays `Registered` only as a projection-membership fact;
- R31 deployment mode is factored through `localis_cim_admin_deployment_context()` and reused by both Experience presence and bootstrap health;
- source mode reports Source without classifying the absent release root as unhealthy;
- release mode resolves bootstrap presence inside the active version-bearing module root;
- Experience registry health reuses the R31 Experience inventory result;
- renderer inventory health is derived only from local projection readability and defensive structure checks;
- plugin-version consistency compares the root plugin header Version against `LOCALIS_CIM_PLUGIN_VERSION`;
- a live WordPress proof confirms a deliberately divergent version pair reports `mismatch`;
- static verification and the packaging gate reject WordPress HTTP API, cURL, and socket probe tokens from the Admin Console;
- no R32 displayed status depends on network access;
- the generated renderer inventory is staged at the exact stable path `wordpress/renderers/inventory.generated.json`;
- R23 approves that exact path without a renderer-directory wildcard;
- the new renderer registry module enters the version-bearing module graph through the bootstrap import;
- the WordPress 6.5 / PHP 7.4 floor and R31 authorization/escaping behavior remain unchanged.

No ADR 0040 correction is required after implementation audit.

## Accepted 0.1.4 artifact identity

The accepted implementation build establishes:

- 65 staged files;
- 449,348 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `8d7064bb23994afaf0b910a7c49269d184f7e6c7dfdcba07621be4a3a68f3e66`;
- R23 manifest SHA-256 `841e27c0621387e56a88f60594c8179931d49917a48a7ee4e142ab1a3c1fd301`.

Relative to the frozen 0.1.3 baseline, the final R32 release adds exactly two staged files:

- `wordpress/assets/renderer-registry.mjs` inside the version-bearing module graph;
- `wordpress/renderers/inventory.generated.json` at its stable management-data path.

The module graph therefore moves from 35 modules / 53 import edges to 36 modules / 54 import edges. The second R32 slice changes the existing `wordpress/admin-console.php` bytes but adds no further release path.

## Implementation-head verification

On `c4181b0af4269d4fe7101efc0d328a483cb16a28`:

- Node 20: 694/694 PASS;
- Node 22: 694/694 PASS;
- renderer-registry freshness and Experience-to-renderer compatibility: PASS;
- WordPress packaging baseline: PASS;
- release build: PASS;
- release reproducibility: PASS;
- repository-source R32 renderer inventory and static-health proof: PASS;
- explicit version-mismatch visibility proof: PASS;
- installed-release R32 renderer inventory and static-health proof: PASS;
- fresh 0.1.4 ZIP install: PASS;
- real warm-cache 0.1.3 to 0.1.4 upgrade: PASS;
- Plugin Check: PASS;
- WordPress 6.5.10 through 7.1.1: PASS;
- PHP 7.4 and PHP 8.5: PASS;
- Chromium, Firefox, and WebKit: PASS;
- `CiM / Verify`: PASS;
- `CiM / Floor QA`: PASS;
- `CiM / Browser E2E`: PASS;
- `CiM / Playground`: PASS.

The ADR/QA acceptance update that records this audit is documentation-only and does not alter the 0.1.4 release artifact identity.
