# ADR 0053: Engine Identity and v2 Production Admission

Status: Accepted; promotion requires the four protected workflows on the candidate head.

Date: 2026-10-13

## Context

The owner authorized merging PR #78, enforcing engine identity/version compatibility, and opening the v2 production gate. PRs #77/#78 supply beat navigation, deep links, independent pane following/holds and learner presets. The registration bridge must also retain v2 anchor/evidence/risk semantics before admitting the Git reference lesson.

## Decision

1. `src/contracts/engine-identity.mjs` declares the frozen capability identity `localis.cim/engine`, version `1.0.0`, supporting explicit runtime schemas v1 and v2. Capability version is independent of plugin/package version `0.1.11`. The initial capability version preserves existing v1 `engine_min: 1.0.0` data and encompasses the accepted compiled v2 minimum `0.2.0`. These minima and compiler outputs remain unchanged. Future features that exceed this engine require a capability version greater than 1.0.0; release numbering does not grant engine capabilities.
2. Compare `engine_min` using semantic-version precedence: numeric major/minor/patch, numeric/alphanumeric prerelease ordering, stable releases above prereleases, and ignored build metadata. Numeric comparisons are exact even beyond JavaScript safe integers. Ranges, malformed versions and numeric prerelease leading zeros are rejected.
3. WordPress browser loading performs admission immediately after production ingestion and before returning the frozen experience to Host. Failed promises leave the cache and may be retried. The deployment-registry checker calls the same policy. `CIM-EXP-015` is a structured Experience fallback for unsatisfied/invalid engine minimum, before renderer resolution, clocks, Runtime, Core or learner controls are constructed. Other hosts must call the shared engine compatibility check before providing an experience to Runtime; structural ingestion alone is not compatibility admission.
4. Recognizing v2 does not authorize incomplete WordPress Player modes. Only `console/v1` currently supplies complete v2 consumers. WordPress rejects other v2 renderer modes with `CIM-EXP-016` before construction. Legacy v1 renderer resolution and presentation remain unchanged.
5. v2 Player content adds a frozen `instructions` array aligned one-for-one with existing entries, carrying `anchor` (or null), copied `evidence` IDs, and frozen `risk` level/guidance (or null). Legacy content keys and the native Commentary entry/control contracts remain exact and unchanged. Host projection never inspects opaque renderer state.
6. Explanation shows Command/Output/Response context, a readable related-line count, and retains evidence identifiers as a relationship on its entry. The native Show in Console action seeks that entry's canonical boundary with Commentary provenance; renderer-owned focus independently shows the matching compiled evidence. No renderer attributes/IDs are added or changed. Internal evidence IDs are not exposed as learner prose. Final entries present prose, derived textual risk label and optional guidance, then reference links. Nothing is revealed ahead of the canonical prefix.
7. The v2 schema registration whitelist opens for compatible, validated Console experiences. `git-repository-practice` is added to the sorted deployment registry, copied byte-for-byte from its canonical compiled artifact and guarded against drift. Existing `git-basic-cycle` and `synthetic-wordpress` assets remain unchanged. Registration is not a bypass of validation, compatibility, renderer resolution or readiness admission.
   Both mount-time and later hash changes use the shared public deep-link resolver: v2 beat IDs map to final boundaries and generated segment IDs remain private. Hash changes re-check current location and live command capability after cached experience loading, so stale/disposed work cannot navigate a retired root. Commentary still seeks internal segments with its existing provenance. Playground now previews the registered v2 lesson.
8. No package/release version bump, canonical Console oracle change, compiler rewrite or live installation is included. Next still completes an unfinished beat before advancing. The known wrap collision, copy controls, timeline/rate UI and background-band/limn work remain separate checkpoints.

## Normative amendments

This decision lifts the temporary R42 registration restriction in EXPERIENCE-SCHEMA-v2 and the corresponding historical closed-gate statements in ADRs 0049/0050/0051/0052. It amends ADR 0049/0051's Host content projection only by the v2 instructions array. Engine identity/version checks happen at loading/deployment boundaries, outside Core and renderer authority. CIM-SPEC and FAULTS record these requirements and codes.

## Verification

Headless proofs cover semantic-version ordering/invalid values, existing v1/v2 minima, newer-version rejection, cache retry, immutable projection with opaque-state traps, permitted Player modes and rejection before renderer/clock/Runtime construction. Browser proofs use the real source registry, loader and bootstrap with a healthy legacy sibling, incoming beat links, per-boundary evidence focus, risk/guidance/link ordering and per-root version fallback. Protected CI also exercises the actual WordPress shortcode path against source deployment and installed exact ZIP, plus the three-browser matrix. Mutation guards protect loading/deployment policy and every added instructional consumer after passing baselines. All four protected workflows must pass on the exact candidate before promotion. Live installation/site-font confirmation remains a separate operation.
