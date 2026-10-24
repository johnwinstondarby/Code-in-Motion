# Candidate fix for #103: retain the final frame after late native play

**Combined review in PR #106, targeting main.** Former draft #105 is closed without merging; its opt-in diagnostics and read-only, dispatch-only workflow are intentionally included here with the product fix. Main is 048eafb. No merge, version bump, tag, release or installation is authorized by this packet. Part B stays held pending review, approval and green post-merge main.

## Current candidate status (silent-rewind revision)

- Node 20.20.2: **1,094/1,094 pass**, zero skipped; Node 22.23.2: **1,094/1,094 pass**, zero skipped. Both complete verify logs are retained, not just the Node 20 result.
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


## Final review follow-up: seven failures, harmless events and combined scope

**Why the seven earlier failures disappeared: unknown.** The 150/150 result does not prove the silent-rewind change fixed preparation or captions. Load variance is plausible, and historical batches also ran extra verification on the host, but that cause was not established. The fresh unchanged-production control reproduces the preparation family; the earlier byte-identical pre-fix production tree captured the caption family. Issue #107 stays open for the exact causes, actual learner impact and measured production preparation/caption budgets before Part C. None of the seven is removed from the record, and no timeout was increased.

ORDER-09 now explicitly dispatches play, playing, seeking, seeked and timeupdate repeatedly at the held final frame, requires zero extra seeks, then proves BOTH corrective seeks are still available without fallback. ORDER-11 checks each of the three added events during the next genuine playback round: no restore, no seek write and playback remains running. It also checks events during Motion's own final-frame seek (including seeked on completion), with no additional corrective seek, then proves both restores remain available. No production code changed in this follow-up; the 150/150 source and browser proof remain applicable byte for byte.

The first ORDER-11 run failed because its new assertion counted the entire clock-driven animation as one seek (19 writes versus an expected 11). Commit 446ceba preserves that test and log. The correction samples the write count at the start of the final-seek phase, retaining all assertions against event-triggered extra writes and budget use. It is a test construction correction, not a new product defect or a changed production implementation. All 11 ordering tests then pass. A new mutation removes the active/final-hold eligibility guard; ORDER-11 catches it as an assertion. This probe joins the existing 37; final CI runs all 38. The unit mutation suite and both full verify runs pass, with **1,094 tests each on Node 20.20.2 and Node 22.23.2**, zero skipped.

PR #106 includes #105's opt-in diagnostics and read-only, dispatch-only investigation workflow and targets main. #105 is CLOSED as folded in, not merged first. This is the combined-review option, not a fix-only diff. The three CI proofs start after the new test/evidence head is frozen; earlier-head successes are not counted. Main/release/installed version and rollback material remain unchanged. No merge before Daisy review and Johann approval; Part B stays held.


## Settled-position review correction (supersedes the old final-head proof)

Daisy identified different predicates: completion allows the last decoded frame within 0.15 seconds of duration, while the hold required a position within 0.001 seconds of duration. A browser landing 33ms short could therefore complete correctly and then consume restores on ordinary events. Commit e85a15f records ORDER-12 and its failing Node 22 run before the product change. The exact-duration iteration passes; the short iteration fails the no-extra-seeks assertion. That failing test is unchanged by the implementation.

The hold now records `video.currentTime` after the final-frame wait has resolved with `seeking === false` and decoded data ready, on the same element and playback revision. No frame position is calculated from frame rate or duration. Already-held comparisons use that browser-reported position; corrective seeks target that position and wait within 0.001 seconds of it. Initial completion retains the original 0.15-second duration tolerance. A genuine new transition or clear resets both the element and its held position. Absolute settling of the same completed asset preserves the recorded hold. The one-at-a-time and two-restore limits are unchanged.

ORDER-12 covers both exact-duration and 33ms-short browser landings. It repeats ordinary seeking/seeked/timeupdate events, requires zero extra seeks and no fallback, then proves both corrective seeks remain available after real rewinds. It checks the requested seek target as well as the reported resulting position, so merely seeking duration and landing short again cannot pass. Two new mutations restore the duration comparison and duration seek target independently; both must fail ORDER-12. Existing mutation anchors are updated to the new source without weakening their assertions. No existing test was edited after this red run.

Verification, browser, build and exact-final-head CI results for this correction supersede the earlier 47dbb43 proof and are recorded below / in the final PR handoff. The earlier evidence remains historical evidence, not three runs on the corrected head. Review and merge are separate: wait for Daisy's final-head check and Johann's explicit go-ahead. Part B stays held until #103 is resolved and main has a green post-merge run. No version bump, tag, release or installation.

The first full verify stopped at CMP-16 because its source-text mutation anchor still named `target.duration`; the renamed destination made the anchor absent. Its failed log is retained. Both CMP-16 anchors are updated to `destination`, preserving its original redundant-seek mutation and assertion. This is a mutation-runner maintenance edit after red, not a relaxed product test.


### Corrected-source results before final-head CI

Both pinned verify runs pass **1,095/1,095**, zero skipped: Node 20.20.2 and Node 22.23.2. All 28 unit Motion probes are caught, including both ORDER-12 mutations. The unchanged 45-case Motion browser suite passes independently in Chromium, Firefox and WebKit (15 checks at each of three sizes). No assertion, timeout, tolerance or test retry was changed. Two clean builds at dc9facf give identical plugin `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a` and authoring candidate `97e3cdf3f1d4dc3deb7e6175b758f298f35809fe51be777776137f93463d903c` (128 files). The rollback ZIP, page capture and kit hashes remain unchanged.

A fresh planned loaded batch on the changed source finished **149/150**, not green: 1366 50/50, 1536 49/50, 1920 50/50. No rerun was attempted. All diagnostics and the failed case are retained under settled-position/load. In 1536 repeat 30, the observed final seek requests 1.2 seconds at stamp 2799, but seeked reports 0.466826927 at 2816. Motion does not report a successful completion; it times out at stamp 5300 and the session records the motion failure. The test later times out waiting for the removed video. There is no completed hold before this failure, no budget exhaustion, and no settled-then-rewound check. It is a final-seek failure under load, before the position hold applies; its exact browser cause is unknown. The initial settle path uses the same destination and tolerance as before this correction. Issue #107 retains load/final-frame budget follow-up; this result is disclosed there rather than dismissed or retried to green. The earlier 150/150 experiment remains historical evidence on the earlier source, not a green load claim on this head.

All three exact-head CI proofs are still required; local results do not authorize merge. The new loaded failure must be visible to Daisy and Johann with the final handoff.
