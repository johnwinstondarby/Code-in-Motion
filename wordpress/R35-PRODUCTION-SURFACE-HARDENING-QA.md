# R35 Production Surface Hardening QA

Status: In progress

Date opened: 2026-09-22

Branch: `r35/production-surface-hardening`

Base: `643b4bb4653d54fe0364259a709984d8e0b95f10`

The base is the protected-main R34 merge and the source of the published 0.1.6 release.

## Production evidence that opened R35

The first controlled Localis production upgrade from 0.1.1 to 0.1.6 established an exact deployed 0.1.6 tree and then exercised the real WordPress surface.

The production session found four follow-up items.

### F1 — Git renderer presentation inherits an unusable host color

On the Localis dark page field, `git/v1` inherited near-black text because `wordpress/assets/cim.css` supplied structural layout but no renderer surface colors.

R35 response:

- give `git/v1` an explicit bright instrument-panel surface;
- use established Localis palette anchors rather than page-inherited text color;
- gate computed renderer and lane colors in Browser E2E.

Implementation commits:

- `11e13749c9da6d1fd9cc07225de6511fecddf40c` — host-independent Git renderer presentation;
- `fb6e70e3b613b4c05b98aab011e48f44f5a55189` — browser contrast assertions.

### F2 — browser deployment probes can snapshot before asynchronous mount settles

The production CiM request chain began after page load and a rendered-browser probe captured the valid static fallback before Host mount completed. Manual Chrome verification later proved that the same page reached `data-cim-state="ready"` with all CiM requests successful.

R35 rule:

A production browser probe must wait for `data-cim-state="ready"` or a defined settle timeout before judging renderer output. A DOM snapshot taken at the page load event is pre-mount evidence, not a mount result.

The repository Browser E2E already follows this rule with an explicit ready-state wait. R35 records the rule for deployment verification rather than adding a second competing readiness mechanism.

### F3 — `git/v1` has settlement pacing but no intermediate visible animation

`git/v1` waits for injected animation-frame callbacks when `context.animate` is true and reduced motion is false, but it renders no intermediate visual state. The destination subtree replaces the prior stable subtree only at settlement.

R35 response:

- document the visible-motion scope explicitly in the Git renderer contract;
- preserve the distinction between delayed settlement and visible animation.

Implementation commit:

- `866d25dc02b823858c9a2fc96cfb8151c69b8fdb`.

### F4 — WordPress 0.1.6 composes only a subset of verified Transport capabilities

The deployed `wordpress/assets/transport-binding.mjs` imports the timeline keyboard binding and Transport controller. Playback keyboard integration, Transport buttons, semantic rail, marker activation, and scrub interaction exist as verified components but are not wired into the WordPress production surface.

As a result, 0.1.6 exposes no learner action that requests continuous playback and renderer `context.animate` remains false on the WordPress surface.

R35 response:

- establish ADR 0044;
- add an executable gate for the exact shipped WordPress Transport subset;
- prove ArrowRight reaches the command-only Transport path;
- prove Space is not captured by the current WordPress binding;
- preserve playback wiring as an explicit later composition change rather than inferring it from component conformance.

Implementation commits:

- `5f159eb6ccd03d74b5f5a78a8701d9a2ec41698b` — production Transport composition gate;
- `aa0821c46c07eb665afd013d43828aa4240c457c` — ADR 0044.

## Reduced-motion production evidence

The 0.1.6 Localis production matrix passed all four contract-level cells:

| Case | Site policy | Script attribute | Module parameter | Browser reduced motion | Derived effective |
| --- | --- | --- | --- | ---: | ---: |
| 1 | absent (`system`) | `system` | `system` | false | false |
| 2 | `reduce` | `reduce` | `reduce` | false | true |
| 3 | absent (`system`) | `system` | `system` | true | true |
| 4 | `reduce` | `reduce` | `reduce` | true | true |

The invariant held in every cell:

`effectiveReducedMotion = browserReducedMotion || siteMotionPolicy === "reduce"`

Behavioral differentiation was intentionally not claimed because F4 made the animated branch unreachable on the WordPress surface.

## Production cleanup state

The temporary WordPress page used for the motion matrix, page 3409, is in Trash under slug `cim-motion-matrix__trashed`.

The production motion option was deleted after the matrix, absence was verified, and the WordPress object cache was flushed. The Admin Console then reported `System preference`, matching the restored entering state.

## Release identity rule

R35 changes WordPress release bytes through `wordpress/assets/cim.css`. The published 0.1.6 artifact remains immutable.

R35 must not merge to protected `main` while package/plugin/release metadata still identifies the changed artifact as 0.1.6. Before candidate freeze, R35 must advance the release version and regenerate every version-coupled release artifact through the existing deterministic release pipeline.

## Interim exact-head evidence

Interim implementation head before release-identity work:

`9fd6d1cc57fe258cf2137d3d114cf82c5f59c4d3`

All four protected workflow families completed successfully at that exact head:

| Family | Run | Result |
| --- | ---: | --- |
| Verify CiM contracts | `35818590044` | PASS |
| WordPress Browser E2E | `35818589978` | PASS |
| WordPress Floor QA | `35818590055` | PASS |
| WordPress Playground PR Preview | `35818590143` | PASS |

Verify family evidence:

- Node 20: PASS;
- Node 22: PASS;
- release build: PASS;
- release reproducibility: PASS;
- terminal `CiM / Verify`: PASS.

Browser E2E evidence:

- Chromium: PASS;
- Firefox: PASS;
- WebKit: PASS;
- WordPress compatibility: 6.5.10, 6.6.7, 6.7.7, 6.8.8, 6.9.7, 7.0.4, and 7.1.1: PASS;
- PHP 7.4 and PHP 8.5: PASS;
- synthetic mount: PASS;
- ZIP install E2E: PASS;
- prior-to-current upgrade E2E: PASS;
- R34 lifecycle differential: PASS;
- terminal `CiM / Browser E2E`: PASS.

Floor QA evidence:

- WordPress floor: PASS;
- Plugin Check: PASS;
- terminal `CiM / Floor QA`: PASS.

Playground evidence:

- WordPress Playground preview: PASS;
- terminal `CiM / Playground`: PASS.

This is interim evidence only. R35 changes release bytes while the branch still identifies the artifact as 0.1.6, so these runs cannot serve as final release-candidate evidence. Final evidence must be captured again after the version transition and regenerated release artifacts.

## R35 acceptance gates

Before R35 can close:

1. F1 Browser E2E assertions pass in Chromium, Firefox, and WebKit.
2. The production Transport composition test passes on Node 20 and Node 22.
3. Existing Transport playback, complete learner-path, Runtime, renderer, schema, architecture, and reduced-motion suites remain green.
4. WordPress Floor QA remains green on the supported WordPress/PHP floor matrix.
5. WordPress Browser E2E remains green.
6. WordPress Playground remains green.
7. The changed release receives a new version identity rather than reusing published 0.1.6.
8. R23 supply-chain and reproducibility evidence is regenerated for the new release candidate.
9. Exact-head protected-gate evidence is recorded before merge.

## Deferred production-composition work

R35 records the production composition boundary; it does not silently add playback, buttons, rail, markers, scrub, or Commentary UI to WordPress.

A later checkpoint that adds any of those controls must update ADR 0044 and the executable production-composition gate in the same branch. Once WordPress exposes continuous playback, that checkpoint must add browser-level reduced-motion behavioral evidence on a renderer with a deterministic animated-settlement path.
