# ADR 0039: WordPress Read-Only Admin Console Inventory

Status: Accepted for R31

## Context

R30 established the canonical WordPress Experience deployment registry and made browser Experience resolution, release staging, release-tree verification, and supply-chain approval derive from that single data source.

Issue #6 also requires a WordPress Admin Console so an administrator can inspect CiM without editing PHP, JavaScript, theme files, or release assets.

The current WordPress plugin has no administration surface. Its PHP boundary owns front-end asset enqueueing and shortcode rendering only.

R31 establishes the first management surface as a deliberately read-only inventory and deployment-status console. Configuration, update-channel behavior, renderer management, Runtime validation, and authoring remain separate checkpoints.

## Decision

R31 adds a top-level WordPress administration page named:

`Code in Motion`

with page slug:

`code-in-motion`

The page is available only to users with:

`manage_options`

The page callback repeats the capability check before rendering.

R31 adds no write action. The Admin Console contains no settings form, mutation endpoint, AJAX action, REST mutation, registry edit control, upload control, or filesystem write.

## Administration module boundary

The management surface is implemented in a dedicated production PHP module:

`wordpress/admin-console.php`

The existing WordPress implementation entry loads that module and retains ownership of front-end enqueueing and shortcode registration.

The Admin Console module may use WordPress administration APIs and plugin deployment metadata. It must not import, translate, or reimplement Core, Runtime, Transport, renderer, Commentary, playback, or Experience semantics.

## Console identity panel

The R31 console reports deployment/runtime-environment facts that already have authoritative sources:

- CiM plugin version from `LOCALIS_CIM_PLUGIN_VERSION`;
- current WordPress version from WordPress;
- current PHP version from `PHP_VERSION`;
- WordPress and PHP support floors from the root plugin header;
- canonical WordPress Experience registry schema;
- registered Experience count.

R31 does not invent a separate engine version or build identifier. Those fields remain deferred until a canonical source exists for them.

## Experience inventory

The Admin Console reads:

`wordpress/experiences/registry.json`

and presents one row per canonical registry entry.

Each row reports:

- Experience ID;
- asset name;
- deployment-presence status;
- canonical shortcode invocation text.

The registry remains the sole authority for which Experience IDs belong in the WordPress deployment inventory.

The Admin Console does not scan directories to discover Experiences.

## Defensive registry reading

PHP must handle the registry defensively because the Admin Console resolves deployment file paths from registry asset names.

The administration reader may perform only the structural and path-safety checks required to safely consume and display the registry:

- JSON must decode successfully;
- the expected registry container must be present;
- displayed IDs and asset names must be strings;
- an asset name must remain a single safe file name before path resolution.

Failure produces an unavailable inventory state rather than partial or guessed data.

These checks are defensive input handling for the WordPress management surface. They do not replace the R30 validator and do not establish semantic Experience validity.

The Admin Console must not:

- parse Runtime Experience state;
- assert `localis.cim/v1` semantic validity;
- duplicate `ingestExperience()`;
- assert registry-ID / Runtime-ID equality;
- interpret renderer configuration;
- approve an Experience for Runtime execution.

R30 build-time verification remains authoritative for those properties.

## Deployment-presence resolution

An R30 registry `asset` value remains a name, not a path.

R31 owns only the administration consumer's deployment-path rule.

For an installed release, a registered Experience asset resolves beneath:

`wordpress/assets/modules/<plugin-version>/wordpress/experiences/`

The Admin Console may recognize the repository source-tree location during development, but release deployment status must be based on the version-bearing installed asset.

Path resolution must remain inside the plugin directory and must fail closed for unsafe asset names.

A deployment-presence result means only that the registered asset is present and readable at the expected deployment location. It does not mean the Runtime Experience has been semantically validated at request time.

## Shortcode reference

For each safely loaded registry ID, the console may display the inert insertion reference:

`[cim experience="<experience-id>"]`

R31 adds no editor integration, block, clipboard JavaScript, page mutation, or content insertion action.

## Renderer boundary

R31 does not expose renderer inventory or renderer health.

Renderer-factory authority remains in the existing WordPress browser composition. A later checkpoint may define a management projection for renderer discovery/status without merging renderer and Experience registry authority.

## Presentation and executable-content boundary

The Admin Console uses ordinary WordPress administration markup.

R31 does not require a client-side administration application.

No CiM engine, Host, Runtime, renderer, Transport, Commentary, or bootstrap source may be emitted inline into the Admin Console.

Any future administration script or stylesheet remains subject to the plugin's external-asset packaging rules.

## Release designation

R31 changes shipped PHP and therefore designates the next WordPress plugin release:

`0.1.3`

The accepted R31 implementation must update all version-bearing release metadata consistently and establish a fresh deterministic 0.1.3 artifact identity.

The frozen R30 0.1.2 artifact remains the historical prior-release baseline:

- 62 staged files;
- 433,707 staged bytes;
- 35 modules;
- 53 import edges;
- ZIP SHA-256 `8988e2e4195456640bcf87f72a127a0db06aaef8cd772e950d2b462351938b19`;
- R23 manifest SHA-256 `3cfcaf018d4b9f642b72974c19b7b02ad31f582df0900f01a204ca35c02e7055`.

## Explicit non-goals

R31 does not implement:

- mutable host settings;
- options storage or migration;
- WordPress update-channel discovery or update actions;
- renderer registry/status;
- Runtime semantic validation in PHP;
- full diagnostics or fault-history reporting;
- cache purge controls;
- Experience upload or deletion;
- `.cim` upload or compilation;
- registry mutation;
- automatic directory discovery;
- remote registries;
- third-party Experience catalogs;
- block-editor integration;
- clipboard or insertion JavaScript;
- telemetry administration;
- activation/deactivation redesign;
- uninstall behavior changes;
- REST or AJAX management endpoints.

## Consequences

- CiM gains its first WordPress management surface.
- Administrators can inspect plugin/environment identity and the canonical deployed Experience inventory without editing files.
- R30 remains the deployment authority for Experience membership.
- PHP gains only defensive inventory-reading and deployment-presence responsibilities.
- Runtime and renderer semantics remain platform-neutral.
- R31 creates a stable administration shell for later settings, diagnostics, renderer status, and update-channel work.

## Verification

R31 verification must prove:

- the top-level Admin Console is registered with the exact slug and capability;
- unauthorized rendering fails closed;
- the console is read-only;
- plugin and environment identity come from existing authoritative sources;
- support floors come from the root plugin metadata rather than duplicate literals;
- Experience inventory derives from the R30 registry;
- malformed or unsafe registry data produces an unavailable state;
- deployment path resolution cannot escape the plugin directory;
- installed 0.1.3 Experience assets report present from the release ZIP;
- no Runtime semantic validator is added in PHP;
- no renderer authority is added to the Experience inventory;
- no executable CiM source is emitted inline;
- 0.1.3 metadata is consistent;
- fresh-install and real prior-release upgrade proofs remain green;
- Node 20 and Node 22 verification remain green;
- all four protected terminal gates remain green;
- the final 0.1.3 artifact identity is recorded before protected-main integration.
