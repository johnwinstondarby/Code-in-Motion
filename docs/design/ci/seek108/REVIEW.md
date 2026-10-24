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
