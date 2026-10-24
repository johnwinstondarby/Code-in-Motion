# Step 7B — v3 authoring and placeholder pack

Draft PR #109. Base: main `214c6a9` (PR #106 merged, all 33 post-merge checks passed). This is an authoring/pack step, not a release. No merge, tag, version bump or installation is requested before Daisy's review and Johann's approval. #108 remains a hard gate for Part C; #107 remains open.

## What changes

| Files | Purpose |
| --- | --- |
| authoring/v3/pack.mjs | Confined, bounded and fingerprinted input; Console producer checks; compilation into the unchanged v2 envelope; fixed PHP; deterministic pack and preflight. |
| authoring/v3/admission.mjs | Canonical stable interval checks; branded in-process 1.1.0-dev preview/test capability. Bare dev strings and forged objects refuse. |
| authoring/v3/production-media.mjs | Separate production media validation, per-copy codec/MIME checks, attachment diagnostic pointing to 1.2, restricted preview projection. |
| authoring/v3/{authoring,media,pack}.schema.json and validate/files/media-files modules | Add production branches without changing the preserved deferred/fixture branches; check file references, sizes, fingerprints and aggregate bounds. |
| tools/cim-author-v3.mjs and additive dispatch in cim-author.mjs | init/validate/compile/preview/pack for production v3 sources. Existing v1/v2 routes and diagnostics stay unchanged. |
| tools/pack-preview-* | Tools-only real-time preview from compiled/capture/media snapshots, shared transport and verified clip bytes. No test harness or test fixture imports. |
| examples/packs/run-custody-placeholder/ | Editable eight-beat source, modeled capture, raw evidence, two simulated GUI clips in MP4 and WebM, each with its own VTT. Committed media bytes make ordinary builds independent of FFmpeg. |
| tools/build-authoring-release.mjs and build-placeholder-pack.mjs | Include offline dependencies/template/docs; reproducible candidate authoring ZIP and lesson pack. |
| tests/pack-*, tests/e2e/pack-v3-preview.spec.mjs, check-pack-v3-mutations.mjs | Positive, malformed, unsafe and mutation proof; true-size screenshots and actual local preview. |
| workflow files and ci-webkit-install.test.mjs | Add preview/mutation checks and pack reproducibility; explicitly allow only these additions in the existing workflow freeze comparison. Existing commands remain checked exactly. |

No changes under wordpress/, src/, Core, Runtime, host, pane contracts or existing lessons. The frozen v1/v2 baseline and old v3 valid fixtures are preserved. Only new invalid v3 fixtures are added to represent the two new manifest rules.

## Version and media decisions

package.json remains 1.0.1. The development identity is explicitly 1.1.0-dev, granted only by the local authoring-preview/admission-test capability. No prerelease stripping or production host admission was added. Stable 1.0.1 refuses the pack; stable 1.1.0 can satisfy its declared interval, below 2.0.0, once the later host implementation exists.

Pack-local sources only for 1.1. Every video copy declares codec, MIME type, size and SHA-256; every copy has separately verified captions. Attachment sources are rejected with CIM-V3-MEDIA-ATTACHMENT and a fix naming 1.2. Pack preflight lists files/media/codecs, totals, version interval and either a checked host upload limit or an explicit unknown limit. Limit failure occurs before output is written.

The file list covers every payload except the manifest itself; the ZIP checksum covers the manifest too. Raw evidence and clip bytes are read from confined regular files, checked for changes while reading, and fingerprinted. Generated PHP is a fixed inert template; authored prose cannot become PHP.

## Tests-first record and every later test edit

| Commit | Recorded stage / later change | Reason and scope |
| --- | --- | --- |
| 5073417 | Design route before implementation | Records development identity, fixed payload and preview boundary. |
| be9fe97 | 14 core tests fail against inert stubs | core-red-node22.log. |
| e2fdca0 | PB-10 setup corrected; all 14 fail again before implementation | Positive admission must start from a valid built manifest, not an empty malformed object. Original assertions remain. |
| 5202702 | Core implementation | Core and prior schema tests pass. |
| e7942e2 | Four sample/public CLI tests recorded red | Added later phase, not claimed covered by the original core red. |
| b07ea6b | Sample/CLI implementation, inert preview | Actual media files and fixed template route. |
| 35fcf19 | HTTP and five browser tests recorded red against inert preview | Separate preview red record. |
| bdac4fe | Preview integration; PB-22 recorded red | Browser exposed that multiline authored commands cannot satisfy the existing Console contract. |
| e325f21 | Console producer guard and single-line sample commands | PB-22 green, preview green. No existing Console code changed. |
| 5a86056 | PB-23/24 recorded red | Manifest reference/aggregate cross-checks and visible actor labels. |
| d1f6a7f | Fixes for PB-23/24 | Two new invalid fixtures satisfy rule inventory; its intermediate failure is retained. |
| dcbe13d | PB-25, PB-26 and two PB-PREVIEW-04 cases added after implementation | PHP prose isolation, Ajv parity and same-size JSON tamper coverage. Not claimed present in earlier red logs. |
| dcbe13d | PB-11 positive build wrapped in assert.doesNotReject | Preserves all prior assertions; a lowered-minimum mutation must fail an assertion rather than crash. |
| dcbe13d | PB-03/04/05 gain direct bundle-diagnostic assertion | Initial placeholder mutation survived because a second pack layer rejected it. The new assertion proves the targeted layer independently. An intermediate mistaken return-shape access failed and was corrected before this commit. No production assertion removed. |
| 59f6ac2 | Existing CI freeze test explicitly permits new preview stage/spec | Full verify found its deliberate frozen-command comparison. New steps/command are asserted exactly before normalizing only those additions; all previous comparisons remain. |
| 18897d8 | PB-27 recorded red | Sixteen idle sockets exhausted preview's connection cap and a module fetch was dropped. Initial Firefox network-failure log retained. |
| d9e62d5 | Bounded cap 64 and PB-M21 guard | PB-27 green; no playback wait/tolerance changed. |
| ad6a9b2 / ae7a7be | PB-28 duplicate-key regression recorded red, then fixed | Pack parsing must reject duplicate JSON keys before object conversion; lesson, capture and media cases covered. PB-M22 restores the omission. |
| f5504f2 | UTF-8 labels/anchors and workflow working-copy LF corrected | Local/initial CI found a malformed mutation anchor after an editor encoding mistake. The guard aborted rather than counting a crash. No assertion or product validation weakened. |

All red logs remain under part-b-evidence/. Later validation and browser runs are additional evidence, never retroactively attributed to an earlier red run. No playback tolerance, test timeout or test retry was increased.

## Rule-to-proof map

| Rule / boundary | Unit or HTTP checks | Mutation |
| --- | --- | --- |
| Unchanged envelope, deterministic output | PB-01, PB-12 | PB-M10 |
| Placeholder declaration and honest GUI labels | PB-03/04 | PB-M01/02 |
| Capture references and actor distinction | PB-05/15/24 | PB-M03/15 |
| Verified media bytes, codec declarations, own captions | PB-02/06/07/16 | PB-M04/05 |
| Attachment sources point to 1.2 | PB-08 | PB-M11 |
| Confined files / unsafe paths and symlinks | PB-09 | PB-M06 |
| Explicit development admission / old host refuses | PB-10/11 | PB-M07/08/09 |
| Size, file list, aggregate/upload limits, no overwrite | PB-11/13/14/23 | PB-M13/14 |
| Fixed PHP, no authored executable text | PB-25 | PB-M16 |
| Existing Console input contract | PB-22 | PB-M12 |
| Public CLI and actionable diagnostics | PB-17/18, PB-PREVIEW-03 | PB-M20 |
| Schema parity | PB-26 plus existing Ajv/keyword tests | Existing schema checker probes retained |
| Host/Origin/method allowlist and immutable preview snapshots | PB-19/20/21 | PB-M17/18 |
| Verified compiled/capture bytes before mount | PB-PREVIEW-04 (two cases) | PB-M19 |
| Bounded browser/module connection capacity | PB-27 | PB-M21 |
| Duplicate source JSON keys | PB-28 | PB-M22 |
| Actual eight beats, hidden-video shared clock, true-size graph | PB-PREVIEW-01/02 | Existing pane/transport/composition guards plus new preview guards |

## Deliberate boundaries and limitations

This local preview supports the placeholder starter's pane IDs. It validates and compiles actual authored data, then supplies the existing restricted model's fixture-only opt-in through tools-only code. It imports no harness/test fixture. The media adapter projects the production map to the unchanged pane API, removing only codec metadata; original codecs remain in compiled data and manifest. The existing restricted media namespace is reused as a file allowlist, not a fixture data source. No runtime or WordPress admission guard is loosened. General host admission and codec-driven selection belong to Part C.

The sample has one genuine transfer in its submit beat; other records place or verify in place, so transfer lanes do not overlap. Custody names INVENT and reproduction names INSPIRE in visible placeholder command comments and Explanation; the generic existing Console prompt is unchanged. All lab values are explicitly simulated.

The diagram follows Part A's graph/text capacity policy. Complete text/evidence can require scrolling inside its context pane. This is not an assertion that a production lesson fits every label without scrolling. Part E remains the teacher/readability acceptance step.

No production preparation deadline is chosen here. #107 and #108 must inform Part C; this PR does not change Motion or its final-seek behavior.

## Verification and artifacts

Product code head: ae7a7be. Later evidence/documentation commits do not enter these archives. Both pinned Node versions pass **1,125 tests**, none skipped. The v1 differential reports **41 identical / zero different**. Existing multi-pane browser suites pass **129 per engine**; new real-preview suites pass **7 per engine**. The packet includes **72 true-size screenshots** (eight beats × three sizes × three engines) with dimensions and digests in screenshots.json.

| Artifact | SHA-256 | Bytes |
| --- | --- | --- |
| Plugin (unchanged) | d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a | 219661 |
| Authoring candidate (152 files) | cea1729fe94a1cabc71547e2eb7cdb74bcf99fd49c97875986a2be90aab0ff3b | 1039066 |
| Placeholder pack | 8131e7f07d8481b3f2ea7289edc9ff49592cc9dfbc8b7724a45656cac597982c | 124400 |

Two clean Node 22.23.2 builds match for all three. builds.json records the exact sizes and hashes. An extracted candidate with no node_modules initialized, validated, compiled, packed and previewed actual captioned video. Its pack bytes match the repository build. Published 1.0.1 rollback ZIP and page 3227 capture hashes were checked unchanged.

Mutation reports are retained per engine. The final suite contains 20 unit and two browser probes; a crash, missing anchor or empty test selection is not counted as a caught mutation. Local Chromium/Firefox reports contain 21 probes and predate PB-M22; WebKit contains all 22. Both pinned final verify runs exercise the 20 unit probes, and exact-head CI runs the complete final set in each browser. The latest individual probe logs are the WebKit run.

Exact-head CI is visible in PR #109's Checks tab. Review must use the final PR head, not an earlier green head. The initial CI mutation-anchor failure is retained; it was fixed, not retried into a pass. Independent rebuild and Daisy/Johann decisions remain outstanding.
