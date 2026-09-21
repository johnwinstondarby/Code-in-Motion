# ADR 0040: WordPress Static Health and Renderer Inventory

Status: Proposed for R32

## Context

R31 established the first read-only WordPress Admin Console. It reports authoritative plugin/environment identity and R30 registry-backed Experience deployment inventory without creating a second Runtime, Experience-registry, or renderer authority.

Issue #6 also requires renderer discovery/status and diagnostics/health information.

The current browser composition still owns renderer registration directly inside `wordpress/assets/bootstrap-module.mjs`:

`renderer ID → renderer factory`

The Admin Console has no renderer visibility.

R32 adds the next read-only management slice. It exposes renderer registration and static deployment/version health while keeping every displayed result grounded in local artifact state. It does not probe URLs, perform HTTP requests, instantiate renderers for diagnostics, or depend on external service availability.

## Decision

R32 establishes:

`WordPress renderer-factory registry → generated inert renderer inventory → read-only Admin Console status`

and:

`installed/source artifact facts → read-only static health panel`

R32 remains management-only. Runtime, renderer semantics, playback, Transport, Commentary, telemetry, and authoring remain outside the WordPress PHP boundary.

## Renderer factory authority

Add one production JavaScript module:

`wordpress/assets/renderer-registry.mjs`

This module becomes the sole WordPress renderer-factory registration authority.

It imports the shipped renderer implementations and exports:

- a deterministic renderer ID inventory;
- a function that creates the renderer-factory `Map` used by `createWordPressRendererResolver()`.

`wordpress/assets/bootstrap-module.mjs` must stop owning its handwritten renderer `Map` and must stop importing the subject renderer implementations directly for registration.

The browser continues to instantiate renderer factories in JavaScript. PHP receives no renderer factory, module path, executable callback, or dynamic-import authority.

## Renderer inventory projection

Add a generated inert management projection:

`wordpress/renderers/inventory.generated.json`

Schema:

`localis.cim/wordpress-renderer-inventory/v1`

Exact top-level keys:

- `schema`;
- `renderers`.

Each renderer entry has exactly:

- `id`.

The renderer IDs are generated from the production JavaScript renderer registry, sorted by bytewise lexical order, and freshness-gated.

The JSON projection is read-only management data. It does not become browser renderer authority.

The projection must not contain:

- module paths;
- factory names;
- executable expressions;
- import specifiers;
- URLs;
- renderer configuration;
- Experience configuration;
- Runtime state.

A stale or manually edited projection fails verification.

## Renderer registration semantics

A renderer shown in the Admin Console as Registered means:

> its ID is present in the generated projection of the production WordPress renderer-factory registry.

It does not mean:

- the renderer has been instantiated;
- a render has completed;
- an Experience using it is semantically valid;
- browser initialization has succeeded;
- a live page can mount it.

R32 does not add live renderer health checks.

## Static health panel

The Admin Console gains a read-only Static health section.

The section reports only locally determinable artifact facts.

At minimum:

- deployment mode: `release` or `source`;
- active module root status;
- bootstrap module presence;
- Experience registry status;
- renderer inventory status;
- registered renderer count;
- plugin-version consistency.

### Deployment mode

R31's one-mode invariant remains authoritative.

If:

`wordpress/assets/modules/<plugin-version>/`

exists, the Admin Console is in installed-release mode.

Otherwise it is in repository-source mode.

R32 must not infer mode independently through a second rule.

### Active module root

In release mode, the active version-bearing module root must exist by definition and is reported from that exact directory.

In source mode, the console reports source mode rather than claiming the absent release root is unhealthy.

### Bootstrap module presence

In release mode, bootstrap presence resolves beneath:

`wordpress/assets/modules/<plugin-version>/wordpress/assets/bootstrap-module.mjs`

In source mode, bootstrap presence resolves beneath:

`wordpress/assets/bootstrap-module.mjs`

Presence means readable file only.

### Experience registry status

Experience registry status reuses the R31 inventory boundary.

R32 does not add a second registry reader or second Experience validator.

### Renderer inventory status

Renderer inventory status means the generated JSON projection is readable and structurally usable for display.

The PHP reader performs only defensive structural checks required for safe display.

It does not parse JavaScript or inspect renderer source.

### Plugin-version consistency

The Admin Console compares:

- `LOCALIS_CIM_PLUGIN_VERSION`;
- the `Version` field from the canonical root plugin header.

A match reports Consistent.

A mismatch reports Mismatch.

The console does not read `package.json` on installed sites because release packaging does not ship it.

Build-time R22 metadata verification remains authoritative for full release-metadata consistency.

## Experience-to-renderer compatibility

R32 verification must prove at build time that every renderer ID used by the shipped registered Experiences resolves through the production WordPress renderer registry.

This proof belongs in Node verification where the existing production Experience ingestion contract is available.

PHP must not inspect the `renderer` field of Runtime Experience JSON to make this judgment.

The Experience deployment registry and renderer factory registry remain separate authorities:

- Experience registry answers which Experience asset deploys;
- renderer registry answers which renderer factory WordPress can resolve.

Neither registry owns the other.

## No network health

R32 health is static and artifact-grounded.

The Admin Console must not use:

- `wp_remote_get()`;
- `wp_remote_post()`;
- `wp_remote_request()`;
- cURL;
- sockets;
- HTTP URL probes;
- loopback requests;
- remote registry calls;
- third-party availability checks.

No displayed R32 status depends on network conditions.

## No runtime probing

The Admin Console must not:

- instantiate renderer factories;
- execute renderer `mount()`, `render()`, or `dispose()`;
- invoke Host mounting;
- load an Experience through browser or server fetch;
- execute Runtime transitions;
- replay diagnostics;
- infer browser initialization success from PHP.

R32 status is static deployment information only.

## Presentation

R32 extends the existing server-rendered Admin Console.

No administration JavaScript application is introduced.

All dynamic output remains escaped.

The renderer inventory is displayed as a read-only table with:

- renderer ID;
- registration status.

The health section uses plain status text such as:

- Release;
- Source;
- Present;
- Missing;
- Available;
- Unavailable;
- Consistent;
- Mismatch.

## Release integration

R32 changes production JavaScript, generated management data, PHP presentation, and release staging.

R32 therefore designates:

`0.1.4`

The generated renderer inventory is staged at the stable plugin path:

`wordpress/renderers/inventory.generated.json`

The renderer-registry JavaScript module follows the existing version-bearing module graph because `bootstrap-module.mjs` imports it.

The independent R23 supply-chain gate must approve the exact generated JSON path. No renderer-directory wildcard is introduced.

The frozen R31 0.1.3 baseline remains historical comparison evidence:

- 63 staged files;
- 441,067 staged bytes;
- 35 modules;
- 53 import edges;
- ZIP SHA-256 `bd164a828fe506e533e31f30a940c5a54154ca5edf31bdcbc38ae53295458426`;
- R23 manifest SHA-256 `aeec0ce5538630c6f56920066a182ac77339f26282b0ca1caef8fa54c975e9b8`.

## Explicit non-goals

R32 does not implement:

- mutable configuration;
- renderer installation or removal;
- renderer upload;
- renderer enable/disable controls;
- renderer execution diagnostics;
- live Experience loading checks;
- HTTP or network health probes;
- update-channel discovery or actions;
- cache purge controls;
- fault-history persistence;
- Runtime telemetry administration;
- Runtime semantic validation in PHP;
- Experience editing;
- registry mutation;
- `.cim` upload or compilation;
- automatic renderer discovery by directory scan;
- remote renderer catalogs;
- REST/AJAX management mutation;
- block-editor integration;
- activation/deactivation redesign;
- uninstall changes.

## Consequences

- WordPress renderer registration moves out of bootstrap composition into one dedicated production registry module.
- The Admin Console gains renderer discovery without receiving executable renderer authority.
- Static health remains deterministic and local to the installed/source artifact.
- Version consistency becomes visible without introducing a second version source.
- Experience and renderer authorities remain separate.
- R32 creates a clean base for later diagnostics or mutable configuration without adding network-dependent health semantics.

## Verification

R32 verification must prove:

- one production WordPress renderer registry module owns renderer factory registration;
- bootstrap consumes that registry rather than a handwritten renderer map;
- the generated renderer inventory is deterministic and freshness-gated;
- the generated inventory contains only renderer IDs;
- registered renderer IDs exactly match production WordPress renderer registration;
- every shipped registered Experience renderer resolves through the production renderer registry at build time;
- PHP reads only the inert generated renderer inventory;
- PHP does not inspect Runtime Experience renderer fields;
- deployment mode reuses the R31 one-mode rule;
- bootstrap-module presence resolves from the active deployment mode;
- plugin-version consistency compares the root plugin header with `LOCALIS_CIM_PLUGIN_VERSION`;
- no R32 status depends on HTTP/network access;
- no renderer or Runtime execution occurs in PHP;
- the generated renderer inventory is staged and exactly approved by the R23 supply-chain gate;
- 0.1.4 release metadata is consistent;
- deterministic fresh-install and real 0.1.3 to 0.1.4 upgrade proofs remain green;
- Node 20 and Node 22 verification remain green;
- all four protected terminal gates remain green before protected-main integration.
