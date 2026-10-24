# Issue #103: identity and constrained-load investigation

Base: PR #104 merged as `048eafb502b4eb36e4bcabe72c0a07485b73d950`. The merge tree equals reviewed `2fc1172`. No playback implementation change is proposed. Part B remains held until #103 is resolved and main has green post-merge CI. Further merges require Daisy's review and Johann's approval.

## Identity observations

The opt-in observer assigns each video a stable test-side WeakMap marker; it does not write attributes or modify prototypes. Both the marker and current blob source are recorded at the observed Motion promise completion and at the existing final check, together with session index and generation. Native media events carry the same markers. The fixture coordinator observes the original returned play promise and returns that same promise, without rewriting Motion or adding a wait before the check. Disabled fixtures use their original driver path.

The identity unit test confirms that different elements remain distinguishable even if they reuse a blob URL, and a single element keeps its marker when its playhead changes. Diagnostic I/O still follows the atomic predicate snapshot.

This is an external observation: the completion callback snapshots the Motion slot at the promise boundary, not private adapter fields. Native-event identities provide the preceding element history as well.

## First completion-order unit run, before any product fix

All five passed on Node 22.23.2 with a fake media element and deterministic clock:

| Case | Result |
|---|---|
| Pending final seek resolves after the initial check | Completion stays pending until seeked |
| Native seeked/ended before declared clock duration | No early completion |
| Pause/resume during final-frame settlement | Final frame preserved |
| A later absolute settle rebuilds Motion | Distinct old/new element and source; completed element remains final |
| Native play after completion | Guard pauses it; final frame preserved |

The rebuild test exercises the actual adapter's absolute settle operation with fake DOM/media. It demonstrates that an owner-triggered rebuild can yield a different element; it does not prove an unrequested rebuild occurred in MOT-07. None of these tests reproduces #103. Therefore there is no product failing regression, product fix or claimed race-restoring mutation yet.

## Linux WebKit load configurations

Node 22.23.2 / Playwright 1.63.0 / WebKit 2359 / Ubuntu 24.04 on WSL2. `taskset -c 0,1` constrains the foreground runner and inherited browsers to two logical CPUs. This limits CPU count, not processor speed; the host is not identical to a GitHub runner. Every configuration plans 50 repetitions at each of the three viewports, with four Playwright workers and no retries or assertion changes.

| Configuration | 1366×768 | 1536×864 | 1920×1080 | Outcome |
|---|---|---|---|---|
| A: two fixed CPUs + one CPU burner on the same cores | 50 passed | 50 passed | 50 passed | 150 passed, zero skipped |
| B: two fixed CPUs + two background composition-browser workers on the same cores | 47 passed / 3 failed | 49 passed / 1 failed | 49 passed / 1 failed | 145 passed / 5 failed; no skips |

For A, the shell itself retained affinity 0–23; the recorded command explicitly applies taskset to the workload and burner. For B, an immediate PID read raced taskset's exec, so a second read after exec is retained and confirms both active Node runners on CPUs 0,1. The background composition run is load generation and is intentionally stopped after the foreground run; it is not represented as a completed verification suite. Concurrent verification also creates host load; no performance benchmark is claimed.

## Manual GitHub workflow

`.github/workflows/mot07-investigation.yml` has only `workflow_dispatch`, no push/PR trigger. It runs only WebKit MOT-07: 20 repetitions per viewport, four workers, zero retries, 30-minute job budget. It reuses the reviewed pinned installation/cache/verification steps unchanged, and retains JSON reports, traces, screenshots and installation records. There is no required-check or gate change and no WordPress test environment to download.

The workflow unit test verifies the dispatch-only trigger, exact command, job limit and equality of the reused installation steps. Three manual runs are required; their actual status will be recorded, never inferred from local tests. No unapproved default-branch write is permitted to make dispatch available.

## Status

- Five ordering tests and two identity/workflow tests: passed on their first run; no playback fix made.
- Verify Node 20.20.2: 1,087 passed, zero skipped.
- Verify Node 22.23.2: 1,087 passed, zero skipped.
- Post-merge main CI: **all 33 checks passed on 048eafb**.
- Three GitHub dispatch runs: **not performed**. GitHub returned HTTP 404 because the workflow is not on the default branch. Daisy review and Johann approval are required before merging it; no unapproved default-branch write was made.
- Root cause: unknown. Part B held.

Report after the load and manual runs, or within two working days of the request, whichever comes first. If dispatch is blocked by the reviewed-merge requirement, report that explicitly rather than counting unperformed runs.

## Load failures and follow-up capture

B produced three video-readiness timeouts (1366 repeats 31–33), one missing-video locator timeout at the final check (1536 repeat 21), and one caption-cue poll failure (1920 repeat 16). All five traces, screenshots and error contexts are retained. They do not show the original end-predicate false assertion. No product cause is inferred from that difference.

A and B produced 295 successful final-check records. Every captured completion/check pair refers to the same element and blob source. The five failing cases produced no final-check JSON because they failed earlier or the video was missing; that is a limitation, not a claim those identities matched.

Added an enabled-only after-failure snapshot that can record a null video and session/event history without waiting for a locator. This runs after a test has already failed, leaving the original predicate and deadlines unchanged. Strengthened the disabled-path unit test to cover this hook. One additional **fixed 150-case** B configuration is planned solely to exercise this capture path; it is not a rerun to claim a green result. All earlier outcomes remain in the report. No playback implementation change.

## Confirmed recurrence in follow-up C

The fixed additional B-style batch finished **148 passed / 2 failed**: 1366: 49/1, 1536: 49/1, 1920: 50/0. No skips or retries. The 1366 repeat 6 case reproduces the original final-frame predicate failure. The 1536 case is a missing-video timeout, recorded separately. The batch is retained in full and is not treated as green.

The original-signature record shows the same video-1 and identical blob source, beat index 2 and generation 2 at both boundaries. Motion completion and session completion show currentTime 1.2, duration 1.2, ended true, seeking false, readyState 4, paused true. A later native seeking/play event rewinds that same element to zero; the final check reads 0.001853847 with ended false and no session failures. The unauthorized-play guard pauses playback but does not restore the final frame. This is a post-completion rewind, not a replacement element or early final-seek completion in this observed case.

The earlier fake late-play unit case did not model a native play from the ended state rewinding to zero. That gap must be filled with a deterministic failing regression before any product fix. The fixture-only observation branch does not change playback code. A fix and mutation restoring the bug will be prepared separately; three green WebKit fix-head runs and reviewed approval remain required.

Counts across A/B/C: **450 planned, 443 passed, seven failed**. Six failures are readiness/caption/missing-video outcomes; one has #103's exact predicate signature. Every configuration and first-run unit result is retained. The last failure-only logging addition was followed by targeted observer/order/workflow unit runs on both Node versions; full verify logs precede that observer-only addition. Final PR CI is still the authoritative exact-head check.
