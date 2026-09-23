# R35 Production Surface Hardening QA

Status: Closed for candidate freeze

Date opened: 2026-09-22

Date closed for candidate freeze: 2026-09-22

Branch: `r35/production-surface-hardening`

Base: `643b4bb4653d54fe0364259a709984d8e0b95f10`

The base is the protected-main R34 merge and the source of the published 0.1.6 release.

## Purpose

R35 follows the first controlled Localis production deployment of Code in Motion 0.1.6. The production session established four follow-up findings that were either presentation defects, verification-procedure gaps, renderer-scope facts, or production-composition limits. R35 resolves or records each item without expanding the WordPress learner-facing control set.

## Production findings and R35 dispositions

### F1 — Git renderer presentation inherited an unusable host color

On the Localis dark page field, `git/v1` inherited near-black text because `wordpress/assets/cim.css` supplied structural layout but no renderer surface colors.

R35 disposition: closed.

- `git/v1` now has an explicit bright instrument-panel surface independent of host-page text color.
- The presentation uses established Localis palette anchors.
- Browser E2E gates the computed renderer and lane colors.

Implementation commits:

- `11e13749c9da6d1fd9cc07225de6511fecddf40c` — host-independent Git renderer presentation.
- `fb6e70e3b613b4c05b98aab011e48f44f5a55189` — browser contrast assertions.

### F2 — browser deployment probes can snapshot before asynchronous mount settles

The production CiM request chain began after page load and an automated rendered-browser probe captured the valid static fallback before Host mount completed. Manual Chrome verification later proved that the same page reached `data-cim-state="ready"` with all CiM requests successful.

R35 disposition: closed as a deployment-verification rule.

A production browser probe must wait for `data-cim-state="ready"` or a defined settle timeout before judging renderer output. A DOM snapshot taken at the page load event is pre-mount evidence, not a mount result.

The repository Browser E2E already follows this rule with an explicit ready-state wait, so R35 records the requirement rather than adding a competing readiness mechanism.

### F3 — `git/v1` has settlement pacing but no intermediate visible animation

`git/v1` waits for injected animation-frame callbacks when `context.animate` is true and reduced motion is false, but it renders no intermediate visual state. The destination subtree replaces the prior stable subtree only at settlement.

R35 disposition: closed as documented renderer scope.

- The Git renderer contract now distinguishes delayed settlement from visible animation.
- Stable output remains identical between paced and immediate settlement paths.

Implementation commit:

- `866d25dc02b823858c9a2fc96cfb8151c69b8fdb` — document Git renderer motion scope.

### F4 — WordPress 0.1.6 composes only a subset of verified Transport capabilities

Production inspection established that `wordpress/assets/transport-binding.mjs` imports only the timeline keyboard binding and Transport controller. Playback keyboard integration, Transport buttons, semantic rail, marker activation, and scrub interaction exist as verified components but are not wired into the WordPress production surface.

As a result, the 0.1.6 production surface exposed no learner action that requests continuous playback and renderer `context.animate` remained false.

R35 disposition: closed as an explicit production-composition contract; the broader control set remains deferred.

- ADR 0044 records WordPress production composition as a separately verified contract.
- An executable test asserts the exact shipped Transport import subset.
- ArrowRight is proved through the command-only Transport path.
- Space is proved uncaptured by the WordPress production binding.
- Browser E2E repeats the Space-versus-ArrowRight boundary through the real WordPress surface.

Implementation commits:

- `5f159eb6ccd03d74b5f5a78a8701d9a2ec41698b` — production Transport composition gate.
- `aa0821c46c07eb665afd013d43828aa4240c457c` — ADR 0044.
- `b030aee36a1b112dbbc393f7b06431514f52ee4c` — WordPress browser assertion for the production composition boundary.

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

## Release identity transition

R35 changes WordPress release bytes through `wordpress/assets/cim.css`. The published 0.1.6 artifact remains immutable.

R35 advances the changed release to 0.1.7. The package version, package-lock root versions, root plugin header, WordPress implementation constant, `readme.txt` stable tag/changelog, and generated release-info projection are aligned at 0.1.7.

The R23 unit test was also changed to derive the release version from `package.json` instead of embedding 0.1.6 in path assertions.

## 0.1.7 implementation candidate identity

Implementation head:

`e6cb550908acf3d78eae17a40a9f1f2d648405b4`

Implementation tree:

`3ae54e54545d1a81547a46fdaae57a98f2059ead`

GitHub Actions evaluated PR merge ref:

`df6f507750e88c27436424849d830241e6b56a57`

The merge-ref tree is also `3ae54e54545d1a81547a46fdaae57a98f2059ead`, so the release evidence was produced from the exact implementation tree with no tree drift introduced by the PR merge ref.

Release build identity:

- version: `0.1.7`;
- pinned release Node: `22.23.2`;
- staged files: 67;
- staged bytes: 459,303;
- ZIP: `code-in-motion-0.1.7.zip`;
- ZIP size: 129,517 bytes;
- ZIP SHA-256: `c944ca731cff7d255222d970faec0ffc9bec9be496bf93f788020d6242d96050`;
- ZIP sidecar SHA-256: `2eee9bfb2b91c3a7d7988d3bb7e7bc69b8de61d5292bd61d948c3faf9d617c39`;
- R23 manifest SHA-256: `3fbe0df902dd3184af600815663641010534f7332e6f68af83cafc1fdf680ce0`;
- R23 manifest entries: 67;
- staged tree and extracted ZIP: byte-identical.

Reproducibility evidence rebuilt the release twice from a clean checkout state and produced the same ZIP SHA-256 on both builds:

`c944ca731cff7d255222d970faec0ffc9bec9be496bf93f788020d6242d96050`

GitHub Actions evidence artifacts:

- R23 supply-chain artifact ID `10733828650`, wrapper SHA-256 `3bc5fdab178f738f5e3cfe6bef8aa651e5007d0f0d3e8142a3eca29ae2ba3a64`;
- R27 Localis development artifact ID `10733753719`, wrapper SHA-256 `448f916026bcdcf84443ddbfad7c0559de8d139aceb48cf63025f9f53a2628ba`;
- R34 lifecycle differential artifact ID `10733174281`, wrapper SHA-256 `7fd8c3ccee37c267ee1cd87d7765901c83764b00114e61b2a005b2ead7fe18c6`.

The R23 artifact contains both staged-tree and extracted-ZIP manifests; both files have SHA-256 `3fbe0df902dd3184af600815663641010534f7332e6f68af83cafc1fdf680ce0`.

## Exact implementation-head protected-gate evidence

All four protected workflow families completed successfully for PR head `e6cb550908acf3d78eae17a40a9f1f2d648405b4`:

| Family | Run | Result |
| --- | ---: | --- |
| Verify CiM contracts | `35822500906` | PASS |
| WordPress Browser E2E | `35822500832` | PASS |
| WordPress Floor QA | `35822501019` | PASS |
| WordPress Playground PR Preview | `35822500844` | PASS |

Verify family evidence:

- Node 20: PASS;
- Node 22: PASS;
- R22 release metadata: PASS;
- R23 supply-chain manifest: PASS;
- release build: PASS;
- release reproducibility: PASS;
- terminal `CiM / Verify`: PASS.

Browser E2E evidence:

- Chromium: PASS;
- Firefox: PASS;
- WebKit: PASS;
- WordPress 6.5.10, 6.6.7, 6.7.7, 6.8.8, 6.9.7, 7.0.4, and 7.1.1: PASS;
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

## Acceptance closure

R35 candidate-freeze gates are satisfied at the implementation tree:

1. F1 Browser E2E contrast assertions pass.
2. The production Transport composition test passes on Node 20 and Node 22.
3. Existing Transport playback, complete learner-path, Runtime, renderer, schema, architecture, and reduced-motion suites remain green.
4. WordPress Floor QA remains green on the supported WordPress/PHP floor matrix.
5. WordPress Browser E2E remains green.
6. WordPress Playground remains green.
7. The changed release has a new version identity, 0.1.7.
8. R23 supply-chain and reproducibility evidence is regenerated for 0.1.7.

This QA closure is the documentation-only candidate-freeze change. After it lands, all four protected workflow families must run once more against the resulting final R35 head before merge. No implementation file may change after this closure without reopening the QA record and regenerating candidate evidence.

Final exact-head protected-gate evidence for the documentation-only candidate head will be recorded in the PR closure note rather than by changing this frozen QA record again.

## Deferred production-composition work

R35 records the production composition boundary; it does not add playback, buttons, rail, markers, scrub, or Commentary UI to WordPress.

A later checkpoint that adds any of those controls must update ADR 0044 and the executable production-composition gate in the same branch. Once WordPress exposes continuous playback, that checkpoint must add browser-level reduced-motion behavioral evidence on a renderer with a deterministic animated-settlement path.
