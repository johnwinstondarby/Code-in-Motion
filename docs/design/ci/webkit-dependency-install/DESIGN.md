# WebKit dependency installation: recurring CI timeout

Base main `3304428`. This is a separate infrastructure change, not step 7 Part B. No merge without Daisy's review and Johann's approval. The post-merge gate stays red; Part B cannot start until the prerequisite is resolved. No version bump, tag, release or install; source remains `1.0.1`.

## Evidence

Both attempts of run `39859585673` exhaust the 30-minute job budget during Install selected browser for Playwright, before starting WordPress or any CiM test. Attempt1 is job `120106517762`; attempt2 is120152004277. GitHub explicitly annotates attempt2: The job has exceeded the maximum execution time of 30m0s. The logs show slow package downloads from http://azure.archive.ubuntu.com/ubuntu on Ubuntu 24.04, not an observed Ubuntu 26 failure. Attempt2 is still downloading package 85 when cancelled; attempt1 reached package 130. All other 31 checks pass; the dependent browser summary fails.

This satisfies Johann's condition permitting a separate download-timeout workflow change after recurrence. Do not broaden test deadlines, ignore failures, pin a different runner image, skip a browser or change the required summary.

## Narrow change

Before WebKit's existing Playwright dependency-install command, replace only the exact Azure Ubuntu archive root in the runner's standard APT source files with https://archive.ubuntu.com/ubuntu. Ubuntu's suite/components and Signed-By key configuration remain byte-identical. APT still verifies the same signed repository metadata and package hashes. No authentication or insecure flags are added. The browser version, OS label, Node version, install command, tests, mutation commands and 30-minute job limit remain unchanged. Chromium and Firefox use their existing steps.

Use a small Node helper supporting the standard Deb822 and legacy source-list forms, and only the known /etc/apt/sources.list.d/ubuntu.sources and /etc/apt/sources.list files. Do not modify comments, unrelated repository URLs, similar attacker-controlled hostnames, suites, components or signature settings. If neither file exists, fail explicitly; if neither uses Azure, report no change. The script is run only by the ephemeral CI runner under sudo, never against Johann's local workstation.

Tests precede implementation and exercise both source-file forms and the trust boundary. Record their assertion failures against an inert stub and list every later test edit. Then run full verification on both pinned Node versions, v1 differential, clean reproducible builds and exact-head CI. CI's existing full browser/mutation matrix remains the real installation check. The mirror change is a proposed remedy, not a claim that the upstream mirror is generally unavailable.

## Feature work remains held

The Part B design draft is outside the repository. Johann's decisions are retained: `1.1.0-dev` development identity, pack-local media only in 1.1.0, attachments deferred to 1.2. No feature or version metadata is changed here. The published 1.0.1 ZIP, page 3227 capture and rollback kit remain intact. Resolving this draft still needs independent review and merge approval; it does not make the failed historical `3304428` check green retroactively.
