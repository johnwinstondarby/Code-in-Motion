> Historical record for the no-package-cache experiment through 935a90a. The current proposal is [the authenticated package-cache packet](../webkit-package-cache/REVIEW.md).

# PR 102: bounded WebKit installation review packet

Base main: `3304428`. Infrastructure only, not Part B. Draft pending independent review and Johann's merge approval. Version remains 1.0.1; no release, tag or installation.

## Resulting behavior

- WebKit Ubuntu dependencies: first attempt and one conditional retry, each with an 8-minute GitHub limit. Browser archive: first attempt and one conditional retry, each with a 5-minute limit. Only the first attempts continue on error. The second failure stops the job.
- The single-attempt helper starts the pinned local Playwright command and kills its process group at 470/290 seconds, with up to five seconds for cleanup. This leaves margin within each outer step deadline. Logs and JSON records name the phase, attempt, result and elapsed time. Dependencies run under sudo so privileged descendants can be terminated; browser download/cache stays with the runner user.
- Exact cache key: Playwright 1.63.0 + webkit + runner OS/architecture + ImageOS/ImageVersion. Cache only `~/.cache/ms-playwright`, with no partial restore keys. An exact hit skips both browser-download steps entirely; dependencies still install. Pinned cache action commit is recorded in the workflow.
- No mirror rewrite remains. The old mirror-only run timed out during APT and reported zero files changed. Its correction for the runner's indirect mirror list was tested but not demonstrated beneficial. Diagnostic split head ccf4ccd succeeded on stock sources (APT 26 s; browser 5 s), without retry. We remove the unproven helper/tests rather than claim it fixed the timeout. Retained historical red/green logs describe experiments, not current coverage.
- Chromium/Firefox install commands and all existing test commands, deadlines, signature checks, required gates and job limits are unchanged. A unit test compares the entire normalized workflow against the base. No test step is retried.

APT attempts on 8bcb744 both returned timeout/124 after approximately 475 seconds, with no tests run. The log confirms the stock Azure HTTP archive; the cached browser was not the bottleneck. In response to Johann's instruction, a WebKit-only one-minute configuration step now writes exactly HTTP/HTTPS Timeout=30 and Acquire::Retries=3 before the dependency attempts, and asserts the exact effective values under sudo. The corrected zzzz filename sorts after the runner's zz-retries. The outer 8/5-minute limits and single workflow retry remain unchanged. Slow continuous transfers may still exceed the deadline; the three-run gate remains mandatory. No container change is included.

## Test-first record and edits after red

| Commit / experiment | Record and later edits |
|---|---|
| Original mirror tests | Historical red/green retained. Helper and all five mirror tests are removed from final scope because benefit was not proven. |
| 2a42062 tests + inert stubs; 5d1e765 red | Six tests fail meaningfully before split implementation 9922fb2. Two deadline-margin assertions were added in the implementation commit: strengthening beyond the original red record, not covered by that first failure. No assertion was removed. |
| 98cf095 / f697618 indirect-mirror red | Fifth mirror test fails before 5ee8fa0. Inline-comment case added in 3605417, recorded failing in 09c3a34, fixed in ccf4ccd. These are historical experiments; mirror code is removed. |
| 97e4d1c remove-mirror contract test | Workflow assertion deliberately changed from requiring the rewrite only on APT retry to forbidding it. `no-mirror-red.log` fails before 9ee1b3f removes the helper/tests. The first edit missed the differently indented retry invocation; both full verifies caught it (retained incomplete-removal logs). e6398b4 removes that remaining invocation, without changing tests. This is a scope correction, not merely a strengthening. Other five split tests are unchanged. |

The first frozen-head CI exposed a portability error in the new workflow test: GitHub uses a shallow checkout, so `git show 3304428` cannot resolve its baseline. The CI failure is retained. The baseline is now an exact checked-in copy of that workflow, read directly by the same test; comparison assertions and workflows are unchanged. No failing tests were rerun unchanged. This test-source correction occurs after the original red record.

A seventh test was added in c6961d5 after observing both real APT timeouts. It fails for the missing configuration step (apt-config-red.log), then passes after 72cb11a adds only that step. No earlier test changed in that commit. It requires the exact three directives, WebKit-only condition and placement before dependencies. After CI exposed the ineffective values, this seventh test was revised (6962dd0, then 8f1a0ac) to require a later filename and strict root read-back; both meaningful failing runs are retained before fa8bd17 implements it. The main-file append considered in 6962dd0 was never implemented; the runner source identified zz-retries, so the final implementation stays in apt.conf.d. No existing test assertion or deadline was removed.

The seven retained tests cover exact cache identity; success/elapsed logging; failed-command exit propagation and retry labeling; bounded stalled HTTP subprocesses with forced cleanup; attempt/deadline/cancellation limits; and whole-workflow isolation. Existing mutation suites run inside verify. Historical local CRLF parser failures are retained; normalization restored canonical LF bytes without changing the parser or its assertions.

## Full-duration failure proof

`stall-full.json` and `.log` run the actual pinned `npx --no-install playwright install --force webkit` against an accepting loopback HTTP server that intentionally never responds. The production browser timeout and cleanup budgets are used unchanged, in an isolated temporary browser cache. Attempts take **295,034 ms** and **295,023 ms**, both below the 300,000 ms step limit. Both return timeout/124; exactly one retry is logged and the second failure is terminal. Two requests reached the server. This is an intentional install-timeout demonstration, not a failed lesson test or a mutation catch. Quick proof is retained separately.

## Verification and artifacts

Full verification passes on Node 20.20.2 and 22.23.2: **1,073 tests each, zero skipped**, including existing mutation runners. Final logs accompany this packet. The v1 comparison remains **41 identical, zero differences**. Two clean builds at ccf4ccd on Node 22.23.2 match one another and the base; subsequent changes affect only CI helpers/tests/documents outside both fixed build lists.

- Plugin (99 files): `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a`
- Authoring candidate (128 files): `b84bfc2164fe56274033ca6bb618a000e0ae3d0bf61876ece13a87a90bcdc1cc`

No src/, wordpress/, authoring/, experiences/, schemas/, contracts/, package or lock metadata changed. The published 1.0.1 ZIP, page 3227 capture and rollback kit remain unchanged (rollback.json).

## Exact-head CI gate

After committing this packet, freeze the PR head. Require all ordinary checks and **three consecutive complete successful WebKit jobs on that exact head**. Record per-step timings, retry outcomes and cache hit/skip evidence in PR #102 and an external local proof kit; do not change the commit merely to name its own CI results. The diagnostic run on ccf4ccd does not count toward final-head proof. Do not rerun a failing test as an automatic recovery; diagnose it.

Main's historical run 39859585673 exhausted 30 minutes in APT on both attempts, before any CiM test. The dependent summary failed. A successful PR does not change that historical result. Part B stays held until approved merge and green post-merge CI. Future decisions remain 1.1.0-dev, pack-local media for 1.1.0, attachments in 1.2. No feature work is started.


## APT precedence correction and additional proof

The completed 6bdead3 log (apt-main-override-observed.log; filename reflects the initial hypothesis, not the proven cause) prints effective **15/15/1**, not 30/30/3. Both attempts then time out after 475,068 / 475,108 ms on the Azure HTTP archive. This is not a valid trial of the requested settings. Official runner configure-apt.sh, retained with its source link in DESIGN, identifies the later **zz-retries** file. Final configuration uses **zzzz-cim-webkit-network**, followed by sudo apt-config dump and three exact sudo apt-config shell assertions. Future overrides fail this setup step instead of silently using another policy.

An isolated root APT ordering proof gives 15/15/1 before, 30/30/3 after (apt-order.json/log); no real system configuration or package is modified. A separate accepting-but-unresponsive loopback download using APT with 30/30/3 returns failure/100 after **247.245 seconds**. Its eight HTTP requests occur roughly 30 seconds apart (APT retries within its transport as well as its acquisition layer; no four-request claim is made). The first local observation harness stopped at 180 seconds before that full retry sequence; its failure is retained. The completed probe has a bounded 300-second observation window and process-group cleanup. Neither changes a CI or test timeout. These are diagnostic experiments, not passing lesson tests, and do not establish that the live slow transfer was an idle connection.

Restart the three consecutive complete green WebKit jobs on the corrected final head. Inspect the actual root values and any APT timeout/retry messages in its logs; do not advance to the separately reviewed container option based on the earlier ineffective configuration.
