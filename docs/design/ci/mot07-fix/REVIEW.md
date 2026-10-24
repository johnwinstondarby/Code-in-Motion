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


## Caller evidence and bounded revision

PR #105's opt-in play-call observer captured two further original-signature failures in 150 constrained runs (148 pass, 2 fail). In both, initial play and learner resume are the only JavaScript play calls, and their promises resolve before completion. Native playback/rewind occurs afterwards without another JavaScript call. This rules out a new stale clock callback in those captures; internal WebKit processing remains opaque. See the complete caller evidence in the diagnostics PR. Its changes remain separate from this product fix.

ORDER-08 was committed red at b4ee288 before the bound: repeated unauthorized events caused more than two corrective seeks. The revised hold permits at most two corrective seeks, coalesces play/playing while one restore is pending, and then shows the existing unavailable fallback if the browser continues. A genuine new transition clears the budget and hold; stale restore callbacks cannot overwrite its state. Successful restoration changes no DOM or accessibility text and reports no new completion. The bound mutation is caught. No original test tolerance was widened.

### Additional tests and edits after red

- Added MOT-23 for Restart (progressing normally back to the GUI beat), Previous then Play, a jump to the preceding beat then Play, and a deep link to that preceding beat then Play. This respects the transport contract: navigation settles a destination, and Play starts the following beat.
- Added MOT-24: native late playback leaves session state, notifications, selected-tab focus and live-region mutations unchanged.
- The initial MOT-23 assertion polled a transient 0–0.5-second playback window. First matrix: Chromium 18/18, Firefox 12/18, WebKit 18/18. A fixed 36-case Firefox characterization gave 20 pass/16 fail. The same test against the original unfixed Motion source gave 25 pass/11 fail. Event records show playback starting at zero and ending before the polling window; this is not evidence of a candidate-only replay regression.
- Replaced that new transient-state poll with captured native play/playing milestones on the currently mounted video, requiring both to start within 0.15 seconds and the session to remain active at beat 3 without failures. The first event-based matrix gave Chromium 18/18, Firefox 17/18, WebKit 18/18. The Firefox failure occurred before replay, while waiting for initial completion: the test had advanced the virtual clock while media preparation still held it.
- Corrected new MOT-22/23/24 setup to wait for Motion's clock observation before advancing the fixture clock. This does not add a wait before MOT-07's existing check, change MOT-07, widen a tolerance, retry a test or alter playback source. All earlier results are retained.
- Updated the restoration/hold mutation anchors to match the bounded implementation, and added ORDER-08's bound-removal probe; no existing assertions were removed.

Current full verify: **1,091 pass / zero skips on both Node 20.20.2 and Node 22.23.2**. The earlier 1,089 counts describe the previous candidate. Latest new-browser matrix, constrained-load outcome, clean builds and exact-head CI are recorded below as they finish. The candidate remains **not ready to merge** until all proof gates and independent review pass.


Latest readiness-corrected browser matrix: **18/18 Chromium, 18/18 Firefox, 18/18 WebKit** (54 total, zero skipped/retries), covering all three sizes. The v1 differential remains 41 identical / zero different, with 28 intentionally excluded v2/non-JSON inputs. The six new scenarios are additional coverage, not substitutes for unchanged MOT-07.
