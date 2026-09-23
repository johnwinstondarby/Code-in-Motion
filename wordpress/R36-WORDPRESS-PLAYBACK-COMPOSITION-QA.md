# R36 WordPress Playback Composition QA

Status: In progress

Date opened: 2026-09-23

Branch: `r36/wordpress-playback-composition`

Base: `8bda31b5fb6a0bb3df683856c7386cdfaf197f9e`

The base is the protected-main R35 merge and the source of the published 0.1.7 release.

## Purpose

R36 closes the remaining production reachability gap recorded as F4 after the first controlled Localis deployment.

WordPress 0.1.7 exposes discrete timeline keyboard navigation but does not compose a learner-facing path that can request continuous playback. The Transport playback components, Runtime playback behavior, playback presentation, and reduced-motion behavior are independently verified, but the WordPress production binding does not wire them together.

R36 composes the existing Space playback keyboard path into WordPress without adding Transport buttons, rail, markers, scrub, or Commentary UI.

## Entering production state

The Localis production site is running the published 0.1.7 artifact.

F1 is closed and verified live.

F2 is closed as a deployment-verification rule: automated production probes wait for `data-cim-state="ready"` or a defined timeout before judging renderer output.

F4 remains open at the R36 base because WordPress production never requests `context.animate: true`.

## Composition design

### Host observation port

The WordPress live Host adds one root-scoped read-only capability:

`observations(root)`

For a mounted root it returns a frozen observation port with exactly:

`snapshot`

The snapshot comes from the same retained Runtime instance that owns the root command port. The Host remains Transport-agnostic and does not import Transport modules.

The observation port exists only while the root is mounted. Root disposal removes both command and observation projections before Runtime disposal begins.

### WordPress Transport binding

The WordPress Transport binding receives exactly:

- `root`;
- `commandPort`;
- `observationPort`.

It creates the existing Transport controller and playback presentation, then installs the existing playback keyboard binding.

The production keyboard subset becomes:

- ArrowLeft -> previous;
- ArrowRight -> next;
- Home -> home;
- End -> end;
- Space -> play or pause according to Runtime observation.

Space repeat remains ignored. Protected native interaction targets continue to yield to browser/native behavior.

### Scope boundary

R36 does not add:

- playback buttons;
- semantic rail;
- marker activation;
- scrub interaction;
- Commentary UI.

Those remain separate future composition changes and must update the production-composition gate if added.

## Reduced-motion behavioral closure

The synthetic renderer is the production behavioral proof surface because it has deterministic animated-settlement behavior.

For the same Space playback action:

1. normal motion begins continuous playback with `context.animate: true`; the immediate DOM remains at `initial` until animation-frame settlement;
2. effective reduced motion uses the same continuous-playback command path but settles the first destination synchronously, so the immediate DOM reaches `step-01` without waiting for animation frames;
3. both paths complete at the same stable final state.

This closes the prior distinction between contract-level reduced-motion delivery and production behavioral reachability.

## Release identity rule

R36 changes shipped WordPress JavaScript and therefore changes release bytes.

The published 0.1.7 artifact remains immutable. Before candidate freeze, the branch must advance to a new release identity and regenerate every version-coupled release artifact through the deterministic release pipeline.

## Acceptance gates

Before R36 can close:

1. The WordPress Host observation port is exact, frozen, root-scoped, and removed on root disposal.
2. The WordPress production-composition test proves the exact shipped Transport import subset.
3. Arrow timeline navigation remains green.
4. Space invokes play/pause from Runtime-derived playback presentation and ignores repeat.
5. Browser E2E proves Space reaches continuous playback through the real WordPress composition.
6. Browser E2E proves normal-motion versus reduced-motion settlement behavior on the same production path.
7. Three-instance isolation and detached-root lifecycle remain green.
8. Existing Transport, Runtime, renderer, reduced-motion, schema, and architecture suites remain green.
9. WordPress Floor QA remains green.
10. WordPress Browser E2E remains green across the supported WordPress, PHP, and browser matrices.
11. WordPress Playground remains green.
12. The changed release receives a new version identity rather than reusing 0.1.7.
13. R23 supply-chain and release reproducibility evidence is regenerated for the candidate.
14. Exact-head protected-gate evidence is recorded before merge.

## Visual QA

The Localis presentation/theming pass remains deferred until after R36 so it can evaluate the learner-facing surface after playback composition rather than polishing an immediately changing control surface.
