# Candidate fix for #103: retain the final frame after late native play

Depends on diagnostic/workflow PR #105 at `63ee6f9`. Main is `048eafb`, all 33 post-merge checks green. This candidate is **not ready to merge**: further proof and Daisy/Johann review remain required. Part B stays held. No tag, release, installation or version bump.

## Observed cause

The [captured recurrence](../mot07-load/evidence/followup/1366-repeat6/motion-diagnostics.json) shows the same video marker and blob source, beat index 2 / generation 2. At Motion and session completion it is at 1.2/1.2 seconds, ended, decoded and paused. A later native play rewinds that same video; the final predicate reads 0.001853847. The existing unauthorized-play guard pauses it but does not restore its frame. This observed occurrence is a late rewind, not a replaced element or early final-seek completion.

## Smallest candidate behavior change

Remember which video successfully established a final-frame hold. Unauthorized native play/playing still pauses immediately; if it rewound that completed video, also restore its final frame through the existing bounded final-frame helper. Clear the hold on a genuine new play or media teardown. A play revision prevents an old asynchronous settlement from marking a subsequent transition as final.

No timing, tolerance, shared-clock policy, source verification, captions or renderer admission changes. Motion remains excluded from the plugin package. The authoring candidate bundle includes the changed source, so its checksum is expected to change.

## Tests first and edits after the red run

- `53e71f8` commits ORDER-06 before implementation. The recorded Node 22.23.2 run gives five passes and one assertion failure: expected final time 1.2, actual 0. The fake reproduces native play-from-ended rewinding before play/playing events. The earlier ORDER-05 fake only dispatched play, which is why it missed this behavior.
- Implementation makes ORDER-06 pass without a wait or changed tolerance.
- Added ORDER-07 afterward as a positive guard: a new transition must clear the previous final hold. The fixture exposes its existing clock/cancellation only to drive that case. This addition is not claimed to be part of the original red run.
- Added real-video MOT-22 afterward, at all three sizes, explicitly attempting native play from an ended verified clip and requiring an observed play event, a pause and the final frame. No original MOT-07 assertion was changed.
- Added two unit mutations (remove restoration; fail to clear the hold) and a browser mutation removing restoration. The latter reproduces the real-video assertion failure. The runner now includes the completion-order unit file; every existing probe remains unchanged.

## Local proof and remaining limitations

| Proof | Result |
|---|---|
| Node 20.20.2 full verify | 1,089 passed, zero skipped |
| Node 22.23.2 full verify | 1,089 passed, zero skipped |
| v1 differential | 41 identical, zero different; 28 v2/non-JSON inputs excluded by that comparison |
| Real-video MOT-22 | Three passed per engine: Chromium, Firefox, WebKit |
| WebKit Motion mutations | All 33 unit/browser probes caught as assertions; baselines pass |
| Before fix, C load batch | 148 passed / 2 failed: one #103 signature, one missing-video timeout |
| With fix, D load batch | 147 passed / 3 failed: three video-preparation/readiness failures at 1920; no captured #103 predicate failure |

C and D use CPUs 0,1, four foreground workers, two background composition workers, and 50 repeats at each size. D's per-size counts are 50/0 at 1366, 50/0 at 1536, 47/3 at 1920. Every run and failure is retained. D is **not** an all-green load-loop proof. No attempt is made to turn those failures into passes by increasing deadlines, waiting longer before the predicate, retrying tests or changing preparation behavior. The other load failures need characterization before the full-loop acceptance gate can be claimed.

## Builds and CI

Two clean Node 22.23.2 builds: pending.
Exact final-head CI: pending.
Three consecutive green WebKit runs on the final fix head: pending.
Three manual diagnostic workflow runs: not performed; GitHub returned 404 because #105's workflow is not on the default branch. Its reviewed and approved merge is needed first. After that, dispatch can target this fix branch.

#103 remains open. Main green alone does not unblock Part B. No further merge without Daisy's review and Johann's approval.
