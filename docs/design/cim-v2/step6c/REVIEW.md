# ADR 0061 step 6c — composed fixture Player

Draft for Daisy’s independent review and Johann’s approval. Base `9db0421`, version 1.0.1. Source implementation through `d71fc58`. No merge, version bump, tag, release, WordPress admission or installation.

## Result and scope

The fixture now mounts the existing Console and Explanation pane implementations through explicit projections, alongside actual Motion and graphical Engineering adapters. One tabbed action surface sits above the two always-visible context cells and the existing transport. The recording label appears once in the shared action header, with persistent placeholder badges. Failure codes sit inside closed native Show details disclosures. The desktop composition has no stacked/phone mode: a 1366px viewport fits; below that the same layout scrolls.

`src/multipane/motion-coordinator.mjs` owns preparation/buffering holds and user intent. It receives a trusted driver factory; it imports no Core, Runtime or host. The harness is now a thin delegate. Default sessions and controls stay on their original path. The source composition uses `createConsolePane` and `createExplanationPane` unchanged, projecting the fixture’s simple lines/text into their frozen input contracts. No peer text stubs are used in the new composition.

The Engineering model still derives snapshots only from validated capture records. The SVG places capture service IDs as locations, capture artifact IDs at their recorded locations, and status words with distinct shape cues. Only actual transfers have arrows/tokens; same-location verification has no self arrow. Flow text comes first, full current state and flows are also in the SVG description, and evidence remains under Show evidence. An explicit, validated simulated fixture derivative stages the job at Git before its transfer to GPU. Neither the old context-chain fixture nor a bundled lesson is edited. Nothing is invented in the renderer.

Read [DESIGN.md](DESIGN.md) for the layout, trusted boundary, record model, codec selection and the later native decoder finding.

## Tests-first history

| Commit | Proof |
|---|---|
| `6768e1e` | Design committed before implementation. Its final implementation-findings section was appended later and is labeled as such. |
| `ca7a352` | Six new unit tests and the browser scenarios committed against inert composition/coordinator stubs. |
| `39f7d09` | Original unit run: five failures, one passing diagnostic-compatibility test. Original browser attempts are retained but stop during setup, not at behavior assertions. |
| `d0cb766`, `2d2acc7`, `1d6126e` | Correct the inert readiness signal, then isolate the layout test from the not-yet-supported dual-copy map. Both aliases in that layout-only map must use the old format. |
| `de7c29d` | Meaningful browser red: Chromium/laptop fails the assertion that composed Player markup exists. This proves one original scenario, not every later assertion or every engine/size. |
| `3614748` onward | Main implementation and the disclosed later test changes below. |
| `d441d8b` → `ab3b506` | A later WebKit investigation adds a deterministic pending-seek retirement regression and records its assertion failure before the retirement fix. |
| `fbef1f0` → `91c515a` | Extend that regression to a decoder still loading; retain the additional assertion failure before the next fix. |

The two early native-seek browser attempts passed: they did not reproduce the problematic loading/final-seek boundary and are not counted as red evidence. The later native retirement pause guard was likewise protected by a red assertion in `3bddc14` → `0a87eff` before `d71fc58`. Its self-clearing element handlers retain no pane/controller references. The retained native trace identifies the synchronous old-video load reset as the blocking point. The unit retirement red runs supply deterministic assertion failures; repeated real WebKit navigation runs establish the fix on the native backend.

## Every test addition or change after the original red runs

No existing assertion was removed or given a wider tolerance. Changes to scenarios and fixtures are distinguished from stronger assertions.

| Change | Reason |
|---|---|
| Layout-only map uses the existing single-copy format for both aliases | Pre-implementation setup otherwise rejected the new schema before reaching the intended missing-layout assertion. Recorded before implementation; earlier failed setup logs remain. |
| Undecodable fixture makes both copies undecodable, with matching fingerprints | Its original valid WebM correctly recovered from the broken MP4, so it was not a two-copy failure scenario. This corrects the fixture, not the retry rule. |
| Tampered WebM changes a valid container metadata byte while preserving size/decodability | Zero-filled media could fail native decoding even with hashing removed, masking an unchecked-copy bug. The changed valid stream makes the hash mutation meaningful. |
| B07 explicitly switches to Console during GUI playback, checks aria-hidden, inert, pointer exclusion and the single accessible tabpanel | Strengthens hidden-surface proof against the real composition. |
| B08 checks full position/tab/play intent across disclosure, keyboard focus, closing and held failure | Strengthens the original disclosure scenario. Delayed route abort cleanup catches an already-handled route; that Firefox harness exception was not a Player failure. |
| B09 inspects a real active caption cue | An early no-caption probe survived because video readiness alone did not prove captions. The cue assertion independently protects WebM captions. |
| B10 hashes the actual retry Blob, adds a decodable-but-tampered second copy, and tests tampered MP4 with valid WebM both with and without H.264 support | Proves retry verification and that fingerprint failure is terminal; unsupported-primary selection is a separate permitted route. |
| B11 enters the transfer by jumping to index1 then Play, waits for readiness and advances the shared test clock to frame zero | The earlier index2-then-Play scenario had already advanced to the next beat; an unadvanced virtual clock cannot show an animation frame. These are scenario corrections, not loosening. |
| New separate composition capture derivative and additional CMP05 unit case | The original capture has no inter-location transfer. New simulated records, validated through the existing v3 bundle/envelope proof, exercise a genuine record-backed arrow. Original fixtures stay untouched. |
| B11 adds shape/text cues, token hit testing, complete graph visibility on the four-row custody beat, direct context jump/hold and reduced-motion screenshots | Strengthens fidelity, visible motion and laptop readability proof. The hit test required routing tokens clear of node labels. |
| New B12 original-deadline test | Post-red coverage: both responses are delayed so a retry resetting the deadline would incorrectly succeed. The original deadline must produce fallback. |
| New CMP13 missing-record and CMP14 alternative-file/captions unit tests | Post-red coverage: reject missing records, and verify alternative files and their own caption digests during local preflight. |
| New CMP15 browser navigation test, then a seek-event trigger and retired-video pause assertion | Post-red coverage for the native race. Early attempts passed and are not red proof. Native responsiveness and paused retirement supplement the deterministic unit regression. |
| New CMP15 unit retirement test, later extended to loading readiness states | Each was recorded failing before its corresponding fix; both red logs are retained. |
| Reference-schema checks now reject the invalid examples as well as accepting the valid map | Strengthens agreement between the pure checker and the declared schema. |
| Existing Motion mutation targets move from harness to real coordinator, and its timeout target follows the unchanged deadline logic | No original rule or assertion is removed. The same step-6b tests now reach the source coordinator through the thin wrapper. |

Temporary trace statements were removed. The frozen session source is byte-identical to the base. Node24 was used in preliminary exploratory mutation attempts only; accepted verification, builds and mutation evidence use the pinned versions noted below.

## Initially surviving probes and corrections

- Merely skipping a missing record still caused later consistency checks to reject the corrupted capture. That is a redundant defense, not failed validation. The final probe deliberately fills the missing state from the claimed beat and removes the redundant guards, so accepting fabricated state makes CMP13 fail.
- Omitting WebM caption bytes initially survived a video-only assertion. The final test checks an active caption cue; the probe is now assertion-detected.
- An unsafe reset could block WebKit’s page itself, preventing an ordinary page query from returning. The browser test uses an external completion notification, while deterministic unit tests assert that no unsafe native reset is made. A hang/crash is never credited as a mutation catch.
- Early browser setup/navigation errors and retained incomplete runs are not counted as passing baselines or mutation detections. Accepted runs require a passing baseline and assertion failures for every deliberate break.

## Media contract additions

The existing `localis.cim/media/v1` fixture form gains optional `webm` per clip: source, SHA-256, size, type, duration and independent captions. A dual-copy clip requires primary MP4 and alternate WebM. Existing single-copy fixture maps, including the old single-WebM test maps, remain valid; deferred maps retain their diagnostics. Both copies and both caption declarations count toward 16MiB even when paths repeat. Durations must agree within 0.2s. `media.schema.json`, the mirrored pack definitions, pure validation and local file preflight all cover the addition. Fixture shape errors retain their own diagnostics through nested alternatives; the null-pack test remains intact.

Selection asks canPlayType before fetching and prefers supported MP4, otherwise supported WebM. The tests explicitly force H.264 unsupported; this is disclosed rather than claiming the installed Chromium lacks it. Actual VP8 WebM decode and captions are exercised. Only a verified copy’s native decode failure authorizes a second independently verified attempt. Hash, size or fetch failure is terminal. Both attempts share one preparation deadline. Native elements receive verified Blob URLs only. There is no original-address or unchecked-copy shortcut.

## Rule-to-test and mutation map

U = tagged tests in `tests/composition.test.mjs`; B = `tests/e2e/composition.spec.mjs` at all three sizes. Existing MOT, ENG and MP suites continue to run unchanged except for mutation target relocation.

| Rule | Proof | New mutation |
|---|---|---|
| Independent descriptors/captions, schema agreement | U01, U14; B09/10 | omit WebM captions; omit alternative file preflight |
| Combined total and duration agreement | U02 | count only primary bytes; drop duration comparison |
| Fixture/deferred/null diagnostics | U03, existing null regression | mislabel fixture errors as deferred |
| Source coordinator, readiness, user intent, cancellation and disposal | U04; all existing MOT browser cases now delegate to the real module | existing MOT preparation/buffering/pause/native-play/stale/disposal probes retargeted to source |
| Capture-only geometry and missing-record rejection | U05/13; B11 | self/invented arrow; silently fill missing records |
| No self-arrow wording | U06; B11 | restore login-to-login wording |
| Shared layout, one heading and hidden accessible surface | B07 | remove aria-hidden/inert; restore duplicate heading |
| Details initially closed and harmless | B08 | force details open |
| Codec selection before fetch | B09/10 | choose by order, ignoring canPlayType |
| Second-copy verification and captions | B09/10 | skip WebM fingerprint; omit WebM caption bytes |
| Text and shape status cues | B11 | remove both labels and shape symbols |
| Original retry deadline | B12 | extend/reset the deadline on retry |
| Nonblocking native retirement | U15, B15 and repeated B11 WebKit runs | force synchronous reset of pending/loading decoder |

Accepted mutation runs contain **18 assertion-detected probes per engine** (ten unit and eight browser probes), each after passing baselines. No syntax/reference crash counts as detection.

## Verification and builds

Final local verify passes **1,058 tests on each of Node 20.20.2 and Node 22.23.2**, with zero skipped unit tests; exact counts and logs are in evidence. Chromium passes 146 cases; Firefox/WebKit pass 145 with the existing clipboard skip. V1 differential remains **41 identical, zero different**. All frozen v1/v2 fixtures, outputs/rejections, bundled lessons, Core, Runtime, host, renderer contract and production WordPress files are unchanged. Default step-5 controls/session behavior remains protected by the complete existing tests.

The full Linux browser matrix includes Player, lesson packs, preview, teacher-admin, transport, Engineering, Motion and composition: **146 cases per engine**, including 21 new composition cases across the three sizes. Firefox/WebKit retain the existing Chromium-only native clipboard skip. Positive WebKit playback uses Ubuntu 24.04 with pinned Node 22.23.2. Screenshots include Console, Motion, hold, all four failures with details closed/open, reduced motion and moving/held graph at every engine/size. No width-dependent pane hiding or phone composition exists, so no narrow/stacked screenshot is claimed.

Two clean-checkout pinned builds are compared byte-for-byte. `evidence/builds.json` gives their complete hashes. The plugin must remain `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a` (99 files); it still excludes multipane code. The authoring candidate changes because its private source/schema bundle now includes composition, coordinator, surface, graph/media changes and CSS (128 files). Its SHA-256 is `5adf7fc9288edac162df0d3f8e4ef78971d887bbb449ec6da5678c6d612ced72`. It is not a release asset.

Published rollback ZIP remains `95cdd84b2d0cc8028ff94784a9087a865fc5381f72fb09c4faa9b8aaaa5b31d7`; page3227 capture `34ceed1c2b7536f20dfa62fb841d629d5ff6aa12471f3984480c27601d93f2ab`; existing kit `3610987def6deda4285726575e444c6da20d8672f08a92db3e050b482b913148`. Evidence records independent preservation checks.

## Deferred work and CI

No WordPress registration, discovery, Admin preflight, anonymous attachment access, serving/snapshots, portability or upload warnings are implemented. The placeholder pack remains step7, author docs/release candidate step8, real lab footage a later lab task. Fixtures remain visibly simulated. Issue98 is not changed; any recurrence must be identified separately from the new decoder-reset finding.

CI must pass on the exact final draft head. Merge waits for Daisy’s independent review and Johann’s approval; the eventual merge tree must equal that approved head. No merge is authorized by this packet.

## Final run notes and reproduction

The final Firefox full run initially missed the MOT18 native-start precondition once, before the pause assertions. No assertion or tolerance changed. Three isolated repeats and the complete serial Firefox rerun passed; both the failure and confirmations are retained. This is not issue #98. Accepted WebKit passes the full suite and every mutation baseline; the separate retirement/diagram repetition passes 12 cases. The earlier incomplete/failing browser runs are explicitly historical, not substituted for these results.

Plain `verify*`, `browser-*`, `mutations-*`, `build-*`, `builds.json` and `summary.json` name the finalized evidence. Prefix `step6c-*` logs preserve intermediate experiments and their historical checksums; those earlier build hashes do not identify the final candidate. All 126 screenshots are indexed with their actual pixel dimensions. The fixture uses a deterministic clock supplied by the harness (`advance`) while the coordinator/layout/panes are real source modules; production host clock/admission is deferred.

```sh
npm run verify
node tools/r42-v1-differential.mjs
CIM_PLAYER_BROWSER=chromium npx playwright test tests/e2e/wordpress-player-mvp.spec.mjs tests/e2e/lesson-packs.spec.mjs tests/e2e/lesson-preview.spec.mjs tests/e2e/teacher-admin.spec.mjs tests/e2e/multipane-transport.spec.mjs tests/e2e/engineering-pane.spec.mjs tests/e2e/motion-pane.spec.mjs tests/e2e/composition.spec.mjs
CIM_PLAYER_BROWSER=chromium node tools/check-composition-mutations.mjs --browser
```

Repeat browser/probe commands for Firefox and WebKit on Linux; use Node 20.20.2 and 22.23.2 for verify. The existing Motion/Engineering/transport mutation runners remain part of verify and browser CI. Build both ZIPs from two clean checkouts on pinned 22.23.2. `SHA256SUMS` in this directory hashes committed Git bytes, including evidence; the eventual exact-head CI result is recorded in the PR rather than editing this packet and triggering another CI head.
