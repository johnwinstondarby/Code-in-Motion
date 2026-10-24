# Candidate fix for #103: retain the final frame after late native play

**Combined review in PR #106, targeting main.** Former draft #105 is closed without merging; its opt-in diagnostics and read-only, dispatch-only workflow are intentionally included here with the product fix. Main is 048eafb. No merge, version bump, tag, release or installation is authorized by this packet. Part B stays held pending review, approval and green post-merge main.

## Current candidate status (silent-rewind revision)

- Node 20.20.2: **1,093/1,093 pass**, zero skipped; Node 22.23.2: **1,093/1,093 pass**, zero skipped. Both complete verify logs are retained, not just the Node 20 result.
- New browser cases: **63/63**, all three engines and sizes, including native seek without any play/playing event.
- Old seven load failures: classified as pre-existing failure families and tracked in [issue #107](https://github.com/johnwinstondarby/Code-in-Motion/issues/107), with explicit control limitations below. They do not establish a new preparation/caption defect from #103's fix.
- Final-source constrained load: **150/150 pass**, 50 per size, no retries. Both unchanged-production controls reproduced #103; all raw earlier failures remain retained and #107 handles the pre-existing load families.
- Final-source WebKit mutations: **37/37 caught**, unit/browser baselines pass. Real silent-rewind and restore-removal probes are included.
- Reproducible Node 22.23.2 builds: plugin `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a`; authoring candidate `17921505f592602d4837f3512b0c1c0d54db98396d5f7252c4ecdf81a453a77f`, identical in two clean checkouts. Exact frozen-head build confirmation is posted in the PR after this packet-only commit.
- Three consecutive green WebKit CI jobs on the final frozen head: pending, recorded in the PR to avoid changing the head during proof.
- Manual diagnostic dispatch runs remain unperformed: GitHub requires the workflow on the default branch. Under the combined-review choice it becomes available only after this PR is reviewed, approved and merged. No unapproved main write is made to enable it.
- Main/release/production remain 048eafb / 1.0.1. Rollback ZIP and page 3227 capture remain unchanged.

Historical runs, including every failure, are retained below rather than relabelled as green. No existing deadline, tolerance, MOT-07 predicate or test retry was changed.

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


## Corrective-seek budget regression from bounded batch F

The bounded 150-case batch F finished **146 pass / 4 fail**: 1366 49/1, 1536 48/2, 1920 49/1. No retries. All four records/traces are retained. Three show preparation/readiness failures. The fourth (1536 repeat 2) completes Motion at the final frame, then harmless native play/playing at the already-correct final frame consumes the budget; a subsequent actual rewind exhausts it and removes the video via fallback. This is a candidate defect, not dismissed as a preparation failure.

Committed ORDER-09 red in f25a370: harmless final-frame events must not consume corrective-seek budget. Revised source now pauses but returns immediately if already at the final frame; only actual corrective seeks consume the two-attempt budget. ORDER-09 and all other eight ordering tests pass. Added a mutation removing this no-op guard. This is an additional red/fix cycle, not part of the earlier red run.

Earlier clean builds on 662177a were byte-identical (plugin d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a; authoring 96672d590ffa7745af2549fc8679df5aa4071b61cf778792efeb7d4bd8755883). **Those authoring builds are superseded by ORDER-09's source correction** and are not final-candidate checksums. The corrected candidate needs fresh clean builds. The 34-probe WebKit run describes the bounded revision before ORDER-09; the added guard requires a fresh 35-probe run.

A single new fixed 150-case batch G is planned for the changed implementation, with the same load and no retries; all F outcomes remain in the report. Full verification and browser/mutation checks are being rerun after this product change. No green-loop or CI gate is claimed early.


## Corrected load batch G

Same two-CPU/four-foreground/two-background-worker configuration, 50 cases per size; other local verification/browser processes also ran on the host, so this is a loaded correctness experiment rather than a performance benchmark. 1366: 47 pass/3 fail; 1536: 47 pass/3 fail; 1920: 49 pass/1 fail. The 1366 repeat 10 caption failure shows the video at its end while the virtual session remains active, before Motion completion. The six others show failed preparation and a missing video. None records the original settled-then-rewound predicate failure. All seven diagnostics, traces, screenshots and errors are retained under evidence/budget-load; every prior batch remains disclosed. This does not satisfy the requested full-loop green gate and does not resolve #103.

The caller finding, corrected bound, replay and side-effect coverage are ready for independent inspection in draft PR #106. Remaining load failures need assessment rather than retries until green. The workflow and product PRs remain separate, and Part B stays held until the approved fix is merged and main passes.


## Review follow-up: causal reasoning, fallback trade-off and PR scope

The caller evidence supports delayed native processing of an earlier legitimate play request: only initial playback and learner resume are logged, both promises resolved before Motion completion, yet the same video later resumes and rewinds. The [HTML internal play steps](https://html.spec.whatwg.org/multipage/media.html#internal-play-steps) seek a forward-ended resource to its earliest position before playback. This explains why pausing on the later event cannot preserve the frame. Restoring the promised completed state is the fix, not merely a hypothetical backstop. Attribution to delayed browser-side processing is an inference from calls/events; internal WebKit native stacks were not captured.

**Deliberate two-restore trade-off:** after two actual corrective seeks, a third unauthorized rewind shows “GUI recording unavailable” even though the beat previously played correctly. The completed session result remains unchanged. This gives the learner an explicit bounded failure instead of an untrustworthy frozen image or an unlimited browser/seek loop. Already-final events cost no budget; one restore runs at a time; genuine playback/navigation clears the hold and budget. ORDER-08 now also asserts that the fallback is visible after exhaustion (an additional assertion after the earlier red runs).

For a single coherent review, #105 is closed without merge and #106 targets main. Its scope intentionally includes test-only opt-in caller/identity observations, the optional manual investigation workflow (workflow_dispatch only, contents read), their tests/evidence and the product fix. No required gate is removed and no tests are retried to obtain passes.

## Load classification before the silent-rewind change

Two fresh 150-case controls completed first, with Node 22.23.2/Linux WebKit, CPUs 0,1, four foreground workers, two composition load workers and 50 repeats per size:

- Clean, unchanged main 048eafb: **147 pass / 3 fail**. Two original final-predicate rewinds; one missing-video failure at the final check. Clean tracked-tree status retained.
- Matched observer harness on byte-identical main production code: **147 pass / 3 fail**. Two original rewinds and one preparation failure (1536 repeat 44). Only three test/harness files differ; src/, wordpress/ and authoring/ have zero changes. This independently reproduces the preparation family without the fix.
- The caption family was captured in the earlier pre-fix batch B (1920 repeat 16). Commit 63ee6f9 has zero production-source/authoring/WordPress differences from 048eafb; that comparison is recorded. The fresh controls did not reproduce the caption failure. No matching failure-rate or statistical-equivalence claim is made, and historical extra host work is disclosed.

Those controls plus the retained pre-fix caption capture classify the six preparation failures and one caption failure as pre-existing families. Issue #107 records their real learner impact and requires measured production budgets before Part C. The fixture has both a 1,500ms verified-I/O cap and a 2,500ms preparation/final-frame budget. G's six preparation failures occurred about 2.44–2.48 seconds after observed active notification, consistent with that budget; the exact internal stage was not isolated. The caption failure sees an ended 1.2-second clip before the virtual session completes, so missed test observation must be distinguished from actual caption delivery. These findings are not dismissed as harmless fixture problems and no timeout is raised.

## Silent-rewind red/fix cycle and test edits

2e81de4 commits ORDER-10 red: without play/playing, a seeking/seeked/timeupdate observation leaves the completed video at zero. Nine prior tests pass, the new one fails. The implementation adds those three native events to the same bounded hold guard, with no new timer or engine/host capability. The test exercises each event independently, requires no play event and keeps the same settled result.

MOT-25 was added after that red run: on a real completed video, assigning currentTime=0 must produce a corrected paused final frame without a play/playing event and without a session change. This addition is not claimed to be in the original red run. It passes at all sizes/engines. Added unit and browser mutations removing the non-play event observations; no old assertion was loosened. ORDER-08's visible-fallback assertion was also strengthened after red as disclosed above.


## Final local proof before freezing the review head

The new-source batch (silent-load) passed **150/150**, 50 at each size, four foreground workers plus two composition load workers on CPUs 0,1; no retries. Other local test/build runs had finished before starting, matching the fresh control workload without the extra historical host work. The background composition run is load generation and is intentionally terminated when foreground testing finishes; it is not represented as a completed correctness suite. Every successful final-frame record has matching video identity and source at Motion completion/check; all 150 JSONs are archived with individual checksums. Earlier failed batches were not rerun to obtain this result: this batch tests the changed silent-rewind implementation after the recorded red/fix cycle.

Both full verify logs explicitly show Node 20.20.2 and Node 22.23.2, 1,093 pass each, zero skipped. The 63 new browser checks pass at three sizes in all three engines. All 37 Motion mutation probes are caught; individual logs and baseline results are retained. The plugin checksum remains unchanged, and the installed 1.0.1 rollback ZIP/capture are untouched.

The no-play regression covers seeks that emit seeking, seeked or timeupdate without play/playing. [HTML seeking](https://html.spec.whatwg.org/multipage/media.html#seeking) requires seek-related media events, including for discontinuous native position changes. This is event-based protection, not a claim to detect an engine that mutates currentTime while emitting no media event whatsoever; no polling timer was added.

This packet is frozen for the exact-head CI proof. Later CI/build results are recorded in PR #106 comments, keeping the reviewed head fixed. No merge or release is implied by local success; Daisy review and Johann approval remain required. #103 remains open and Part B remains held through approved merge and green main.
