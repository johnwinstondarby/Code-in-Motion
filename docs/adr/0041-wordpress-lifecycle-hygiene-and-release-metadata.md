# ADR 0041: WordPress Lifecycle Hygiene and Release Metadata

Status: Accepted for R33

## Context

R31 established the read-only WordPress Admin Console and Experience deployment inventory.

R32 added renderer inventory and static local artifact health.

Issue #6 still requires expected plugin-management behavior, including lifecycle behavior, update/status visibility, configuration, insertion help, and community-facing support information.

The repository currently has no CiM-owned persistent WordPress state:

- no option writes;
- no transients;
- no custom database tables;
- no activation hook;
- no deactivation hook;
- no uninstall handler.

That absence is an architectural fact worth preserving before a later checkpoint introduces mutable state.

The existing WordPress `readme.txt` already owns release-facing metadata such as:

- Stable tag;
- Tested up to;
- current changelog entry;
- support route.

R22 verifies that release metadata remains consistent with the plugin header and package metadata.

R33 establishes lifecycle hygiene and read-only release metadata without inventing a WordPress-specific Host policy or an external update source.

## Decision

R33 establishes two related contracts:

`state-free WordPress plugin lifecycle → zero CiM residue after uninstall`

and:

`canonical readme release metadata → generated inert release-info projection → read-only Admin Console display`

R33 remains read-only and network-free.

## State-free lifecycle contract

At R33, Code in Motion intentionally owns no persistent WordPress state.

The production plugin must not require activation-time initialization, deactivation-time mutation, or uninstall cleanup while that remains true.

R33 therefore does not add no-op lifecycle hooks merely to satisfy a surface requirement.

Instead, verification proves the actual lifecycle:

1. install the exact release ZIP;
2. activate Code in Motion;
3. exercise the production shortcode/mount path;
4. deactivate Code in Motion;
5. uninstall/delete Code in Motion;
6. inspect WordPress persistence for CiM-attributable residue.

The final state must contain no CiM-owned option, transient, metadata, or custom-table residue.

This proof is a forward tripwire. The first later checkpoint that introduces persistent state must update the lifecycle contract and prove that uninstall removes that state.

## CiM-attributable persistence

R33 lifecycle verification inspects the isolated WordPress test database for CiM-attributable names after uninstall.

At minimum, the proof checks:

- options and transient option names containing the plugin namespaces used by CiM;
- standard WordPress metadata keys containing those namespaces;
- custom table names containing those namespaces.

The isolated lifecycle environment must not install unrelated plugins whose data could make the namespace check ambiguous.

R33 does not reserve a new persistent option schema. A later mutable-state checkpoint must define its namespace and migration/uninstall contract explicitly.

## No lifecycle hooks while state-free

R33 verification also proves the production PHP contains no:

- `register_activation_hook()`;
- `register_deactivation_hook()`;
- uninstall callback registration;
- `uninstall.php`;
- WordPress option/transient/table write used to establish persistent plugin state.

This is not a permanent prohibition. It records the state-free R33 contract.

A later state-owning checkpoint may change the contract only with matching migration and uninstall evidence.

## Release metadata projection

R33 adds one generated inert file:

`wordpress/release/release-info.generated.json`

Schema:

`localis.cim/wordpress-release-info/v1`

The projection is generated from canonical release metadata already governed by R22.

Exact top-level keys:

- `schema`;
- `stable_tag`;
- `tested_up_to`;
- `current_release`;
- `support_uri`.

`current_release` has exactly:

- `version`;
- `notes`.

`notes` is a non-empty array of the bullet lines under the current release heading in `readme.txt`, with the leading list marker removed.

The projection contains no executable content.

## Canonical metadata sources

The generator derives:

- `stable_tag` from the `Stable tag` field in `readme.txt`;
- `tested_up_to` from the `Tested up to` field in `readme.txt`;
- `current_release.version` from the current changelog heading in `readme.txt`;
- `current_release.notes` from that changelog entry;
- `support_uri` from the R22 canonical support URI, which R22 already requires to appear in the Support section.

R33 must not introduce hand-maintained copies of these values in PHP.

The generated projection is deterministic and freshness-gated.

A direct release build must fail if the committed projection is stale.

## Admin Console release information

The Admin Console defensively reads the generated release-info projection and displays a read-only Release information section containing:

- Stable tag;
- Tested up to;
- current release version;
- current release notes;
- Support link.

Dynamic text is escaped.

The support URL is emitted through `esc_url()`.

If the projection is unreadable or structurally unusable, the section reports Unavailable rather than displaying partial metadata.

PHP must not parse `readme.txt` on an installed site. The generated projection is the installation-time management input.

## Update boundary

R33 does not implement a custom update checker.

For a plugin outside the WordPress.org directory, a custom checker would require an external authority for latest-version state and an outbound PHP request.

No update distribution endpoint has yet been selected as canonical.

R33 therefore adds no:

- update transient hook;
- GitHub release polling;
- WordPress.org update registration;
- custom update API;
- download/install action;
- outbound request for latest-version status.

The installed and stable release versions remain visible through canonical local metadata.

## Configuration boundary

R33 adds no settings form or persistent option.

The existing Host/Runtime contracts expose no established mutable Host policy that can be surfaced without inventing WordPress-specific semantics.

A later configuration checkpoint must first identify the canonical Host/runtime seam.

## Insertion boundary

R33 does not add a block-editor integration.

The canonical shortcode remains the only WordPress invocation-authoring grammar.

The existing Experience inventory continues to display the inert shortcode reference for each registered Experience.

A clipboard affordance may be added later as presentation over that existing string, but it is not required for the R33 lifecycle contract.

## Experience/deep-link authoring boundary

R33 does not parse Experience JSON in PHP to expose step IDs or deep-link targets.

If future authoring help needs step/deep-link inventory, it must consume a build-time generated projection rather than moving `localis.cim/v1` semantic parsing into PHP.

## Release designation

R33 changes the Admin Console and adds one generated management-data file.

R33 therefore designates:

`0.1.5`

The generated release-info projection ships at the exact stable path:

`wordpress/release/release-info.generated.json`

The deterministic release builder freshness-gates and stages that file.

R23 approves that exact path only. No `wordpress/release/**` wildcard is introduced.

The frozen R32 0.1.4 baseline remains historical comparison evidence:

- 65 staged files;
- 449,348 staged bytes;
- 36 modules;
- 54 import edges;
- ZIP SHA-256 `8d7064bb23994afaf0b910a7c49269d184f7e6c7dfdcba07621be4a3a68f3e66`;
- R23 manifest SHA-256 `841e27c0621387e56a88f60594c8179931d49917a48a7ee4e142ab1a3c1fd301`.

## Explicit non-goals

R33 does not implement:

- mutable host configuration;
- WordPress options storage;
- configuration migration;
- custom update discovery;
- update polling;
- update installation;
- activation-time state initialization;
- deactivation-time state mutation;
- persistent diagnostics/fault history;
- live Runtime diagnostics;
- network health probing;
- cache purge controls;
- block-editor registration;
- separate block invocation grammar;
- clipboard JavaScript;
- Experience-step/deep-link parsing in PHP;
- registry mutation;
- `.cim` upload or compilation;
- REST/AJAX management mutation.

## Consequences

- CiM gains a tested uninstall-cleanliness contract before it owns persistent state.
- Later stateful checkpoints inherit an explicit cleanup obligation.
- Release-facing metadata appears in the Admin Console without creating a second metadata authority.
- Installed PHP does not need to parse the WordPress readme.
- Update-channel design remains separate until a canonical distribution source exists.
- Mutable Host configuration remains separate until a real Host/runtime seam exists.

## Verification

R33 verification must prove:

- the R33 production plugin owns no persistent WordPress state;
- no activation/deactivation/uninstall hook is added while state-free;
- the exact release ZIP can install, activate, render/mount, deactivate, and uninstall;
- no CiM-attributable database residue remains after uninstall;
- `wordpress/release/release-info.generated.json` is generated deterministically;
- the projection is freshness-gated against canonical release metadata;
- the release builder fails on stale release-info data;
- exact projection key sets;
- current release notes derive from the current readme changelog entry;
- support URI derives from R22 canonical metadata;
- PHP reads only the inert generated projection;
- PHP does not parse `readme.txt`;
- malformed projection data fails closed;
- support links use URL escaping;
- no update/network request is introduced;
- no Settings API or state write is introduced;
- 0.1.5 metadata is consistent;
- deterministic release packaging remains green;
- real 0.1.4 to 0.1.5 warm-cache upgrade remains green;
- Node 20 and Node 22 verification remain green;
- all four protected terminal gates remain green before protected-main integration.
