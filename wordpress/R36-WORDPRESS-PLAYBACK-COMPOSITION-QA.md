# R36 WordPress Playback Composition QA

Status: Candidate verification

Date opened: 2026-09-23

Branch: `r36/wordpress-playback-composition`

Base: `8bda31b5fb6a0bb3df683856c7386cdfaf197f9e`

Implementation head: `d0b04c423fdbf81e97ea18319fc76a948bec83d6`

The base is the protected-main R35 merge and the source of the published 0.1.7 release.

## Purpose

R36 adds the learner-facing playback path absent from WordPress 0.1.7.

WordPress 0.1.8 composes the existing Space playback keyboard path while leaving Transport buttons, rail, markers, scrub, and Commentary UI outside the production surface.

## Entering production state

The Localis production site is running the published 0.1.7 artifact.

F1 is closed and verified live.

F2 is closed as a deployment-verification rule: automated production probes wait for `data-cim-state="ready"` or a defined timeout before judging renderer output.

F4 enters R36 open because 0.1.7 exposes no learner-facing path capable of requesting `context.animate: true`.

## Composition design

### Host observation port

The WordPress live Host adds one root-scoped read-only capability:

`observations(root)`

For a mounted root it returns a frozen observation port with exactly:

`snapshot`

The snapshot comes from the same retained Runtime instance that owns the root command port. Host remains Transport-agnostic and imports no Transport implementation.

The observation port exists only while the root remains mounted. Root disposal removes command and observation projections before Runtime disposal begins.

### WordPress Transport binding

The WordPress Transport binding receives exactly:

- `root`;
- `commandPort`;
- `observationPort`.

It creates the existing Transport controller and playback presentation, then installs the existing playback keyboard binding.

The production keyboard subset is:

- ArrowLeft -> previous;
- ArrowRight -> next;
- Home -> home;
- End -> end;
- Space -> play or pause according to fresh Runtime observation.

Space repeat remains ignored. Protected native interaction targets retain browser/native keyboard ownership.

### Scope boundary

R36 does not add:

- playback buttons;
- semantic rail;
- marker activation;
- scrub interaction;
- Commentary UI.

Any future addition to that subset must update the production-composition gate.

## Reduced-motion behavioral evidence

The synthetic renderer is the production behavioral proof surface because its animated settlement is deterministic.

Both cases use the same learner-facing Space path through the real WordPress production composition.

Normal motion:

1. Space starts continuous playback with `context.animate: true`.
2. The renderer remains at `initial` while controlled animation frames are withheld.
3. Releasing the required frames advances through `step-01` and then `step-02`.

Effective reduced motion:

1. Space starts the same continuous-playback command path.
2. The renderer reaches the same stable `step-02` destination.
3. Zero animation frames are released.

This closes the repository distinction between reduced-motion policy delivery and production behavioral reachability.

The historical Localis F4 finding remains operationally open until 0.1.8 is deployed and this behavior is confirmed on the live production site.

## First protected pass

Exact implementation head:

`d0b04c423fdbf81e97ea18319fc76a948bec83d6`

Evidence:

- Verify CiM contracts `35906015648`: PASS.
- Node 20 `107333779779`: PASS.
- Node 22 `107333780005`: PASS.
- Release reproducibility `107333780057`: PASS.
- Release build `107333780122`: PASS.
- WordPress Floor QA `35906015646`: PASS.
- WordPress Browser E2E `35906015670`: PASS.
- Synthetic production mount `107333779524`: PASS.
- PHP 7.4 `107333779589`: PASS.
- PHP 8.5 `107333779483`: PASS.
- Chromium `107333779593`: PASS.
- Firefox `107333779995`: PASS.
- WebKit `107333779698`: PASS.
- WordPress Playground PR Preview `35906015667`: PASS.
- R34 lifecycle differential `107333779202`: PASS.

## Release identity

R36 changes shipped WordPress JavaScript and therefore changes release bytes.

The published 0.1.7 artifact remains immutable.

The R36 release identity is 0.1.8.

Every version-coupled source and generated release projection must agree on 0.1.8 before candidate freeze.

## Candidate acceptance

The candidate requires:

1. exact Host command and observation capability boundaries;
2. exact production Transport composition evidence;
3. timeline navigation preservation;
4. learner-facing Space play/pause;
5. browser proof of continuous playback through WordPress;
6. browser proof of normal-motion versus reduced-motion behavior through the same production path;
7. instance isolation and detached-root lifecycle;
8. existing Runtime, Transport, renderer, schema, architecture, and reduced-motion suites;
9. WordPress Floor QA;
10. Browser E2E across supported WordPress, PHP, and browser matrices;
11. WordPress Playground;
12. release identity 0.1.8;
13. regenerated R23 supply-chain and release reproducibility evidence;
14. a second all-green exact-head protected pass.

Items 1 through 11 passed at the implementation head. Item 12 is established by candidate preparation. Items 13 and 14 are established only by exact candidate-head CI.

## Candidate freeze rule

After the 0.1.8 candidate commit is pushed, no source or documentation byte may change before the exact-head protected families complete.

If all four protected families pass, that exact commit is the R36 candidate. Candidate freeze is recorded without another tree-changing commit.

## Visual QA

The Localis presentation/theming pass remains deferred until after R36 so it can evaluate the learner-facing surface after playback composition.
