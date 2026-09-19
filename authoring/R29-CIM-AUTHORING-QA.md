# R29 .cim Authoring QA

## Scope

R29 establishes the first human-authored Code in Motion source path.

It begins from protected `main` at:

`02409e612727051f966740c599e0c00bf0ef6376`

R29 asks one question:

> Can a human author write a readable `.cim` source file that deterministically compiles into the same validated `localis.cim/v1` Runtime contract, with actionable source-location diagnostics, without widening Runtime authority or changing the WordPress release artifact?

## Why R29 follows R27 and R28

R27 proved the generated production-content path:

`structured subject source → generated localis.cim/v1 → Runtime`

R28 moved repository integration discipline into protected `main`.

R29 now proves the other ingestion path reserved by ADR 0004:

`human-authored .cim → parser/compiler → validated localis.cim/v1 → Runtime`

Together, the two authoring paths must converge before Runtime.

## R29 deliverables

### 1. Authoring specification

ADR 0037 defines:

- authoring version marker;
- restricted YAML grammar;
- prohibited constructs;
- JSON-safe graph rules;
- source-location model;
- diagnostic ownership;
- compilation boundary;
- release boundary.

### 2. Parser/compiler library

Expected ownership:

`authoring/cim/`

The library must provide a pure compilation boundary that accepts source text plus source identity and returns either:

- a validated/frozen Runtime experience plus authoring location metadata; or
- deterministic diagnostics.

The API must not depend on browser globals, WordPress, Runtime clocks, renderers, or Host state.

### 3. CLI/check surface

Expected tooling:

- compile one `.cim` source to Runtime JSON;
- check one or more `.cim` sources without writing output;
- freshness-check committed generated fixtures.

The precise CLI spelling may be settled during implementation, but the repository must expose one deterministic scripted entry point through `package.json`.

### 4. Neutral authored fixture

R29 uses a subject-neutral authored fixture rather than duplicating the R27 Git source.

The fixture must demonstrate:

- initial state;
- at least four semantic steps;
- multiline commentary;
- structured commentary link;
- renderer-level configuration;
- step-level renderer configuration;
- authored dwell;
- nested opaque state;
- one B-to-B observation transition with equivalent state and distinct step IDs.

The compiled Runtime representation becomes a committed generated fixture protected by freshness checking.

### 5. Source-located negative fixtures

At minimum, fixtures cover:

- syntax error;
- duplicate key;
- unsupported authoring version;
- anchor/alias use;
- custom tag;
- merge key;
- multiple YAML documents;
- non-string key;
- non-finite number;
- missing required Runtime field;
- duplicate step ID;
- reserved step ID `initial`;
- negative `dwell_ms`;
- invalid commentary link scheme.

Every applicable failure must include one-based line and column.

Runtime semantic failures must preserve their existing `CIM-EXP-*` code.

### 6. Convergence proof

A valid authored fixture must compile into the same semantic Runtime object as the equivalent canonical JSON fixture.

The proof compares parsed data, not whitespace formatting.

No authoring-only key may survive into `localis.cim/v1`.

### 7. Architecture-boundary proof

R29 extends architecture checking so:

- `src/` does not import `authoring/cim/`;
- production WordPress release staging does not include the `.cim` parser/compiler;
- authoring code reaches Runtime semantics only through the existing experience ingestion contract.

## Explicit non-goals

R29 does not include:

- WordPress admin editing;
- WordPress upload-time `.cim` compilation;
- automatic Host loading of `.cim` files;
- replacement of the R27 Git generator;
- branching or conditional step graphs;
- macros;
- variables;
- templating;
- inheritance;
- includes;
- environment substitution;
- network loading;
- executable expressions;
- raw HTML;
- JavaScript;
- renderer-specific schema expansion in the shared Runtime contract;
- a GUI authoring editor;
- hot reload;
- a reverse JSON-to-`.cim` formatter.

These require separate checkpoints.

## Release invariant

R29 begins with the CiM 0.1.1 release artifact:

`code-in-motion-0.1.1.zip`

Expected immutable identity:

- 60 files;
- 433,183 staged bytes;
- 34 modules;
- 52 import edges;
- ZIP SHA-256: `55caaa141214dd5fb36960a210d42d28278739777e0d7468abeb3f1cf967a533`;
- R23 manifest SHA-256: `f7e91414c169c90fe55c32e43215db224b18454e6fbb410a89b30525975303b7`.

R29 is expected to leave this artifact unchanged.

Any ZIP digest, file-count, module-count, import-edge-count, or release-manifest movement is a stop condition requiring explicit explanation.

## Protected-main governance

R29 is the first feature checkpoint opened after R28 governance closure.

Its PR must be merged through protected `main`.

Required terminal checks:

- `CiM / Verify`;
- `CiM / Floor QA`;
- `CiM / Browser E2E`;
- `CiM / Playground`.

Merge method:

`merge`

Squash and rebase are prohibited by repository settings and the active `main` ruleset.

The final R29 head must remain reachable from `main` after integration.

## Acceptance gates

R29 closes only when all of the following are proven:

1. ADR 0037 is accepted and matches implementation.
2. A valid human-authored `.cim` fixture compiles successfully.
3. Compiled output passes the existing production `ingestExperience()` path.
4. Compiled output is semantically equivalent to the canonical JSON reference.
5. Source-located parse diagnostics are deterministic.
6. Runtime validation diagnostics retain `CIM-EXP-*` identity and gain line/column.
7. Restricted YAML features fail closed.
8. Multiline text survives exactly as authored under documented block-scalar rules.
9. Opaque state/configuration survive without Core/adapter interpretation.
10. B-to-B observation semantics survive compilation.
11. Content-safety probes remain inert or fail through existing validation.
12. Runtime/Host/renderer code does not depend on authoring syntax.
13. Committed generated fixture output passes freshness checking.
14. Node 20 and Node 22 verification are green.
15. All four protected terminal checks are green.
16. The WordPress 0.1.1 artifact remains byte-identical.
17. R29 merges into protected `main` with a true merge commit.
18. The frozen R29 head is confirmed reachable from `main`.

## Boundary

R29 establishes:

`human-readable source → source-located compiler → existing validated Runtime contract`

R29 does not change Runtime semantics.

R29 does not change the WordPress deployment format.

R29 does not designate a new release candidate.
