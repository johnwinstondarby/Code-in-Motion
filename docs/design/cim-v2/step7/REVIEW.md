# Step 7 Part A review packet

Draft only. Base main 7bba6c2, version 1.0.1. No merge, tag, release, installation or placeholder-pack/capture content. Independent review by Daisy and approval by Johann remain required.

## Design and scope

Design commit c29e9eb precedes implementation; see PART-A-DIAGRAM-CAPACITY.md. Limits: 12 locations, four artifacts per location, four wrapped lines per header/artifact/footer label, and 190px computed height at a 620px drawing width. Text is 12px monospace, 14px line spacing; it never shrinks to fit. Rows and box heights grow; any exceeded limit selects complete text with a visible accessible note. The same pure geometry decides the outcome and supplies the renderer. SVG and full text descriptions share complete capture-backed data, with flows/evidence kept. Arrows/tokens follow empty row lanes and an outside vertical gutter. The 160ms frame plan is untouched.

Only the fixture Engineering implementation and its composition CSS change shipped candidate source. Production WordPress, Core, Runtime, host, renderer/contract, frozen formats, session/model and bundled lessons remain untouched. The old composition ID mutation is retargeted to the relocated edge expression; its rule is unchanged. New tests/mutations are added to verify and the three-engine CI matrix. No download workflow change is made.

## Tests-first record

- c29e9eb: design before implementation.
- a0b6339: new unit/browser tests and validated generated capture fixtures before implementation.
- fa28630: recorded seven unit assertion failures and the browser assertion for the missing capacity note. Original fixtures remained unchanged.
- 99b8d2f: geometry/renderer implementation after recorded reds.

The original browser red fails on the expected fallback text (the status locator was still page-wide at that point); the later pane-scoped assertion is disclosed below. It covers the fallback-note case at 1366 in Chromium; it does not claim every added scenario failed in every browser. Unit red contains seven assertion failures, not missing-import crashes.

## Every test edit after those red runs

| Change | Reason |
|---|---|
| 95c5af4: scope role=status to the Engineering pane | The transport's output also has an implicit status role. Counting page-wide statuses confused the transport with the new capacity note. The expectation of one pane note is unchanged. |
| 95c5af4: use a failed relocation rather than published in the multi-row positive fixture | The longer published label legitimately wraps onto a second artifact line and makes the three-row canvas exceed 190px. The route test needs an example within capacity. All old assertions remain. |
| 0b36121: assert the exact Artifact ID: status prefix in full descriptions | A flow may mention an artifact whose state entry was omitted. This stronger assertion separately proves the complete state list. |
| 0b36121: synchronous counts for outcome SVG/note presence | Make deliberate-break detections immediate assertions, rather than relying on a missing-locator assertion retry deadline. Expected counts are unchanged. |
| 2f111e6: truncation unit probe selects CAP-06 | Its first unit probe mistakenly selected the boundary-only CAP-04 test, which does not check characters. CAP-06 already checked line preservation; no test was relaxed. Browser truncation remains checked by CAP-04's wrapped-label scenario. |
| 7ee4bde: add a unit assertion that tokens avoid node boxes as well as text | The initially unrouted token missed short label glyphs but would be hidden by their box. The browser hit test covers that visibility defect; the unit rule is now stronger too. |
| 8a7b7e0 / 6ba8652: require idle locations to be explicit in the description | A later completeness check found that idle locations were named without their idle state. This extra assertion was recorded failing before source correction 76131b0; both text and SVG alternatives now state idle explicitly. |
| 95e0555: retain measured browser element/ancestor bounds as JSON | Evidence instrumentation only; no assertions, scenarios, timeouts or tolerances changed. Final capacity cases are rerun in all three engines to produce the measurements. |
| 337dd6b: height-only fallback case and probe added after original reds | A nine-location transfer with the longer published status stays within every count/label limit but needs 204px. This independently tests the 190px height gate; removing just that check must fail, even while other capacity gates remain. |
| 4b7d11f: CAP-03 also checks the full host ID in each header label | The location ID and host ID share a header; both record-backed identifiers must independently survive wrapping. This adds an assertion without changing the scenario or limits. |
| 2cf51e6: mutation result metadata names the actual unit test tag | The truncation unit probe executes CAP-06 while its browser probe executes CAP-04. The JSON now reports that distinction; execution and assertions are unchanged. |

Fixture setup before the original red also learned the existing semantic limits: services max64 and records-per-beat max32, despite the wider structural capture allowance. The largest valid fixture therefore uses 64 locations and 128 artifacts, split into batches of 32 records, without altering validators. These are simulation-only generated fixtures, never edits to frozen lessons.

## Rule map and probes

CAP-01: nine locations / three rows / complete bounds. CAP-02: five artifacts fallback, four graphical. CAP-03: 100-character IDs preserved in labels and full text. CAP-04: within-capacity graphs, 12-location and wrapped-label boundaries, one-over fallbacks, and existing Run Custody. CAP-05: complete locations, hosts, artifact states (including absent), flows and SVG/text equivalence. CAP-06: character preservation and growing box bounds. CAP-07: multi-row routes, computed token bounds and actual on-screen mid-transfer hit test.

Eight failure modes are covered by ten browser probes: restore fixed geometry; remove capacity gate; remove the height-only gate; omit note; truncate labels; omit artifact descriptions; always fall back; hide slot overflow; hide SVG overflow; bypass routed token geometry. Seven of these also run as unit probes. Each mutation run first requires passing unit/browser baselines. Only assertion failures count; crashes, test timeouts, signals and syntax/reference/type errors are refused. Initial surviving probe logs are retained, with the corrections above disclosed.

## Verification and artifacts

Final counts, per-engine logs, screenshots, measured bounds, builds, frozen-scope comparison, v1 differential and rollback preservation are indexed in part-a-evidence/. Exact final-head CI belongs in the draft PR to avoid changing the reviewed tree merely to record its own CI status. Two clean pinned builds must match, with plugin SHA-256 d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a. The authoring candidate changes for the geometry/rendering/CSS source; no release is made.

Deferred: animation pacing, codec declarations, bounded coordinator trace, placeholder pack/real capture content, WordPress admission and download-retry/caching workflow changes. Diagram capacity must merge before capture content enters the placeholder pack.

## Current accepted source

Runtime source is frozen at 76131b0. Both pinned Node versions pass 1,066 tests, zero skips. The v1 differential remains 41 identical, zero different. Two clean builds match: plugin `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a`; authoring candidate `b84bfc2164fe56274033ca6bb618a000e0ae3d0bf61876ece13a87a90bcdc1cc` (128 files). The authoring checksum changes only for the private diagram geometry/rendering and CSS source. Complete browser/probe evidence is indexed below.

## Accepted local results

| Engine | Full suite | New capacity cases | Capacity probes | Existing transport / Engineering / Motion / composition probes |
|---|---|---:|---|---|
| Chromium | 176 pass | 27 | 7 unit + 10 browser, all detected | 34 / 15 / 30 / 21, all detected |
| Firefox | 175 pass, 1 skip | 27 | 7 unit + 10 browser, all detected | 34 / 15 / 30 / 21, all detected |
| WebKit | 175 pass, 1 skip | 27 | 7 unit + 10 browser, all detected | 34 / 15 / 30 / 21, all detected |

The one skip is the existing native-clipboard permission check, which is Chromium-only. There are zero skipped tests in either full Node verify run. The final integrated matrix includes the height-only case added later (176 total); earlier positive 173-case runs are not substituted for it. Browser code is identical to the final test instrumentation; the later host-ID assertion and mutation-result tag correction affect unit assertions/output only. Runtime remains frozen at 76131b0. Final exact-head CI also enforces the older full Player and lesson-pack mutation runners; CI status is recorded in PR101, without adding another commit just to name its own check result.

All supported sizes are tested at true pixel dimensions, without scaling: 1366x768, 1536x864 and 1920x1080. There are 72 screenshots and 72 geometry JSON records: the three primary cases, at-limit, one-over, height-only, existing custody and a genuinely mid-transfer token, in every engine/size. Measurements include every rect/text/path/circle SVG box, viewBox dimensions, actual SVG/slot rectangles and ancestor clipping intersections. They check geometry independently of screenshots, prohibit CSS concealment, and verify the token is the hit-test target. `measurements.json` and `screenshots.json` index them. `fixture-plans.json` records the pure plans and limits from validated generated placeholder bundles, including maximum effective semantic counts. No real capture or installable pack is created.

`part-a-evidence/summary.json`, the canonical verify/browser/mutation logs and builds.json are the accepted evidence. `historical-*` logs retain the initial missing-note status-selector confusion, the first fixture-height issue, and the two initially surviving unit probes. Original red logs and the additional idle-description red stay separate. No source test assertion was removed or widened; all scenario changes/additions are listed above. No recurrence of issue #98 was observed.

The published rollback checksums still match independently. No source under the frozen paths differs from base 7bba6c2; see source-scope.json. The exact finite frame-plan line also matches the base, so the 160ms pacing remains deferred.

## Reproduction

```sh
npm run verify
node tools/r42-v1-differential.mjs
CIM_PLAYER_BROWSER=chromium npx playwright test tests/e2e/wordpress-player-mvp.spec.mjs tests/e2e/lesson-packs.spec.mjs tests/e2e/lesson-preview.spec.mjs tests/e2e/teacher-admin.spec.mjs tests/e2e/multipane-transport.spec.mjs tests/e2e/engineering-pane.spec.mjs tests/e2e/motion-pane.spec.mjs tests/e2e/composition.spec.mjs tests/e2e/diagram-capacity.spec.mjs --workers=2
CIM_PLAYER_BROWSER=chromium node tools/check-diagram-capacity-mutations.mjs --browser
CIM_PLAYER_BROWSER=chromium node tools/check-multipane-mutations.mjs --browser
CIM_PLAYER_BROWSER=chromium node tools/check-engineering-mutations.mjs --browser
CIM_PLAYER_BROWSER=chromium node tools/check-motion-mutations.mjs --browser
CIM_PLAYER_BROWSER=chromium node tools/check-composition-mutations.mjs --browser
npm run build:wordpress
npm run build:authoring -- --candidate
```

Repeat browser/probe commands for Firefox and WebKit on Linux. Verify runs on Node20.20.2 and 22.23.2; builds use pinned22.23.2 in two separate clean checkouts. Runtime build source76131b0 differs from the final candidate only in tests, tooling and these unbundled review records. Final-head clean build confirmation is also recorded in the PR. SHA256SUMS hashes committed Git bytes; the downloadable review archive is built from those same bytes, without Windows checkout newline conversion. There is no release, tag, installation or merge in this task. The eventual merge tree must equal the independently approved final head.


## Daisy pre-merge checks (after dd4e71c)

Two browser assertions and two deliberate-break probes were added following Daisy's independent review. No runtime, CSS, fixture, existing assertion, timeout or tolerance changed.

- Every graph outcome now compares the measured screen width against its SVG drawing width (one decimal place); SVG font units alone no longer count as proof of readable screen size. CAP-M09 narrows the graph slot to 500px and must fail that assertion.
- Every text outcome scrolls the complete state to its end, confirms the end is inside the pane, and checks every overflowing ancestor permits scrolling. Laptop outcomes must actually overflow, exercising reachability rather than just DOM presence. CAP-M10 sets the diagram pane to overflow:hidden and must fail the long-ID case.
- During test construction, an initial assertion incorrectly required overflow even at larger screen heights where all text fits. It was corrected before the accepted run to require actual overflow at 768px and validate reachability at every height. The initial four assertion failures were setup mistakes, not runtime defects or mutation evidence. No previously accepted assertion was changed.
- The first narrowed-slot probe produced the correct 620px-versus-500px assertion, but its custom assertion message was not recognized by the existing strict mutation runner. The two new assertions now use standard Playwright messages; the runner and failure-detection criteria remain untouched. The initial probe log is retained as historical evidence.
- These are new regression assertions on already-correct behavior; no new implementation or red-to-green runtime change was needed. The new probes require assertion failures and reject crashes/timeouts, like the existing probes.

Review notes carried forward: overlapping transfer lanes when choosing later sample beats, and repeated polite announcements from a rebuilding fallback note. Both remain outside this test-only amendment.

Validation of this amendment is recorded in `part-a-evidence/premerge-*` logs. The capacity matrix remains 27 cases per engine, with 7 unit and now 12 browser probes per engine. Candidate runtime and ZIP contents are unchanged from dd4e71c. Final CI must pass on this amendment's exact head before merging; merging does not authorize a release or install.
