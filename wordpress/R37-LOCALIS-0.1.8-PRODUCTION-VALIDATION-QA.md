# R37 Localis 0.1.8 Production Validation QA

Status: In progress

Date opened: 2026-09-23

Branch: `r37/localis-0.1.8-production-validation`

Base: `316017aaa1698cd1484643f4e4a4948bb7af13bd`

Published release: `0.1.8`

## Purpose

R37 deploys the published 0.1.8 artifact to Localis and closes the remaining production-only F4 verification item from R36.

R37 changes no Code in Motion release source. The 0.1.8 GitHub release remains immutable.

## Entering state

Protected `main` points to:

`316017aaa1698cd1484643f4e4a4948bb7af13bd`

The published 0.1.8 release targets that merge commit.

Published artifact identity:

- ZIP: `code-in-motion-0.1.8.zip`
- ZIP SHA-256: `ef19672f61420ba13b8d3b196bf7bb73aeaf8d73a19799535c594d24f9bf3c0c`
- R23 manifest SHA-256: `9f016db906454ea64ccda8101098bc8cdfc885b1351d812b1c0e4386c239380b`
- release tree: 67 files, 460,860 staged bytes

Localis preflight on 2026-09-23:

- WordPress: 7.1.2
- PHP: 8.3.33
- active theme: Hello Elementor 3.4.5
- WPVibe: 1.17.5
- Code in Motion: 0.1.7, active
- `localis_cim_motion_policy`: absent

R36 repository evidence proves that the production WordPress Space path can deliver `context.animate: true` and that effective reduced motion suppresses synthetic renderer animation frames. The historical Localis F4 finding remains open until the published 0.1.8 artifact is installed and the same behavior is observed on the live production composition.

## Deployment discipline

The production deployment uses the established canonical procedure:

1. preserve a rollback copy of the currently installed 0.1.7 plugin;
2. record a pre-deployment live-format manifest of the installed plugin tree;
3. independently obtain the published 0.1.8 artifact and verify its ZIP SHA-256;
4. derive the expected live-format manifest from that exact artifact;
5. replace the installed plugin with that exact artifact without running uninstall;
6. verify the plugin remains active and reports version 0.1.8;
7. regenerate the installed live-format manifest and require exact equality with the expected 0.1.8 live-format manifest;
8. flush applicable WordPress/object caches;
9. perform live behavioral verification only after the invocation root reaches `data-cim-state="ready"` or the defined settle timeout;
10. retain rollback material until R37 closes.

R37 does not run the frozen Step 16 deactivation/reactivation lifecycle exercise and does not uninstall the production plugin.

## F4 live behavioral proof

The proof must use the real Localis production WordPress composition and the learner-facing Space playback path introduced in 0.1.8.

A temporary synthetic Experience page may be used because the synthetic renderer has deterministic animated settlement.

### Normal motion

With effective reduced motion false:

1. the root reaches `ready` at `initial / A`;
2. learner Space starts continuous playback;
3. the page exhibits nonzero animation-frame-driven settlement before reaching the final boundary;
4. playback reaches `step-02 / C` through the production Space path.

### Effective reduced motion

With effective reduced motion true through browser preference or the site motion policy:

1. the root reaches `ready` at `initial / A`;
2. learner Space starts the same continuous-playback path;
3. no synthetic animation frames are required for renderer settlement;
4. playback reaches the same stable `step-02 / C` result.

The evidence must distinguish production reachability from policy delivery. Both paths must use the deployed 0.1.8 WordPress composition rather than a direct Runtime, Transport, or renderer test seam.

## Production checks

R37 acceptance requires all of the following:

- published 0.1.8 ZIP digest verified;
- rollback copy of 0.1.7 retained;
- pre-deployment 0.1.7 live manifest retained;
- expected 0.1.8 live manifest derived from the public release artifact;
- installed post-deployment manifest exactly equals expected 0.1.8 manifest;
- plugin remains active at version 0.1.8;
- `localis_cim_motion_policy` remains absent unless deliberately introduced for a temporary matrix case and removed afterward;
- cache flush completed;
- existing production Git experience still reaches `ready` and remains navigable;
- normal-motion Space playback proved live;
- effective reduced-motion Space playback proved live;
- any temporary synthetic verification page removed after evidence capture;
- no unexplained production residue introduced by the checkpoint.

## F4 closure rule

F4 closes only when both of these are true:

1. Localis is running the exact published 0.1.8 artifact;
2. live production-composition evidence demonstrates the expected normal-motion and effective reduced-motion behavior through learner-facing Space playback.

Repository evidence alone is insufficient for this production closure.

## Scope boundary

R37 does not introduce or modify:

- release source bytes;
- plugin version identity;
- Transport buttons;
- semantic rail;
- marker activation;
- scrub interaction;
- Commentary UI;
- renderer theming or visual redesign;
- update-channel behavior.

The presentation/theming checkpoint begins only after R37 closes so it evaluates the verified 0.1.8 learner-facing production surface.

## Closure record

To be completed after deployment with:

- exact rollback path or retained rollback identifier;
- pre-deployment 0.1.7 live-manifest digest;
- expected 0.1.8 live-manifest digest;
- post-deployment installed live-manifest digest;
- production plugin version/status result;
- cache-flush result;
- live Git experience result;
- normal-motion F4 evidence;
- effective reduced-motion F4 evidence;
- temporary-page cleanup result;
- final F4 disposition.
