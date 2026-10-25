# Step 7 Part C review packet: WordPress admission and the production panes renderer

Draft PR #111 for **Pilgrim's independent review**. Author: Daisy, implementing while Pilgrim was offline at Johann's request. Daisy does not review or merge her own work; Johann approves after Pilgrim's review. Base `main` `7bc0ce6`. No version bump, tag, release, installation, media serving (Part D), lesson page or upgrade/rollback rehearsal (Part E).

Design: [PART-C-ADMISSION.md](PART-C-ADMISSION.md), committed first (`c5206cc`).

## Decisions taken (Johann may redirect)

1. **Development admission in WordPress**: only the exact `LOCALIS_CIM_DEVELOPMENT_ADMISSION === '1.1.0-dev'` wp-config constant, and only while `LOCALIS_CIM_PLUGIN_VERSION` is below 1.1.0. PHP projects it to the bootstrap and Admin scripts; pack data, page content and URLs cannot enable it. Admin shows a warning notice whenever it is on. In the browser, development admission is an issued identity object, never a string.
2. **Placeholder packs only in 1.1.0**: lesson, capture records and media must all be placeholder. "Recorded in the lab" cannot appear.
3. **Motion falls back in WordPress until Part D**: the Motion pane receives verified-media access with no bindings, so GUI beats show "GUI recording unavailable" with the text alternative. Local preview keeps real playback.
4. **The plugin ZIP changes**: 99 → 118 files, adding 13 multi-pane modules (`action-surface`, `admission`, `composition`, `controls`, `engineering`, `media-barrier`, `media-map`, `model`, `motion`, `motion-coordinator`, `motion-media`, `projection`, `session`), 4 multi-pane stylesheets, and the WordPress `panes-binding` and `panes-driver` modules.

## What changed

| Area | Change |
|---|---|
| `wordpress/lesson-packs.php` | `cim.lesson-pack/v2` branch: release-semver interval against the host (or the exact development target), `placeholder: true`, 1–256 listed files each confined by realpath and checked for exact size and SHA-256 (≤32 MiB), lesson must be compiled placeholder `panes/v1` with matching ID, capture must be placeholder `engineering-capture/v1`. Lesson and capture URLs carry their SHA-256. The cache fingerprint now includes every listed v2 file's stat identity and the development state. The v1 path and its messages are unchanged. |
| `wordpress/code-in-motion.php` | Shortcode adds `data-cim-pack-agreement` and `data-cim-pack-capture-url` for v2 lessons; the script tag carries `data-cim-development-admission="1.1.0-dev"` only when the constant is active. |
| `src/multipane/admission.mjs` | One boundary for Admin and Player: envelope, `panes/v1`, `engine_min` against an issued host identity, placeholder across lesson/capture/media, pack media form, Engineering records reproduce every state. Issues a token bound to the exact admitted lesson and Engineering text. |
| `src/multipane/model.mjs`, `engineering.mjs`, `composition.mjs` | Accept the existing fixture opt-in **or** a bound admission token; nothing else. |
| `src/multipane/media-map.mjs`, `motion.mjs` | Production `status: pack` form with a declared codec on every video copy (attachments refused with the 1.2 note); Motion probes `canPlayType` with the declared codec. Fixture maps unchanged. |
| `src/multipane/motion-coordinator.mjs` | Clock trace is opt-in (`traceClock`, set by the fixture harness) and bounded to 256 entries. |
| `src/multipane/engineering.mjs` | The capacity note is a live region only on the first drawing of a beat. |
| `wordpress/assets/panes-binding.mjs`, `panes-driver.mjs`, `bootstrap*.js/mjs` | Re-verify lesson and capture bytes against the projected SHA-256, admit, mount the composed Player with the token and real browser clock, apply deep links, dispose on detach/pagehide. The legacy Host receives a document view without panes roots. |
| `wordpress/assets/lesson-pack-admin.mjs` | v2 rows are checked through the same admission boundary. |
| `wordpress/assets/cim.css` | Panes roots keep the 1,350 px desktop composition and scroll inside the root instead of spilling past the page. |
| `tools/check-production-admission-boundary.mjs` | Shipped code (`src/`, `wordpress/`) cannot import `authoring/`, `harness/` or `tools/`, pass `testFixture: true`, or label data `fixtureOnly: true`. Added to verify. |
| `tools/pack-preview-client.mjs` | Preview passes the pack media form directly, so preview selects copies by declared codec as WordPress will. |
| `tools/build-wordpress-release.mjs` | Ships `src/multipane/*.mjs` and `src/multipane/*.css`. |
| CI | Installed-ZIP job: builds the placeholder pack, proves refusal on 1.0.1, sets the constant with `wp config set`, proves admission and the Admin notice, re-runs the v1 pack proof, then removes the constant and deactivates the pack. Browser job: static WordPress panes spec in all three engines plus the Part C mutation runner. |

## Tests first

| Commit | Record |
|---|---|
| `c5206cc` | Design before tests. |
| `aed221d` | 20 unit tests and 5 Chromium cases against inert stubs; `red-unit.log` (15 failing), `red-browser-chromium.log` (3 failing). |
| `10c7284` | Implementation. `red-admin.log` records the three Admin tests failing before Admin was implemented in the same working session. |
| `a272d42` | Containment: `red-containment-chromium.log` records PC-E2E-01 failing (page overflow 9 px) before the CSS fix. |

**Red runs that were not meaningful.** Against the stubs, PC-01/02/04/06/07 failed because the stub admission threw "Not implemented", not on their assertions. PC-03, PC-05, PC-PHP-04, PC-PHP-05, PC-E2E-03, PC-E2E-04, PC-B-03 and PC-ADMIN-03 passed vacuously (everything was refused or nothing was checked). They are guard tests; their protection is proven by the mutation probes below, not by the red run.

## Every test or probe change after its red run

| Change | Reason |
|---|---|
| PC-PHP tests stop overwriting the pack's `lesson-pack.php` | The generated file is manifest-listed; overwriting it broke its fingerprint, so every case was refused for the wrong reason. The real pack's own inert PHP carries the v2 header. |
| PC-PHP-06 writes different bytes when replacing the file | Rewriting identical bytes can reuse the inode and timestamp, leaving stat identity unchanged. This is a real limit of stat-based caching (same as v1); the browser re-verifies lesson and capture SHA-256 for that reason. |
| `composition.spec.mjs` passes `traceClock: true` | The trace is now opt-in; this fixture page reads it. |
| MP-20 inverted for packaging, plus a forged-token refusal | Part C deliberately ships the multi-pane modules; activation still needs a fixture opt-in or a bound token. Probe `MP-20-packaging` now re-excludes the modules and is caught. |
| Probe anchors retargeted: `CMP-09-choice`, `ENG-03-final`, `ENG-09-guard`, `MP-20-fixture-guard` | The guarded code moved (`copyMimeType`, `snapshot`, token-aware guards). Each probe still removes the same rule and is still caught. |
| `ci-webkit-install.test.mjs` frozen-workflow guard | Admits exactly the two named Part C workflow additions and asserts their content; every other job step stays frozen. |
| PC-E2E-01 strengthened (legacy separation) | Probe `PCM-22` (letting the legacy Host see panes roots) first **survived**: the assertion caught the ready state before the legacy Host's failure landed. The test now waits, requires no `[CiM]` host diagnostics and requires the panes root to stay ready. Re-run: caught. |
| Screenshots added to PC-E2E-01/02/03 | Evidence only. |
| `PB-M20-real-source` anchor retargeted | Preview now passes the pack media form directly, so the Part B probe's anchor line moved. The probe still swaps in different lesson text and is still caught. |
| PC-B-04 added | Covers the release-audit stylesheet allowlist added after CI's R23 failure (below). |

## First CI run failures and fixes

| Check | Cause | Fix |
|---|---|---|
| `release-build` (R23 supply-chain audit) | The audit refused the new `src/multipane/*.css` release inputs. | Approve exactly the four multi-pane stylesheets; PC-B-04 proves other stylesheet paths stay refused. |
| `plugin-check` | Plugin Check flagged the pre-built `$v2` attribute string in the Admin row `printf` as unescaped output (reproduced locally with WPCS 3.1.0 `WordPress.Security.EscapeOutput`; no other new finding against `main`). | The agreement and capture URL are escaped `printf` arguments, empty on v1 rows. |
| `zip-install-e2e` | The job's generated `r15-wp-env.json` makes the checkout dirty, so `build-placeholder-pack.mjs` refused to build. | The CI step builds the pack through `buildV3Pack` directly; the bytes are the same compiler output. |
| Browser jobs (`Prove v3 pack authoring and preview guards`) | The `PB-M20` probe anchor had moved. | Retargeted as above. |

No assertion, timeout or tolerance was loosened for any of these.

## Rule-to-guard map

Unit probes run in verify; browser probes run in each CI browser job. 23 caught locally (20 unit, 3 Chromium browser): see `part-c-evidence/mutations-chromium.json`. Crashes, timeouts, syntax and reference errors are never counted.

| Rule | Tests | Probe |
|---|---|---|
| Released host refuses 1.1.0 lessons | PC-01, PC-PHP-01 | PCM-01, PCM-17 |
| Development admission cannot be claimed or widened | PC-03, PC-PHP-03 | PCM-02, PCM-12, PCM-13 |
| Placeholder-only lessons, captures, media | PC-04, PC-PHP-05 | PCM-03, PCM-04, PCM-16 |
| Token bound to the admitted lesson and Engineering data | PC-06, PC-07 | PCM-05, PCM-06, PCM-07 |
| Declared codecs required and used | PC-08, PC-09 | PCM-08, PCM-09 |
| Bounded opt-in clock trace | PC-10 | PCM-10 |
| Capacity note announced once per beat | PC-11 | PCM-11 |
| Every pack file confined and fingerprinted | PC-PHP-04 | PCM-14, PCM-15 |
| Shipped code has no route to dev admission, fixtures or tools | PC-B-02 | PCM-18, PCM-19 |
| Admin uses the Player boundary for v2 | PC-ADMIN-01 | PCM-20 |
| Browser re-verifies projected fingerprints | PC-E2E-04 | PCM-21 |
| Legacy Host never sees panes roots | PC-E2E-01 | PCM-22 |
| Composition stays inside its root | PC-E2E-01 | PCM-23 |
| Admission replays every beat; a stored snapshot that differs is refused | PC-12, PC-ADMIN-04 | PCM-24 |
| Action tab follows the beat's sole action pane | PC-12 | PCM-25 |
| Waiting flags follow the beat | PC-12 | PCM-26 |
| Exactly the four supported panes with their IDs | PC-12 | PCM-27 |
| Explanation state equals the beat commentary | PC-12 | PCM-28 |
| Pack reads end at the 15 s deadline (response and body) | PC-14, PC-15 | PCM-30, PCM-31 |
| Legacy Host never waits for a panes download | PC-E2E-06 | PCM-32 |
| Panes roots mount independently | PC-E2E-06 | PCM-33 |
| Each Player has its own accessibility IDs | PC-E2E-07 | PCM-34 |

## Verification

Numbers below are for source commit `0ed52b0` (after Pilgrim's review round 1); the final head adds only this packet and its evidence. Round-0 numbers (`ef57760`: 1,157 tests, 23 probes, plugin `6e3c9a10…b6b8`) are superseded.

- Verify, Node 20.20.2 and pinned 22.23.2: **1,162 tests pass on each, zero skipped** (`verify20-summary.log`, `verify22-summary.log`).
- Other browser guards run locally in Chromium: multi-pane, Engineering, diagram-capacity and Part B pack runners all pass with every probe caught. Composition and Motion browser runners need H.264, so their results are CI's.
- v1 differential: 41 identical, 0 different, 28 skipped.
- Local browsers: only Chromium is installed here, and it lacks H.264. Its 9 failures in the composition/preview/capacity specs are **identical on unchanged `main`** (same test names). Firefox, WebKit and real-WordPress results are CI's.
- Real WordPress (wp-env) could not run locally: Docker Hub is blocked from this workspace. The installed-ZIP proof runs in CI.

## Builds (two clean checkouts, Node 22.23.2)

| ZIP | SHA-256 |
|---|---|
| Plugin 1.0.1 candidate, 118 files (was `d23af341…f876a`, 99 files) | `06453941aad5b73c7e600e4365c578a010e4f09078479effd9829f7fa5edeb40` |
| Authoring candidate, 156 files | `509a1411840fc4f39d06ca5e9f987f44492ac8971d3c5ae6bffd83d89c6ffe37` |
| Placeholder pack, 124,400 bytes (unchanged from Part B) | `8131e7f07d8481b3f2ea7289edc9ff49592cc9dfbc8b7724a45656cac597982c` |

See `part-c-evidence/builds.json`. The published 1.0.1 rollback ZIP (`95cdd84b…31d7`), page 3227 capture (`34ceed1c…f2ab`) and rollback kit (`3610987d…3148`) are untouched; `check:page-3227` passes in verify.

## Review round 1 (Pilgrim, on `0070985`)

Pilgrim independently confirmed 1,157 tests on both Node versions, matching clean builds and all 23 Part C guards in all three browsers, and asked to hold the PR for three findings. Tests were committed first (`bf8f1df`), red before any fix; fixes follow in `0ed52b0`.

| Finding | Red evidence | Fix |
|---|---|---|
| 1. Malformed lessons can show Ready: unknown pane types and missing Explanation states pass admission and fail at mount; conflicting actions and wrong action tabs pass. | PC-12: all 13 malformed projections admitted (`review1-red-unit.log`). PC-ADMIN-04: Admin says Ready (`review1-red-admin.log`). | New `src/multipane/projection.mjs`, run by admission (so by Admin and Player alike): exactly the four supported panes and IDs; every action valid for its kind and pane; at most one action and never CLI with GUI; then a replay of the compiled projection, requiring every stored snapshot's Console, Motion and Explanation states, action tab and waiting flags to equal it. Reasons name the beat and pane. PC-13 proves both compiled valid fixtures (run-custody, context-chain) are still admitted. |
| 2. One stalled download blocks healthy lessons. | PC-E2E-06: with one capture response held open, the healthy panes lesson and the legacy Python lesson never became ready (`review1-red-browser-chromium.log`). PC-14/PC-15: no read deadline (`review1-red-binding.log`). | Pack reads have a 15 s deadline that aborts the request and cancels a stalled body (`PANES_FETCH_TIMEOUT_MS`); page disposal aborts them too. Each panes root loads, admits and mounts on its own with its own lifecycle binding; the legacy Host no longer waits for panes downloads (previously `Promise.all` with a serial loop). |
| 3. Multiple Players reuse accessibility IDs. | PC-E2E-07: `composed-tab-*`, `composed-panel-*`, `composed-beats` duplicated. | `mountComposedPlayer` assigns each Player its own `cim-player-N` namespace. |

Notes for this round:

- **New 1.1.0 limit**: the composed Player binds pane IDs `console`, `motion`, `explanation`, `engineering`, so admission refuses other IDs with a reason. The compiler still accepts other IDs; both valid fixtures and the placeholder pack use these. Johann may prefer the compiler to refuse them too (a later, separate change).
- **Probe dropped, not loosened**: a candidate probe removing the explicit "missing pane state" check survived, because the replay comparison still refuses that lesson with a different reason. It added nothing, so it was removed rather than tightening PC-ADMIN-04 to fit it. Probe IDs therefore skip PCM-29.
- **Vacuous red avoided**: the first red for PC-14 was a missing-export `SyntaxError`; the test was rewritten to fail on assertions before the fix, and that run is the recorded one.
- I could not open Pilgrim's full written review from this workspace; these tests were written from Johann's summary of it and should be checked against Pilgrim's own reproductions.
- Mutation guards: **33 assertion-caught** in local Chromium (`review1-mutations-chromium.json`); CI runs the browser probes in all three engines.

## For Pilgrim's attention

- **wp-cli `config set` in wp-env**: the CI step assumes `wp config set … --type=constant` works inside the wp-env CLI container. If it doesn't, that step fails loudly.
- **The panes Player ignores `data-cim-default-theme`**: the composition keeps its own dark styling. Theme integration belongs with the Part E page review.
- **Deferred from Part C**: transfer pacing (own small PR before Part E); media serving (Part D); lesson page, small-screen GIF, true-size review and upgrade/rollback (Part E).
- **Theme content width**: at 1366 a typical theme column is narrower than 1,350 px, so the composition will scroll inside its root. Part E must decide the page template.
