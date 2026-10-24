# PR #104 revision: opt-in, external observations only

Base remains main `ea2f442`. This is diagnostic/test infrastructure, **not a fix for #103**. Johann reaffirmed that Part B remains held until #103 is fixed and main is green. No merge, release, installation or version bump.

The [original candidate record](REVIEW-7d3913b.md) and its evidence are retained as history. Its unconditional source rewriting is superseded by this revision.

## What actually failed on 7d3913b

Workflow 40006928485 / WebKit job 120597098737 failed at `MOT-02-original-address`, a **unit** mutation in `tests/motion-media.test.mjs`, before browser mutation probes. Both runner baselines had passed. The mutated run threw `CIM-PANE-MEDIA-UNAVAILABLE` from `motion-media.mjs:25` before reaching the intended Blob-URL assertion; the runner correctly rejected this as a crash rather than counting it as a caught mutation.

There is no rewrite-anchor exception, `Motion mutation baseline failed`, or `MOT-07_DIAGNOSTICS` failure line. Thus this failure is neither an observed MOT-07 recurrence nor evidence of a rewrite-anchor crash. The three retained lesson-test JSON records show successful final-frame checks. No causal inference about #103 follows from this unit failure.

## Diagnostics now leave the module untouched

- `CIM_MOTION_DIAGNOSTICS=1` is required. It is set only on the WebKit lesson-test step; other browsers receive `0`. No job-wide setting or mutation-step setting is added.
- Removed all source rewriting, routing interception, internal debug hooks and native setter overrides, even in diagnostic mode.
- Enabled diagnostics observe native media events and session notifications from outside. A session completion snapshot records the video state, including failures; the final assertion snapshot retains coordinator clock events. The bounded event history still reports dropped records.
- Disabled mode installs no route, init script, collector or prototype change and reads only the original MOT-07 predicate. Unit tests and ordinary MOT-07 browser checks enforce this.
- The final-frame predicate remains `ended || currentTime >= duration - 0.15`. No wait, deadline or retry is added. Enabled diagnostic I/O still follows the captured check.
- Failure traces, screenshots and JSON upload remain in place. The CI scope comparison permits only the exact new lesson-step environment entry, while continuing to compare every other original workflow field and command.

The external session snapshot can distinguish a playhead already short when session completion is announced from one that moves later. It cannot identify the exact internal final-frame promise boundary; this limitation is intentional, rather than rewriting the module under test.

## Unit fixture timing, separate from playback

The success-path media unit fixture used real asynchronous WebCrypto under a 30 ms artificial deadline. Holding the native digest response deterministically reproduces an unavailable error before the expected assertion. The CI log's generic catch does not expose the underlying rejection, so it does not prove exactly which operation consumed that run's time budget.

The fixture now injects a deterministic SHA-256 adapter based on Node's `createHash`, avoiding native-worker scheduling in byte-verification unit cases. It still hashes the actual bytes and preserves the existing 30 ms deadline. Production hashing, browser WebCrypto, media size/fingerprint checks and timeout tests are unchanged. The mutation runner itself is unchanged: setup failures still do not count as caught mutations.

## Tests first and subsequent edits

1. `2209529` commits three diagnostic regression tests before implementation. All three fail against that commit's old helper on pinned Node 22.23.2, with assertion failures. They require zero hooks in disabled mode, no rewriting/prototype override in enabled mode, and no artifact I/O for an ordinary final check.
2. Replaced the old injection-anchor test because source rewriting was removed; the new assertions supersede that implementation-specific check rather than dropping coverage of the disabled path.
3. `5f047de` commits the native-worker scheduling regression before the fixture change. It fails as an assertion on Node 22.23.2 while the native digest is deliberately held. The fixture-only SHA adapter makes it pass. This is not a product playback regression or a claim to reproduce #103.
4. Added ordinary-browser checks that no collector exists and the media setter remains native. Added external session observation in opt-in mode only.
5. Updated the frozen workflow comparison to assert and remove exactly the one new environment field before its existing whole-workflow equality check. No existing assertion, test command, timeout or mutation probe was removed or loosened.

## Verification

- Node 20.20.2 verify: **1,080 passed, zero skipped**.
- Node 22.23.2 verify: **1,080 passed, zero skipped**.
- Opt-in external-observer WebKit MOT-07: **three passed**, one per viewport.
- Default-off WebKit Motion browser mutation runner: **both baselines passed, all 30 unit/browser probes caught as assertions**. Its eight ordinary browser tests include the unchanged-source/native-setter checks.
- CI on the revised final head: pending. No failed-main job rerun or test retry is requested.

The earlier 150-case loop remains historical non-reproduction evidence with that candidate's instrumentation. It does not substitute for testing this revised observer or the eventual product fix. All application/release inputs remain unchanged; the two candidate ZIP hashes and the rollback kit remain the same as the original diagnostic candidate.
