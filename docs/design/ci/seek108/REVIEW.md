# Issue #108 — bounded final-seek recovery

Base: main 5847a59. Draft PR only; Daisy checks the final head and Johann approves any merge. No version bump, tag, release or installation. #108 remains open and Part C remains held.

## Defect and change

The recorded native seek to 1.2 seconds finished at 0.466826927 with seeking false. Motion correctly refused completion and fell back after its existing 2.5-second deadline. This is distinct from #103's completed-then-rewound signature. The underlying WebKit cause is not claimed known.

When a final seek has finished outside its destination tolerance and decoded data is ready, settleFinalVideoFrame now issues at most **two additional seeks**. Its original timer is created once and never reset. Exhausting the retry budget or deadline fails safely. Completion still requires seeking false, readyState at least 2 and the existing tolerance: 0.15 seconds for the initial duration target, 0.001 seconds for a recorded hold position. A valid final frame 33 ms short remains valid and is held/restored at the browser-reported position.

Re-seeks have their own local counter. They neither trigger nor consume the two post-completion restores from #106. An aborted playback, absolute settle, clear or dispose retires the pending final-seek controller; stale callbacks cannot retry or replace the next transition with a fallback. Reduced-motion settling uses the same cancellation result and schedules no animation frames. It never plays the video automatically.

Only src/multipane/motion.mjs changes in product code. No WordPress, Core, Runtime, host, contracts, media verification, fixture media or existing lessons change. Diagnostics and the MOT-07 test remain unchanged. The new MOT-26 browser fault double affects only its own video instance and is not enabled in load runs.

## Tests first and every post-red test edit

| Commit/stage | Record | Explanation |
| --- | --- | --- |
| 56b6203 | ORDER-13 through 17: five failures on unchanged Motion | Once-wrong landing, permanently wrong landings, short-position hold restore, four navigation cancellation reasons, and the original deadline. Fake finishSeek gains an explicit reported-position argument; setup exposes cancellation. |
| b8ab4ea | Initial retry/cancellation implementation; 17 order tests pass | ORDER-17 gains a done assertion at the original deadline before awaiting the result, so a timer-reset mutant fails an assertion instead of leaving a pending promise. The scenario/deadline is unchanged. Six new mutation probes are added after the first red run. |
| 4ccffd4 | ORDER-18 recorded failing | Cancelling a pending absolute hold settle could let its old catch show fallback during new playback. This is an additional regression, not claimed present in the original red run. |
| 58fa2e5 | ORDER-18 fix and mutation | Absolute-settle continuations are scoped to their playback intent. |
| 6c51de0 | ORDER-19 recorded failing | Reduced-motion final settling previously had no playback cancellation result. Additional coverage, recorded red before its fix. |
| 9ac4715 | ORDER-19 fix | Reduced motion shares the task cancellation path. A stronger assertion after the red run dispatches a late wrong seek and requires no new write. The prior assertions remain. MOT-08 mutation anchors follow the moved reduced-motion branch; its behavior/assertion is unchanged. |
| a6bf4eb | MOT-26 added after implementation | Actual session Restart, Previous, jump and deepLink during pending re-seeking at all three sizes. The four laptop cases fail on unchanged 5847a59 and pass with the fix. Original MOT-07 remains byte-identical. |
| MOT-26 double correction | navigation-double-failure.log retained | The initial blocked setter failed to report seeking true; legitimate native readiness events therefore used the second allowed retry, making the expected request count wrong. The corrected instance double reports a genuinely pending seek. All four controls were recorded red again; all four fixed cases then passed. No tolerance, timeout, retry or existing assertion was weakened. |
| MOT-26 deterministic setup | Added after the recorded browser red | Pause/reset only the fault-injected video before advancing the virtual clock, so native playback cannot finish first on a slow runner and bypass the injected final seek. All navigation and final-frame assertions remain unchanged; ordinary MOT-07 and load runs are untouched. |

The first full Firefox batch passed 147/148; MOT-26 deepLink at 1920 stayed active after its replay advance. The trace/screenshot are retained: context stubs remained at their begin state while the native video reached its end. The test waited only for video readyState, but the coordinator also waits for captions and holds the virtual clock during preparation. MOT-26 now requires native playback and a running shared clock **before** advancing virtual time. Its final completion predicate and all timeouts/tolerances are unchanged; no wait was inserted after that advance. This is a disclosed test-setup correction after red, not a product fix or a rerun of unchanged tests into green.

A subsequent Firefox batch had 143 pass / five MOT-26 readiness failures. The new instantaneous not-paused predicate itself was wrong: a planned 12-case diagnostic batch produced five passes / seven failures, and the failure snapshots show a replacement element at 1.2/1.2, ended true, captions ready, shared clock running, generation 4 active at its starting virtual time. Current native playback can finish before polling observes not-paused. MOT-26 now records the clock-event count before replay and requires a fresh running-clock notification plus ready video/captions. This proves the new transition started without requiring a transient playing state. The final settled/no-failures assertions remain; a direct final-frame predicate was added. No product code changed for either readiness correction. Failure logs, seven diagnostic JSONs, traces and screenshots are retained. An earlier planned 12-case debug batch used the same predicate but did not capture JSON because artifact collection failed before diagnostic setup; its log is retained separately rather than represented as instrumented evidence.

CI on 2f222d7 found a stale **CMP-17-seek-fallback** source anchor: the prepared absolute-settle guard now includes playback intent. The browser probe stopped with Missing probe target, not a caught mutation. Its from-anchor is updated to the new guard; its fallback-removal mutation, test, assertion and timeouts are unchanged. Unit-only verify did not execute this browser-only probe. The failed CI excerpt is retained.

Historical 5c1d48 CI also had a WebKit CMP-11 composition-mutation baseline timeout during page.goto waiting for load, before its assertions. Its exact cause is unknown. It is not claimed fixed by the readiness or anchor corrections, and is not labelled a reproduced #108 failure. The excerpt is retained; no timeout or retry is changed. Full final-head CI must pass.

## Rule-to-proof map

| Rule | Tests | Mutation |
| --- | --- | --- |
| One wrong landing then correct completion | ORDER-13 | ORDER-13-no-reseek |
| Two additional seeks maximum; safe failure | ORDER-14 | ORDER-14-unbounded-reseek |
| Wrong frame never accepted as completed | ORDER-13/14 | ORDER-13-accept-wrong-frame |
| Hold restores browser-reported position, with separate budget | ORDER-12/15 | ORDER-12 duration probes, ORDER-15-spend-hold-budget |
| Navigation stops old retry and next playback succeeds | ORDER-16, MOT-26 all four routes | ORDER-16-stale-reseek |
| Retry stays inside original deadline | ORDER-17 | ORDER-17-reset-deadline |
| Stale absolute settle cannot create fallback | ORDER-18 | ORDER-18-stale-fallback |
| Reduced motion cancels without animation scheduling | ORDER-19, existing MOT-08 | ORDER-19-ignore-reduced-abort and MOT-08-reduced |

## Proof plan and results

Both pinned Node versions pass 1,132 tests before the final browser/load evidence is added; zero skipped. The full local multi-pane/preview matrix has 148 cases per engine. All existing mutation runners remain in verify and the three-engine CI. Final results and exact artifacts are recorded below when complete.

The constrained comparison uses the same setup as #103: Linux WebKit, Node 22.23.2, Playwright 1.63.0, CPUs 0 and 1, four foreground MOT-07 workers, two background composition workers, 50 repeats at each of 1366, 1536 and 1920 (150 planned per source), zero test retries. Control product code is byte-identical to 5847a59; its added MOT-26 tests are not selected. The fixed batch follows serially after the control; unrelated local tests/builds finish before either begins. Every batch and failure is retained. A zero-failure control will be reported as failure to reproduce #108 in load proof, not as with/without proof of the fix.

The existing manual investigation workflow provides three **consecutive WebKit MOT-07 runs** on the frozen final head, 20 repeats per size / 60 cases per run, four workers and zero retries. Full three-engine browser suites and guards also run in the required PR CI. No failed test is rerun merely to obtain the sequence; a failure requires classification and is reported.

## PR #61 housekeeping

PR #61 at 8e5921e proposes a separate normative Git reference document and predates accepted ADRs 0048/0049 and 0061. Its document is not on main, so it is not accurate to call it already merged. It has been returned to draft to prevent accidental merge. Recommendation: close that stale PR while preserving its history, then audit any still-useful reference/copy requirements against current accepted documents in a separately reviewed change. It is not merged or closed as part of #108.

## Completed local evidence

- Node 20.20.2 and 22.23.2: **1,132 passed, zero skipped**, including all 36 Motion unit probes.
- Chromium, Firefox and WebKit: **148/148 local multi-pane/preview cases per engine**. Chromium's separate Motion browser mutation run catches **48/48** probes (36 unit + 12 browser). Firefox/WebKit browser mutation coverage is required in final-head CI, not claimed as a separate local result.
- v1 differential: **41 identical, zero differences** (28 v2/non-JSON entries intentionally excluded by the existing comparator). Frozen comparisons remain part of verify.
- Two clean Node 22.23.2 builds from a6bf4eb match. Later commits change only tests, probe anchors and this unbundled evidence. Plugin: `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a`. Authoring candidate: `15de8eaacf77f8f10ba96db8601a5f025a549a9c2937e8ebecdf45d78447bfed`. Compared with Part B's authoring archive, only `src/multipane/motion.mjs` differs. Exact published 1.0.1 rollback ZIP and page 3227 capture remain unchanged.

### Matched constrained load: limitation, not a reproduced #108 proof

| Source | 1366 | 1536 | 1920 | Total |
| --- | --- | --- | --- | --- |
| unchanged main 5847a59 | 49 pass / 1 timeout | 48 pass / 2 timeouts | 50 pass | **147/150** |
| fixed Motion | 48 pass / 2 timeouts | 49 pass / 1 timeout | 50 pass | **147/150** |

Both batches ran once, serially, with zero test retries. Each used two fixed CPUs (0,1), four foreground workers and two concurrent composition workers, 50 repeats per size. The composition process group was stopped when its foreground batch ended (exit 143); it was background load, not a passing correctness suite. Its full output is retained. Source heads, affinity and timings are in `evidence/load/*/environment.txt`, `run.json` and `summary.json`. The unchanged MOT-07 body is identical between control and fix.

**#108 did not reproduce in these load batches.** No case records a finished final seek landing away from its requested destination before completion. Thus the load comparison does not demonstrate a with/without cure; the deterministic red regressions and mutation guards justify the targeted fix.

Every failure has its diagnostic JSON, screenshot, error context and trace retained under `evidence/load`:

- Control `1366-case-45` and `1536-case-25`: Motion reports failed with no video during preparation, before any final seek; test subsequently times out waiting for readyState. Consistent with the preparation failures tracked in #107, not #108. Exact preparation subcause is not established by these records.
- Control `1536-case-48`: same video/beat/generation completes at 1.2/1.2, then WebKit starts it again repeatedly at zero. Two existing post-completion restores reach 1.2; a third rewind exhausts the deliberate hold budget and removes the video for the safe fallback. The test already observed valid completion, then times out locating the video for its SHA check. This is post-completion repeated-play/restore-budget exhaustion, **not** #108's pre-completion short seek. It is not claimed fixed here.
- Fixed `1366-case-12`, `1366-case-19`, `1536-case-05`: Motion reports failed with no video during preparation before any final seek, followed by a readyState wait timeout. These remain consistent with #107; not concealed as green or attributed to re-seeking. Production preparation deadlines still need measured treatment before Part C.

No load test was rerun to improve these counts. All 300 case records are catalogued; successful diagnostic JSONs are retained too. SHA256SUMS hashes committed Git blobs (LF-normalized logs), not potentially CRLF checkout bytes.

### Final frozen-head CI

After committing this evidence, the head is frozen for the required full CI and three consecutive manual WebKit MOT-07 runs. Exact final head and run links belong in the PR description, so posting results does not move the tested head. This packet does not claim those pending runs have passed. A failure stops the proof sequence and is disclosed; no assertion, deadline or retry is relaxed.

## Final-review correction: ORDER-20 restore flag retirement

Daisy found a regression introduced by the playback-intent scoping: an in-flight completed-hold restore could leave `restoring` true forever after `settle` advances `playRevision`. Its retired continuation correctly refuses to alter the new revision, but that also prevented the flag from being cleared. A later native rewind could remain at zero without restoration or fallback.

- **9d1ba8e (test first):** ORDER-20 completes a clip, starts a corrective hold restore, settles the same held clip before that restore finishes, then requires a later rewind to start another restore and preserve the held position. It covers both exact-duration and 33 ms-short decoded positions. The unmodified PR source fails at the required second corrective seek; identical test code passes against unchanged main 5847a59. Both logs are retained.
- **70ce77d (fix):** `settle` clears `restoring` immediately after advancing playback intent, just as `play` and `clear` already do. No restore budget, completion tolerance, deadline, caller authorization or stale-continuation guard changes. The new `ORDER-20-stale-restoring` mutation removes precisely that reset and is caught by ORDER-20.
- ORDER-20 is unchanged after its recorded red run. No existing test is edited in this correction. All 20 completion-order regressions pass.
- Verify passes **1,133/1,133 on Node 20.20.2 and 22.23.2, zero skipped**, including all **37 Motion unit probes**. Final CI runs 49 Motion probes per browser (37 unit + 12 browser), retaining the complete other suites.
- Two separate clean checkouts at 70ce77d build byte-identically on Node 22.23.2: plugin **d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a**, unchanged; authoring **1ef50cb8469adeaa3158a5d112de2812f7d4f05111309ad8741a8ee9d6a77b82**. Only bundled `src/multipane/motion.mjs` differs from the previous candidate. See `evidence/order20-builds.json` and both build logs. Later evidence-only commits do not affect these archives.
- The earlier constrained-load results remain explicitly historical at 39b7023; they are **not repeated** for this deterministic correction, as requested. Their disclosed failures remain on record, with no new claim of reproducing #108 under load.
- The corrected head is frozen after this evidence commit. New full three-engine CI and three consecutive targeted manual WebKit MOT-07 jobs (60 cases each, zero retries) are required; exact frozen head, final results and links are posted in PR #110 without moving that head. Prior 39b7023 greens do not count as new-head proof.

No merge, close of #108, version bump, tag, release or installation. Part C remains held for review and approval. PR #61 has now been **closed**, preserving its history, following Johann and Daisy's agreement; it was not merged.
