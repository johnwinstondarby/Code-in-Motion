> Historical record for the no-package-cache experiment through 935a90a. The current proposal is [the authenticated package-cache packet](../webkit-package-cache/REVIEW.md).

# WebKit dependency installation: recurring CI timeout

Base main `3304428`. This is a separate infrastructure change, not step 7 Part B. No merge without Daisy's review and Johann's approval. The post-merge gate stays red; Part B cannot start until the prerequisite is resolved. No version bump, tag, release or install; source remains `1.0.1`.

## Evidence

Both attempts of run `39859585673` exhaust the 30-minute job budget during Install selected browser for Playwright, before starting WordPress or any CiM test. Attempt1 is job `120106517762`; attempt2 is120152004277. GitHub explicitly annotates attempt2: The job has exceeded the maximum execution time of 30m0s. The logs show slow package downloads from http://azure.archive.ubuntu.com/ubuntu on Ubuntu 24.04, not an observed Ubuntu 26 failure. Attempt2 is still downloading package 85 when cancelled; attempt1 reached package 130. All other 31 checks pass; the dependent browser summary fails.

This satisfies Johann's condition permitting a separate download-timeout workflow change after recurrence. Do not broaden test deadlines, ignore failures, pin a different runner image, skip a browser or change the required summary.

## Revised installation plan (Johann's split-step request)

There are two phases: Ubuntu dependencies and the browser archive. GitHub kills a step at its timeout, so each phase has a distinct first-attempt step and one conditional retry step. Every dependency attempt has timeout-minutes:8; every browser attempt has timeout-minutes:5. Only the first attempts continue on error to allow that one retry. A second failure stops the job; test steps never retry. The existing whole-job30-minute limit and all test commands/deadlines remain unchanged.

A single-attempt helper logs phase, attempt, outcome and elapsed time. It bounds the child process group at470 seconds for dependencies and290 seconds for the browser, with at most5 seconds for forced cleanup, leaving margin inside the GitHub8/5-minute limits. Dependency attempts run under sudo so cancellation can terminate privileged APT descendants. Browser downloads run as the runner user so their cache remains in ~/.cache/ms-playwright. The CLI executes only the pinned local Playwright npx entry point; no arbitrary command/URL argument is admitted in production.

Restore only ~/.cache/ms-playwright with an exact key containing Playwright1.63.0, webkit, runner OS/architecture and ImageOS/ImageVersion. No restore-prefix fallback and no APT cache. A hit skips both browser-download attempt steps, and records that skip. Dependencies are installed on every fresh runner. Cache identity fails explicitly if the pinned version or image identity is missing or wrong.

No archive rewrite is retained. Historical logs establish slow APT downloads, but the old rewrite changed zero files and therefore proved no remedy. The diagnostic split run at ccf4ccd installed APT dependencies in 26 seconds and the browser in 5 seconds using the stock runner sources, without a retry. A later mirror-list correction was tested but never exercised by that run. Rather than claim an unproven improvement, remove the helper and its tests entirely. Both dependency attempts use unchanged signed runner sources. Future recurrence can be diagnosed from the separate phase logs without guessing the runner image or changing signature checks.

On 8bcb744, both stock-source APT attempts timed out after approximately 475 seconds, before any browser or CiM test. The retained log confirms http://azure.archive.ubuntu.com/ubuntu, not the main Ubuntu archive. It also shows slow ongoing package transfers, so this does not prove every timeout was an idle connection. Following Johann's next-step instruction, configure only the WebKit runner with Acquire::http::Timeout "30", Acquire::https::Timeout "30", and Acquire::Retries "3" in the fixed /etc/apt/apt.conf.d/zzzz-cim-webkit-network file before either dependency attempt. Read and assert all three effective values under sudo, the same privilege context as Playwright dependency installation. The runner writes zz-retries, which sorts after numbered files; the zzzz leaf sorts after it. A mismatch fails before any install attempt. The original runner file, main config and repositories are untouched. APT's per-connection retries sit inside each existing bounded attempt, not around tests. No repository URI, key, signature check, runner image or package list changes. APT timeouts cover connection/data inactivity; three green complete runs are still required before calling the repair ready. A container environment remains a separately reviewed fallback, not part of this change. See https://manpages.debian.org/bookworm/apt/apt-transport-http.1.en.html and https://manpages.debian.org/bookworm/apt/apt.conf.5.en.html.

Record structured attempt/cache results and a job summary; upload the small JSON evidence on success or failure. The required browser-family summary still fails on a terminal installation/test failure. Evidence distinguishes first-attempt failure followed by recovery from a completely green first attempt.

## Tests first and proof

Commit the revised tests and inert single-attempt/cache-key stubs, retain their meaningful assertion failures, then implement. Unit tests exercise successful and failed child commands, a deliberately stalled loopback HTTP download, one retry, forced process cleanup/cancellation, exact cache identity, and the workflow's independent step deadlines/conditional terminal failure. They also compare all existing test commands and limits and every non-WebKit job against the base.

Run a full-duration deliberate stall using the same production browser attempt budget: each of two requests connects to a local HTTP server that intentionally never replies. Each child must fail within5 minutes, the retry must be logged exactly once, and the second failure is terminal. This is an intentional timeout proof, not a browser-test failure or a mutation catch. Record the actual wall times and structured outcomes separately from the ordinary test suite.

Before any merge, obtain three consecutive successful complete WebKit jobs on the exact final PR head, retaining the per-step timings and cache status for each run. Reruns change neither the head nor tests. Record their proof in the PR and local review kit rather than creating a new code commit just to name its own successful CI result. Full Node20/22 verification, v1 comparison and unchanged ZIP/rollback checks still apply. Independent review and Johann's approval remain required; Part B stays held until an approved main merge has green post-merge CI.

References: GitHub's step timeout/continue-on-error documentation (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and the official cache action's exact-hit output contract (https://github.com/actions/cache).

## Feature work remains held

The Part B design draft is outside the repository. Johann's decisions are retained: `1.1.0-dev` development identity, pack-local media only in 1.1.0, attachments deferred to 1.2. No feature or version metadata is changed here. The published 1.0.1 ZIP, page 3227 capture and rollback kit remain intact. Resolving this draft still needs independent review and merge approval; it does not make the failed historical `3304428` check green retroactively.


## Precedence proof and corrected interpretation

The attempt on 6bdead3 did not test the requested 30/30/3 values: its non-root read-back printed 15/15/1 and the step only grepped for the keys, without checking values. Its two 475-second timeouts cannot be treated as a failure of the proposed settings. The official runner source at c87f6f636fffa43205bc05328efe9958af0f984f writes zz-retries (https://github.com/actions/runner-images/blob/c87f6f636fffa43205bc05328efe9958af0f984f/images/ubuntu/scripts/build/configure-apt.sh). The corrected late file and strict sudo read-back resolve that observed precedence risk; any future override stops configuration immediately. An isolated root APT experiment reproduces 15/15/1 with the old filename and 30/30/3 with the corrected filename. Review the actual completed CI log for effective values, package download activity and any transport timeout/retry messages before drawing a conclusion. Quietly slow but continuously progressing transfers do not prove an idle-connection timeout.
