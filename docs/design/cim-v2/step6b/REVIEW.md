# ADR 0061 step 6b — Motion pane review packet

Draft for Daisy’s independent review and Johann’s approval. Base `2f10626`; implementation and final test corrections through `fcf23d4`. No merge, version bump, tag, release or production installation. The post-merge checks on the base were green before work began.

## What is implemented

A fixture-only `motion/v1` adapter on the existing four-method pane contract; a restricted media resolver; exact-byte verification; a readiness barrier; and the explicit fixture media-map schema. The trusted coordinator owns clock holds. Motion receives no engine controller, Core, Runtime or host object. Its native decoder follows read-only scoped-clock observations. Ordinary step-5 sessions do not opt into this adapter or the new surface helper.

A clip and its caption track independently declare a pack-relative path or integer attachment ID, SHA-256, byte size and media type. Clips add duration and a text alternative. The fixture accepts MP4/WebM and WebVTT, with 4 MiB per clip, 64 KiB per captions track, 16 MiB total, 32 clips and 30 seconds per clip. These are deliberately small test limits, not production upload promises. Attachment IDs are resolved by the fixture only; there is no WordPress lookup or anonymous-access implementation.

The Node file preflight confines real paths, rejects outside symlinks and checks opened-file identity, size and digest. Metadata diagnostics identify a CIM rule, JSON path and fix. Existing `status: deferred` media maps remain empty with their old diagnostics; only a distinct `status: fixture` branch is added. No frozen v1/v2 source, lesson or evidence is edited.

## Exact-byte playback and future WordPress serving

Read [VERIFICATION-DESIGN.md](VERIFICATION-DESIGN.md). Its first version was committed in `32a9f6b`, before implementation. Later decoder findings are explicitly recorded in a separate closing section.

The restricted service resolves declared identities to fixed same-origin fixture routes. It rejects redirects, enforces bounded size, hashes the returned bytes with Web Crypto, and creates video and caption Blob URLs from those exact arrays **only after both checks succeed**. Native elements receive those Blob URLs, never the original address. Browser tests retrieve and hash the actual video Blob; mutations prove that returning the original address, omitting caption bytes or skipping digest checks is detected. Revision checks, cancellation and disposal prevent late results from repainting or creating live URLs.

The future large-file route is design only: stream a confined source into a private bounded spool while hashing; publish an immutable snapshot atomically after verification; serve full/range responses from that same verified snapshot. Never stream unverified bytes to visitors while discovering their digest. Revalidate the current authorized source before issuing a session, or require an equally strong immutable source version; mtime/filename/ETag are insufficient. Replaced/deleted attachments cannot silently reuse stale snapshots. Session expiry, revocation, storage quotas, publication races and source adapters require admission tests later. No server code is added here.

## Tests-first record

| Commit | Record |
|---|---|
| `32a9f6b` | Verification design committed before implementation. |
| `0253bd0` → `8ebe59d` | Six media-boundary unit tests against inert stubs; `red-media-unit.log` records six assertion failures. |
| `897b23e` → `ba5ae6e` | Browser tests committed before implementation; `red-motion-browser.log` records a meaningful Chromium/1366 failure for the missing Motion label. This is one red scenario, not nine combinations. |
| `02567ed` → `a74618f` | Four authoring-integration tests committed before schema/CLI integration; `red-authoring-media.log` records four failures. A Motion prototype already existed in the working tree at this later stage; this is not a claim that every implementation file was still inert. |
| `34938d1` onward | Implementation and the later test changes below. The red logs cover the original assertions only. |

### Every later test change and why

- Browser media changed from WebM to H.264/yuv420p MP4 after actual decoding checks. WebM remains a file-validator fixture. Windows WebKit advertises support but rejects the verified Blob even though the HTTP MP4 plays; Linux WebKit supplies the positive playback evidence. There is no original-URL bypass.
- Browser styling moved from inline CSS into the private fixture stylesheet. Added active, held and three failure screenshots at each true-size viewport. The default transport stylesheet and existing lesson view remain untouched.
- Caption assertions now inspect a real active cue as well as default/showing state; this strengthens the original scenario.
- Pause assertions wait for the pending seek to finish, then retain a 0.05-second stability tolerance over 120 ms. This corrects a decoder timing assumption rather than widening the tolerance. Linux WebKit exposed a real native-play-after-seek race; clock-authority guards fix it. Earlier failing logs are retained.
- Added manual Console selection during GUI playback and accessibility assertions for the hidden surface. WebKit cannot complete seeks under display:none, so the fixture keeps the decoder rendered behind the opaque selected Console panel, aria-hidden and inert. It stays within its slot and never takes focus. Final layout admission remains step 6c.
- Added separate tests for preparation holding peers, navigation during preparation, native playback trying to override pause, and Motion-only disposal. These are post-red coverage, not retroactive evidence for the original red run.
- The native-play probe now uses an explicit user gesture and observes a native play event before checking that pause wins within 400 ms, before the I/O fallback deadline. Programmatic play could be rejected by autoplay policy and mask the missing guard; `f7d1195` records the correction.
- The buffering test temporarily suppresses canplay delivery to hold a controlled decoder-stall condition, then releases readiness explicitly. A completely downloaded Blob can seek/decode immediately, so a bare synthetic waiting event was not a reliable stall. This is controlled decoder-event coverage; actual delayed preparation is tested separately by holding a real request.
- Unit additions cover late ignored-abort I/O, readonly capability boundaries, real/placeholder labels, an unprepared-play fallback, Unicode code-point limits against Ajv, caption size limits and resource revocation. No pre-existing assertion was removed.
- Authoring root resolution uses fileURLToPath instead of a Windows-specific pathname rewrite. The schema-keyword guard now includes anyOf/minimum/maximum because the new reference schema uses them; Ajv parity includes invalid cases and Unicode boundary strings.
- Caption fixture bytes are pinned to the committed LF form with a local binary-preserving attributes rule, so their fingerprints do not vary with checkout line endings. No caption wording changed.

### Mutation corrections and surviving early probes

An early timeout mutation left an orphan rejecting promise; a crash is not accepted as proof. The final probe cleanly removes deadline rejection, and the test checks bounded settlement. Caption-mode-only removal survived because the native default attribute restored it; the final probe removes both protections. Omitting preparation alone survived because buffering independently held the clock; the final rule probe removes both holds. Native-play guard removal initially survived due autoplay policy and the independent late-promise guard; the final probe disables both guards and uses the explicit-gesture test. These are rule-level probes of redundant defenses, not claims that every single-line variant failed. Syntax/reference errors and crashes are rejected by the mutation runner.

## Rule-to-test/probe map

U = `tests/motion-media.test.mjs`; A = `tests/motion-authoring.test.mjs`; B = `tests/e2e/motion-pane.spec.mjs` at all three sizes.

| Rule | Test evidence | Deliberate break |
|---|---|---|
| Safe identities, supported types, required fields and limits | U MOT-01; A11/12/13/14 | source, type, per-file/total limits, physical confinement/digest |
| Verified bytes only, including captions | U02/03; B07/09 hashes actual Blob and refuses corrupt input | original address, missing caption bytes, missing SHA check |
| Restricted fetch and pane capabilities | U04/15 | foreign resolver binding, leaked host, general network call |
| Bounded timeout, late cancellation and disposal | U05; B17/21 | deadline, late-copy guard, release omission |
| Preparation/readiness/user intent on shared clock | U06; B07/10/16/18 | readiness hold, user-pause reset, premature buffering completion, native guard |
| Default captions, real playback and final completion | B07 | captions disabled, completion omitted |
| Reduced motion | B08 | reduced-motion branch disabled |
| Missing/tampered/undecodable media fallback and peer completion | B09; U20 | fallback replaced, failure stalls, unprepared fallback omitted |
| Held final/failure with waiting note and manual switching | B07/09; existing transport comparisons | end-completion and failure probes above; step-5 hold probes remain in verify |
| Real versus placeholder labels and persistent badge | U19; B07/08/09 | real label substituted for placeholder label |
| Schema, CLI and reference-checker agreement | A11–14 and Unicode boundary case | schema/map opening removed, physical digest and confinement removed |

## Validation and builds

Final runs use Node 20.20.2 and pinned Node 22.23.2: **1,047 passed on each**, no skipped tests. This includes the new mutation checks. V1 differential: **41 identical, zero differences, 28 skipped v2/non-JSON cases**. The verify baseline checks frozen v1/v2 files and outputs/rejections unchanged, alongside step-4 pane and step-5 transport checks. The explicit v3 fixture media opening is the intended exception.

The full browser matrix passed: Chromium 125/125; Firefox 124 passed and one existing Chromium-only native clipboard test skipped; WebKit 124 passed with that same skip. All 24 Motion cases passed in each engine (72 total). All 30 Motion mutation probes are assertion-detected in each engine (20 unit plus 10 browser probes per run); each run first passes its unit and browser baselines. Final summaries and individual probe logs are in the evidence directory. The matrix includes the complete Player, lesson-pack, preview, teacher-admin, transport, Engineering and Motion suites. Motion contributes 24 cases per engine across 1366×768, 1536×864 and 1920×1080. Linux Ubuntu 24.04 uses pinned Node 22.23.2 and the installed Playwright Chromium, Firefox and WebKit builds. Unsupported native backends fail safely; Windows WebKit positive Blob playback is not claimed.

Two clean-checkout builds on Node 22.23.2 give identical files:

| Artifact | SHA-256 |
|---|---|
| Plugin 1.0.1 candidate, 99 files | `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a` |
| Authoring 1.0.1-candidate, 124 files | `c5268342eb710aba27c93b0f2628d424548b697e561eb910a425bd61019b998a` |

The plugin equals step 5/6a exactly. The authoring checksum changes intentionally: its import closure and source bundle include the new schema/validator/private Motion modules. V3 init/compile/preview/pack remain unavailable; validate is the only authoring entry point opened. Neither candidate replaces a published release asset.

Published 1.0.1 rollback ZIP remains `95cdd84b2d0cc8028ff94784a9087a865fc5381f72fb09c4faa9b8aaaa5b31d7`; saved page 3227 capture remains `34ceed1c2b7536f20dfa62fb841d629d5ff6aa12471f3984480c27601d93f2ab`. Existing rollback kit remains `3610987def6deda4285726575e444c6da20d8672f08a92db3e050b482b913148`.

## File scope and deferred work

- `src/multipane/media-*`, `motion.mjs`, `motion.css`: new private validation/access/barrier/adapter/style modules.
- `harness/motion-test-driver.mjs`: opt-in fixture coordinator and hidden-surface accessibility helper. Existing harness adds only an optional transition wrapper hook; default path is unchanged.
- `authoring/v3/*`, `tools/cim-author.mjs`: explicit fixture media validation, local file preflight and CLI dispatch; no v1/v2 changes.
- Tests, fixtures, mutation runner, package verify and the existing three browser CI jobs gain coverage. No runner image or job-count policy change.
- Review/design/evidence files only under docs.

No changes under `wordpress/`, Core, Runtime, host, frozen renderer contract, bundled lessons or production admission. No real lab footage is asserted: the committed clips are locally generated test patterns. The sample harness uses peer stubs; combining actual Engineering and Motion plus graphical canvas is step 6c. These screenshots prove fixture behavior, not the final educational composition or final video sizing.

Admin preflight, anonymous attachment permissions, portability warnings, upload-limit reporting, replacement/deletion/export/rollback, production media serving and pack admission remain deferred. Independent review and Johann’s approval are required before merge. CI must pass on the exact final draft head.

## Reproduce the checks

Use the pinned Node 22.23.2 for builds; also run verify with Node 20.20.2. Install the repository dependencies and Playwright browser/dependencies using the same setup as the existing browser CI job.

```sh
npm run verify
node tools/r42-v1-differential.mjs
CIM_PLAYER_BROWSER=chromium npx playwright test tests/e2e/wordpress-player-mvp.spec.mjs tests/e2e/lesson-packs.spec.mjs tests/e2e/lesson-preview.spec.mjs tests/e2e/teacher-admin.spec.mjs tests/e2e/multipane-transport.spec.mjs tests/e2e/engineering-pane.spec.mjs tests/e2e/motion-pane.spec.mjs
CIM_PLAYER_BROWSER=chromium node tools/check-motion-mutations.mjs --browser
node tools/build-wordpress-release.mjs
node tools/build-authoring-release.mjs --candidate
```

Repeat browser and mutation commands for firefox and webkit. The mutation runner requires passing unit/browser baselines, isolates its edits in a separate temporary checkout, and requires assertion failures for every probe. Build twice from a clean checkout and compare the ZIP bytes. Screenshots are in `evidence/screenshots/<engine>/`, including active, held, missing, tampered and undecodable states at all three sizes. `evidence/SHA256SUMS` covers committed evidence bytes, while `builds.json` records the candidate ZIPs kept in the local handoff folder.

## Daisy review correction before merge

Daisy approved head `15948de` subject to fixing null pack input. Commit `5778d6d` adds optional access at `value?.media?.status`, restoring the normal `CIM-V3-SHAPE` diagnostic at `$` instead of throwing. The added regression test was run first against the unfixed validator and failed with that TypeError; `evidence/step6b-null-red.log` preserves the result. This is an additional post-original-red test, not a change to earlier assertions.

Full verify now passes **1,048 tests on both Node 20.20.2 and Node 22.23.2**, including the mutation checks. Two clean-checkout Node 22.23.2 authoring builds match byte-for-byte: **`4176bf9781788f49266ee394884adb316511bcaf85004a42e0b261a5ec8562e8`**, 124 files. This supersedes the authoring candidate checksum in the earlier table; its logs remain historical evidence. No plugin inputs changed, so the plugin remains the step-5/6a bytes. Final exact-head CI is required before merge.

The following review notes are explicitly deferred to step 6c/admission: move the trusted coordinator from the fixture harness into a tested source module; retain hidden-video readiness/pause semantics; remove the duplicated placeholder label; decide how the learner sees diagnostic codes; size the video in the final layout; and tighten the fixture-media shape diagnostic so it cannot be mistaken for deferred media. Consider an optional WebM alternative alongside MP4 for browsers whose installed codecs cannot play H.264. None of these changes is included in this merge.
