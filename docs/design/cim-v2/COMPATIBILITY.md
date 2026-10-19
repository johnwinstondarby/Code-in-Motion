# CiM v2 compatibility decision

Date: 2026-10-18. Baseline: `794595b4803dc47358cd67f38c82c6d100d3d428` (published 1.0.1 and fetched `origin/main`).

## Decision

Target plugin **1.1.0**, retaining all existing lesson and pack paths. “CiM v2” names the presentation initiative, not the package major version. This is an additive design decision, not a claim that an unimplemented Player has already passed compatibility tests. If implementation cannot meet the gates below, stop the 1.1 release and decide a 2.0 migration explicitly.

## Findings from the repository

| Surface | Current contract | Required treatment |
| --- | --- | --- |
| Authoring | Frozen `localis.cim/authoring/v1` and `/v2`, with separate validators and compilers | Keep their inputs, diagnostics and compiled bytes unchanged. |
| Runtime | `localis.cim/v1` and `/v2`; subject state and renderer configuration are opaque | Retain both validators. A new composite renderer can carry pane data without adding fields to the closed legacy envelope. |
| Renderer interface | Frozen `mount`, `render`, `dispose`; exact render context and shared transition clock | Adapt beneath this boundary; do not widen it for every legacy renderer. |
| Host admission | WordPress currently admits only `console/v1` for runtime v2 | Add explicit admission for the new renderer after its validator and consumers exist. No generic allow-all. |
| Packs | `cim.lesson-pack/v1`, generated bounds `>=1.0.0` and `<2.0.0`; compiled Console v2 only in PHP and JavaScript | Continue accepting these packs unchanged. New multi-pane packs use a separate versioned agreement and minimum version. |
| Existing displays | Console/Explanation for legacy Console lessons; Git and synthetic v1 renderers also registered | Preserve default composition, controls, deep links, Copy, risks, themes and independent viewports. Multi-pane UI is opt-in. |
| Version reservations | Authoring v3 reserved for limn in ADR 0048; runtime v3 reserved for author palettes | Do not describe v3 as previously reserved for multi-pane. ADR 0061 explicitly assigns the next authoring format while keeping limn/palettes deferred. No runtime v3 is needed by the chosen opaque-state design. |

Sources: `docs/AUTHORING-JSON-v2.md`, `docs/AUTHORING-TO-RUNTIME-v2.md`, `docs/EXPERIENCE-SCHEMA-v2.md`, `docs/RENDERER-CONTRACT.md`, `docs/LESSON-PACKS-v1.md`, ADRs 0048/0054/0060; `authoring/v1/`, `authoring/v2/`, `src/experience/ingest-experience.mjs`, `src/host/wordpress-admission-policy.mjs`, `wordpress/lesson-packs.php`, `wordpress/assets/lesson-pack-validation.mjs`, `wordpress/assets/renderer-registry.mjs`, `tools/lesson-pack-archive.mjs`.

## Baseline evidence and limits

- `npm run verify`: 962 tests passed, zero failures/skips, plus all verification commands. Audit runtime: Node 24.15.0; this is not the pinned release rebuild.
- `node tools/r42-v1-differential.mjs`: 41 identical v1 validation results, zero differences; 28 v2/non-JSON cases skipped as the tool specifies. This does not prove future v2 compatibility.
- Prototype tab acceptance: Chromium, Firefox and WebKit at 1366×768, 1536×864 and 1920×1080, nine combinations passed. This checks the prototype, not production engine compatibility or screen-reader behavior.
- Full production browser suites, mutation suites, WordPress upgrade/rollback rehearsals and independent rebuilds must run on the implementation candidate. They were not re-run or claimed complete for this documentation-only decision.

## Release gates

1. Frozen authoring v1/v2 fixtures compile byte-identically with identical rejection diagnostics. Legacy runtime v1/v2 fixtures retain schema and renderer admission, canonical state, cancellation, timing, reduced motion and deep-link behavior.
2. All bundled lessons, including page 3227, have unchanged lesson JSON/content and public behavior. Legacy lessons do not gain multi-pane layout or new transport UI implicitly.
3. Existing v1 pack files, activation, manifest bytes and compatibility ranges survive upgrade and rollback unchanged. Test ready and rejected packs through PHP discovery, Admin validation, public loading and tool preview. Existing limits, duplicate rejection, confinement and cache guards remain effective.
4. New packs are clearly refused on older CiM versions. New renderer availability is checked before starting playback.
5. Full verify, meaningful mutation guards, browser suites and pinned reproducible builds pass. Each candidate must reproduce its own ZIP twice and match an independent rebuild. A refactor changes shipped source bytes, so its ZIP is not expected to match the old 1.0.1 ZIP. Preserve that exact old ZIP for rollback instead.

No production implementation, version bump, migration, publication or live plugin replacement is part of this audit.
