# MOT-07 investigation — diagnostics only

Issue: [#103](https://github.com/johnwinstondarby/Code-in-Motion/issues/103).
Base: main `ea2f442b830e0423925968e1a2af39153967bdd2`, version 1.0.1.

## Disposition

This is **not a playback fix** and does not close #103. No cause is established. Part B remains held until a reviewed fix is merged and main has green post-merge CI. No merge, tag, release or install is proposed.

## Failed run

[WebKit job 120250917715](https://github.com/johnwinstondarby/Code-in-Motion/actions/runs/39903761679/job/120250917715), attempt 1, failed MOT-07 at 1920×1080. After progress became `settled`, `ended || currentTime >= duration - 0.15` returned false. The log records expected true / received false, without numeric playhead values. No browser trace or screenshot artifact was uploaded. Those missing values cannot be recovered or inferred reliably.

The retained installation artifact shows APT succeeded on attempt 1 in 35.939 seconds and browser installation in 3.389 seconds. Package cache was cold. The failed main tests have not been rerun.

## Package comparison

All 187 selected package versions and hashes match all three green PR #102 proof runs (workflow 39896899553, attempts 1–3). All 187 versions also match the last usable green main installation log: `7bba6c2`, workflow 39696385957, job 119567675749. This includes GStreamer and FFmpeg. The older main log records versions, not archive hashes; no old-main hash comparison is claimed. Immediate predecessor `3304428` timed out before tests.

No selected package-version difference explains the failure. This does not prove identical process timing or every aspect of the runner environment.

## Reproduction

Linux WebKit 2359, Playwright 1.63.0, Node 22.23.2, Ubuntu 24.04 on WSL2. Two workers, fixed planned repeats, no failed-case retries.

Final review-harness repeats: **150 passed, zero skipped, 50 per viewport**, with all 150 JSON records retained locally and a complete check/resolution summary committed.

Two preliminary 150-case loops passed. Those used temporary direct source instrumentation; a display label was inadvertently re-encoded in both the module and assertion, so they are not exact-UI comparisons. The final review harness preserves the original UTF-8 labels and instruments only Playwright's served response. Temporary production-file edits are removed; `src/` is byte-identical to main.

Neither early completion nor a later rewind has been established. Session `settled` can also include bounded pane failures, so diagnostics retain the failure list rather than treating that status alone as successful media completion.

## Candidate changes

- A test-only helper injects logging at six unique source anchors, refusing changed or duplicate anchors. It records finalisation start/resolution, completion results, pause correction, native media events and seek writes. Event history is capped at 512 entries with a dropped count.
- MOT-07 reads the same final-frame predicate immediately after the existing settled poll, together with session/clock/event data. Diagnostic file writing happens after the snapshot and cannot turn a failing snapshot into a pass. No tolerance, delay, timeout or retry changes.
- Motion tests retain failure traces and screenshots. A WebKit-only `always()` upload retains test results. Failure diagnostics also appear in the job log.
- A unit test protects injection anchors. Original CI test commands and installation steps stay unchanged.

Production code, lessons, WordPress, version and release build inputs are unchanged. Published ZIPs and rollback kit remain untouched. Reassess/remove diagnostic instrumentation when the real fix is ready for review.

## Test edits after investigation runs

There is no product-fix red-run claim.

1. Preliminary logging and attachments surrounded the unchanged final-frame predicate.
2. A JSON reporter retained the second preliminary loop's body attachments; the first line-reporter loop did not retain those bodies.
3. Direct source edits were replaced by test-scoped response instrumentation, with original UTF-8 labels restored.
4. Trace/screenshot options initially failed collection inside a describe block. The retained setup log records this. Moving those worker options to file scope corrected setup; this was not a playback assertion failure.
5. The final predicate and diagnostics now share one immediate browser snapshot. The tolerance remains 0.15 seconds, with no extra wait before reading the playhead.
6. Added the anchor unit test and WebKit artifact upload.

## Verification

- Node 20.20.2 verify: 1,077 passed, zero skipped, including existing mutation runners.
- Node 22.23.2 verify: **1,077 passed, zero skipped**, including existing mutation runners.
- Diagnostic harness smoke: three passed, one per viewport.
- Exact-head CI: PENDING.

A green diagnostic head proves evidence collection can run, not that playback is fixed. If CI reproduces the failure, compare final-frame resolution, subsequent seek/native events, completion result and assertion snapshot. Then add a deterministic red regression, the smallest fix and a mutation restoring the identified race. The three-consecutive-green proof applies to that eventual fix head.
