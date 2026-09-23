# R37 Localis 0.1.8 Production Validation QA

Status: Complete

Date opened: 2026-09-23

Date closed: 2026-09-23

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

R36 repository evidence proves that the production WordPress Space path can deliver `context.animate: true` and that effective reduced motion suppresses synthetic renderer animation frames. The historical Localis F4 finding remained open until the published 0.1.8 artifact was installed and the same behavior was observed on the live production composition.

## Deployment discipline

The production deployment used the established canonical procedure:

1. preserve a rollback copy of the currently installed 0.1.7 plugin;
2. record a pre-deployment live-format manifest of the installed plugin tree;
3. independently obtain the published 0.1.8 artifact and verify its ZIP SHA-256;
4. derive the expected live-format manifest from that exact artifact;
5. replace the installed plugin with that exact artifact without running uninstall;
6. verify the plugin remains active and reports version 0.1.8;
7. regenerate the installed live-format manifest and require exact equality with the expected 0.1.8 live-format manifest;
8. flush applicable WordPress/object caches;
9. perform live behavioral verification only after the invocation root reaches `data-cim-state="ready"` or the defined settle timeout;
10. retain rollback material through checkpoint closure.

R37 did not run the frozen Step 16 deactivation/reactivation lifecycle exercise and did not uninstall the production plugin.

## F4 live behavioral proof

The proof used the real Localis production WordPress composition and the learner-facing Space playback path introduced in 0.1.8.

A temporary synthetic Experience page was used because the synthetic renderer has deterministic animated settlement.

### Existing production Git surface

The production `git-basic-cycle` invocation on `/git-repository-practice/` reached `data-cim-state="ready"`, rendered `initial`, advanced by learner `ArrowRight` to `step-01`, and requested the versioned 0.1.8 release module tree.

Result:

`PASS Git: ready, initial -> step-01, live 0.1.8 module tree`

### Normal motion

With browser reduced-motion preference set to `no-preference`, learner Space entered the production continuous-playback path. A CiM-scoped animation-frame gate observed deterministic synthetic-renderer settlement through four controlled CiM frames before the final playback boundary.

Observed sequence:

1. root ready at `initial / A`;
2. Space starts playback;
3. first controlled CiM frame retains `initial / A`;
4. second controlled CiM frame settles `step-01`;
5. third controlled CiM frame retains `step-01` during the next animated settlement;
6. fourth controlled CiM frame settles `step-02 / C`;
7. no CiM animation frames remain pending.

Result:

`PASS normal motion: Space -> 4 controlled CiM frames -> step-02 / C`

### Effective reduced motion

With browser reduced-motion preference set to `reduce`, learner Space used the same production continuous-playback path and reached `step-02 / C` without requesting a CiM animation frame.

Result:

`PASS reduced motion: same Space path -> step-02 / C with zero CiM frames`

Combined production result:

`R37 LIVE PRODUCTION PROOF: PASS`

The evidence distinguishes production reachability from policy delivery. Both behavioral cases used the deployed 0.1.8 WordPress composition rather than a direct Runtime, Transport, or renderer test seam.

## Production checks

R37 acceptance results:

- published 0.1.8 ZIP identity retained as `ef19672f61420ba13b8d3b196bf7bb73aeaf8d73a19799535c594d24f9bf3c0c`;
- rollback copy of 0.1.7 retained at `/home/151445812/rollback-0.1.7`;
- pre-deployment 0.1.7 live manifest retained;
- expected 0.1.8 live manifest derived from the public release artifact;
- installed post-deployment manifest exactly equals expected 0.1.8 manifest;
- plugin active at version 0.1.8;
- `localis_cim_motion_policy` absent before and after live verification;
- object cache flushed after deployment and again after verification cleanup;
- existing production Git experience reaches `ready` and remains navigable;
- normal-motion Space playback proved live;
- effective reduced-motion Space playback proved live;
- temporary synthetic verification page moved to trash after evidence capture;
- no unexplained production residue identified.

## F4 closure rule

F4 required both of these conditions:

1. Localis runs the exact published 0.1.8 artifact;
2. live production-composition evidence demonstrates the expected normal-motion and effective reduced-motion behavior through learner-facing Space playback.

Both conditions are satisfied.

**F4 disposition: CLOSED.**

## Scope boundary

R37 introduced or modified no:

- release source bytes;
- plugin version identity;
- Transport buttons;
- semantic rail;
- marker activation;
- scrub interaction;
- Commentary UI;
- renderer theming or visual redesign;
- update-channel behavior.

The presentation/theming checkpoint may begin after R37 closure and can evaluate the verified 0.1.8 learner-facing production surface.

## Closure record

- rollback path: `/home/151445812/rollback-0.1.7`
- pre-deployment 0.1.7 live-manifest SHA-256: `ad5cbfd641819b2728173cd943e729d3ae997e99444daf57fb53641e3bfb43ce`
- 0.1.7 rollback manifest: 67 files, exact equality with pre-deployment live manifest
- published 0.1.8 ZIP SHA-256: `ef19672f61420ba13b8d3b196bf7bb73aeaf8d73a19799535c594d24f9bf3c0c`
- expected 0.1.8 live-manifest SHA-256: `1c45e58d957bb6794001c6a1fd8faac6aaef5fc4c19db137188b4019bde7b6b8`
- post-deployment installed live-manifest SHA-256: `1c45e58d957bb6794001c6a1fd8faac6aaef5fc4c19db137188b4019bde7b6b8`
- installed tree: 67 files; expected-versus-live manifest comparison PASS
- production plugin state: Code in Motion 0.1.8, active
- `localis_cim_motion_policy`: absent
- cache flush: PASS
- live Git experience: PASS, ready and navigable on versioned 0.1.8 module tree
- normal-motion F4 evidence: PASS, Space playback settles through four controlled CiM frames to `step-02 / C`
- effective reduced-motion F4 evidence: PASS, same Space playback path reaches `step-02 / C` with zero CiM frames
- temporary verification page: page 3413 moved to trash after evidence capture
- final F4 disposition: CLOSED
