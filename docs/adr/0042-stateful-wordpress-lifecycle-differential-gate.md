# ADR 0042: Stateful WordPress Lifecycle Differential Gate

Status: Proposed for R34

## Context

R33 proved that the 0.1.5 WordPress plugin is state-free across a real install, activation, browser mount, deactivation, and uninstall/delete cycle.

That proof currently detects CiM-attributable persistence by namespace. It is valid for R33 because the production PHP owns no persistent state and no third-party library currently writes persistent WordPress state on CiM's behalf.

The first checkpoint that introduces CiM-owned persistent state changes the risk model. A dependency or future implementation can write:

- an option or transient under a generic key;
- metadata under a generic key;
- a custom table without a CiM namespace;
- files beneath `wp-content/` outside the plugin directory.

A namespace-only residue proof could miss those writes.

R34 therefore establishes a stronger prerequisite before any persistent CiM state is introduced.

## Decision

Before the first persistent CiM state is added, the lifecycle proof must move from namespace detection to a control-derived before/after differential across WordPress persistence and `wp-content/`.

The gate compares two lifecycle runs:

1. an inert control plugin;
2. Code in Motion.

Both runs execute:

`clean baseline → install → activate → exercise → deactivate → uninstall/delete → final snapshot`

The control run identifies WordPress-owned lifecycle churn.

The CiM run is responsible for every remaining differential after subtracting only control-proven churn.

## Sequencing rule

R34 must preserve the following commit order.

### Commit A: differential gate only

The strengthened differential proof lands before any persistent CiM state.

It must pass against the existing state-free plugin.

This commit must not introduce an option, transient, table, metadata write, or persistent file.

### Commit B: first state write without cleanup

The first persistent CiM setting or other state write lands in a separate commit before uninstall cleanup is added.

The strengthened lifecycle differential is expected to fail on this commit.

The failing exact-head workflow evidence must be retained in the R34 QA record.

This is deliberate negative-control evidence that the new tripwire detects omitted cleanup.

### Commit C: cleanup contract

The matching uninstall cleanup and any required migration/lifecycle code land in a later commit.

The same lifecycle differential must return to green.

The failing Commit B must remain in branch history. It must not be amended away, squashed into Commit C, or replaced by a synthetic unit test.

## Stateful-feature precondition

R34 must not invent a WordPress-only setting merely to exercise persistence.

The first persistent setting must map to an established CiM Host/runtime policy or other canonical product contract.

If no such canonical stateful seam is available, R34 stops after Commit A and the differential gate becomes the prerequisite for a later stateful checkpoint.

## Control plugin

The control is a generated inert WordPress plugin used only by the lifecycle workflow.

It has:

- the same plugin basename as the CiM artifact within its isolated control environment;
- a valid WordPress plugin header;
- no hooks;
- no options;
- no transients;
- no metadata writes;
- no database access;
- no filesystem writes.

The control and CiM runs execute in isolated environments using the same:

- WordPress version;
- PHP version;
- wp-env/tooling version;
- lifecycle commands;
- snapshot implementation.

The control exists only to reveal WordPress-owned lifecycle churn.

## Differential model

The lifecycle proof captures baseline and final state for both control and CiM.

A differential records exact locations and values, not only names.

### Database scope

At minimum, the snapshot covers:

- `wp_options`;
- `wp_postmeta`;
- `wp_usermeta`;
- `wp_termmeta`;
- `wp_commentmeta`;
- the full custom-table name set.

For key/value tables, the snapshot records the exact key and a deterministic representation of the associated value.

For custom tables, the snapshot records exact table names. A later checkpoint that intentionally creates a CiM table must extend the snapshot to compare its schema and relevant contents.

### Filesystem scope

The snapshot covers `wp-content/` recursively.

It records exact relative paths plus deterministic content hashes for regular files.

The plugin installation directory itself is excluded from the filesystem differential because its removal is asserted separately.

No prefix, glob, or directory-pattern exclusion is permitted for other `wp-content/` paths.

A library write to `uploads/`, a cache directory, or another location therefore remains visible.

## Control-derived exclusions

The control run produces the set of WordPress-owned lifecycle differences.

Exclusions are allowed only by exact database locator or exact filesystem path.

Prefix, suffix, wildcard, regex, glob, directory-wide, table-family, transient-family, or metadata-family exclusions are prohibited.

Every exclusion entry carries a one-line reason.

The default reason may be generated from same-run evidence, for example:

`Observed in the inert control lifecycle under the same WordPress/PHP/toolchain tuple.`

The exclusion set is regenerated from the control run rather than guessed from prior WordPress behavior.

If WordPress changes its own lifecycle churn, the control evidence changes with it.

## Value-aware comparison

An exact key appearing in control churn does not grant permission to ignore its value.

The comparator must preserve value semantics.

For a location that returns to baseline in the control run, the CiM run must also return to its own baseline exactly.

For a location whose final value changes in the control run, the CiM change may be excluded only when its normalized lifecycle delta is equivalent to the control-proven WordPress change.

The normalization, if any, must be narrow, deterministic, and applied only to exact locations observed in the control run.

A broad value-normalization rule is prohibited.

Examples:

- `active_plugins` must equal its baseline after deletion;
- an exact WordPress lifecycle key containing the test plugin basename may normalize only that basename;
- a control-observed timestamp field may normalize only that timestamp field at that exact locator.

Any additional value change is a finding.

## No blanket transient exclusion

The differential must never exclude:

- `_transient_*`;
- `_site_transient_*`;
- cache-prefixed options;
- generic metadata prefixes;
- entire option families.

A transient written by CiM or a dependency is therefore detected unless the exact key and equivalent value delta were independently observed in the inert control run.

## Filesystem comparison

The control and CiM filesystem differentials use the same exact-path rule.

A path is excludable only when the same path-level lifecycle change is observed in the inert control.

The plugin directory is handled separately:

- it may exist while installed;
- it must be absent after uninstall/delete.

Any additional CiM-run path or content-hash change under `wp-content/` is a finding.

## Evidence retention

R34 QA must retain:

- Commit A SHA and green lifecycle run;
- the generated control differential/exclusion evidence;
- Commit B SHA and the failing lifecycle run proving the uncleaned state is detected;
- the exact finding emitted for Commit B;
- Commit C SHA and the restored green lifecycle run;
- final exact-head protected-gate evidence.

The negative-control failure is part of acceptance evidence.

## Relationship to R33

R33 remains correct for the state-free 0.1.5 release.

ADR 0042 strengthens the lifecycle proof prospectively. It does not retroactively alter R33's accepted claim.

The R33 namespace proof may remain as a secondary diagnostic, but it cannot be the sole uninstall-cleanliness gate once persistent state exists.

## Release versioning

Commit A changes verification only and does not require a plugin version change if release bytes remain unchanged.

The first production stateful change will designate the next plugin version only when its release bytes change.

## Explicit non-goals

ADR 0042 does not itself define:

- the first persistent setting;
- option names;
- configuration UI;
- migration semantics;
- update-channel policy;
- a new Host/runtime policy.

Those belong to the stateful feature's own decision record.

## Consequences

- The first stateful CiM feature cannot enter WordPress without a live broad differential already guarding it.
- WordPress-owned churn is measured by an inert control rather than guessed.
- Exclusions remain exact and reviewable.
- Generic third-party persistence becomes observable.
- `wp-content/` writes outside the plugin directory become observable.
- The expected-red state commit proves the lifecycle gate can catch missing cleanup.
- Future WordPress lifecycle changes update the control evidence instead of silently widening exclusion patterns.

## Verification

The first stateful checkpoint must prove:

- Commit A contains the stronger differential and no persistent CiM state;
- Commit A passes live lifecycle verification;
- the control plugin is inert;
- control and CiM runs use the same WordPress/PHP/toolchain tuple;
- database snapshots include values, not names alone;
- filesystem snapshots cover `wp-content/` outside the plugin directory;
- control-derived exclusions use exact locators/paths only;
- every exclusion has a one-line reason;
- no prefix/pattern exclusion exists;
- no blanket transient exclusion exists;
- value-aware comparison is enforced;
- the first state-writing commit is separate from cleanup;
- that state-writing commit fails the lifecycle differential;
- the failure evidence is retained;
- cleanup lands in a later commit;
- the same lifecycle differential returns to green;
- the negative-control commit remains reachable in branch history;
- no persistent setting is introduced without a canonical CiM policy seam.
