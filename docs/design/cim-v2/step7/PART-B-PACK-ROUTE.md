# Step 7 Part B — authoring and pack route

Status: implementation plan committed before tests and implementation. Base: main 214c6a9. No WordPress admission, runtime registration, host-clock change, version bump, release or install. Package/plugin version stays 1.0.1; the local development-preview identity below is 1.1.0-dev. Plugin ZIP must remain d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a.

## Source and commands

The editable sample lives at examples/packs/run-custody-placeholder/ with lesson.json, capture.json, media.json, raw/, media/ and captions/. The existing authoring/v3 fixtures and v1/v2 implementation/output/diagnostics stay unchanged. `init DIRECTORY --format v3` copies this complete source without overwriting anything. Existing init syntax is unchanged. validate, compile, preview and pack recognize v3 sources and take a separate route; legacy commands retain their route and messages. Every new error carries a rule ID, JSON path and concrete fix.

The eight beats are name run; pin code; submit/fail (GUI); retry; review metadata (context only); track MLflow (GUI); Gate 10 custody on INVENT; reproduction on INSPIRE. Every beat progresses Explanation and Engineering. At most one actual inter-location transfer per sample beat. Sample diagrams must draw at the existing capacity without shrinking or clipping. All commands, output, records and evidence are explicitly simulated, with the Player placeholder badge retained. No sample is represented as genuine capture.

## Media and additive schemas

Add status pack to the v3 source/media/manifest schemas alongside, not in place of, deferred and fixture. Their existing accepted inputs and diagnostics retain their behavior. Source media status pack names media.json and its asset IDs. A pack map uses schema localis.cim/media/v1 and closed status pack fields; each video copy adds a required codec string (RFC 6381 form appropriate to its MIME type). Primary and alternative retain independent fingerprints, sizes, durations and caption descriptors. Unknown fields, missing/invalid codecs and attachments produce distinct rule/path/fix diagnostics. Attachment diagnostics explicitly say Media Library sources arrive in 1.2. The shipped 1.1 route accepts only confined pack-relative files, including captions.

Two committed simulated clips cover beats 3 and 6, each MP4/H.264 plus WebM/VP8, each copy with its own WebVTT file. The picture and captions visibly say Placeholder · simulated. Commit the media bytes, generator and exact FFmpeg/ffprobe versions. Builds consume committed bytes; encoding with a different tool version is not promised to reproduce them. Keep the established 4 MiB video, 64 KiB caption, 16 MiB media-total, 32-clip and 30-second limits; pack preflight also applies a bounded total ZIP/payload budget and count, independently of upload limits.

## Pack layout and trust

A single-lesson cim.lesson-pack/v2 companion ZIP has one root cim-lesson-ID/ containing lesson-pack.php, cim-lesson-pack.json, lesson.json (compiled frozen-v2 envelope), capture.json, raw/evidence paths, media/ clips, captions/ tracks, LICENSE and README.txt. Fixed names prevent source paths entering executable code. The PHP is an inert fixed template: only schema-checked ID and canonical version enter header fields; authored prose never enters PHP. It registers no code or renderer.

The manifest fixes cim_min 1.1.0 and cim_max_exclusive 2.0.0, declares placeholder/media/lesson identity, and lists every other payload file with path, byte size and SHA-256. The manifest cannot hash itself recursively; the external whole-ZIP .sha256 covers it. This exception is explicit, and a test checks exact equality between payload paths and the manifest list, with no undeclared files. The media map is embedded in the manifest and compiled renderer config; equality is checked, avoiding independent conflicting maps. Capture raw paths are normalized into raw/ in the generated pack without changing IDs or evidence bytes.

Read source data through confined, bounded regular-file handles, check path identity and file state around reads, and verify expected hashes. Build an immutable in-memory payload snapshot from those verified bytes. Reject traversal, escaping symlinks, unknown files, identity changes, invalid JSON, collisions and dishonest fingerprints. The fixed paths and safe generated PHP are covered by negative tests.

Use the existing portable ZIP encoding: sorted paths, stored entries, DOS 1980-01-01 timestamps, mode 100644, UTF-8 names, no extra fields/comments or host metadata. Tests inspect ZIP headers and compare bytes from independent builds. A timestamp mutation must fail an assertion. The pack writer refuses existing output/checksum paths. Preflight blocks a known exceeded host upload limit (ZIP size, not just individual files), reports unknown limits honestly, and reports ZIP size, every media size/digest/codec, aggregate limits, confinement, placeholder state and version interval.

## Explicit development admission

Do not strip prerelease suffixes or relax semantic version comparison. Release version strings use the canonical numeric interval unchanged: 1.0.1 is below 1.1.0, and plain 1.1.0-dev remains below it/refused. Only an in-process, branded capability deliberately issued by the authoring tool for local preview or admission tests identifies as {version: 1.1.0-dev, channel: development}. The capability is not serializable lesson data and cannot be replaced by an object/flag from a pack. Its effective tested target is exactly 1.1.0, after full manifest validation. The branch does not alter package/plugin version or released 1.0.1 code. An unmarked build, plain prerelease string, forged lookalike object and any 1.0.1 claim are refused. Positive and negative tests and widening mutations enforce this rule. Production/WordPress integration waits for Part C.

## Local preview boundary

Preview uses the actual compiled frozen-v2 envelope, capture and committed pack media, not fixture lesson/media imports or test-driver code. It presents a visible 1.1.0-dev local-preview and Placeholder content notice. A tools-only real-time transition driver uses the existing restricted pane contract and composed Player. It does not supply the WordPress host clock or change the transport/session model.

Existing multipane code is still opt-in and fixture-guarded. The preview adapter may pass that existing opt-in only after the branded development admission and successful full preflight, with actual validated pack data. It projects pack media into the existing restricted media-access shape (retaining verified source paths, sizes, hashes and captions; codec metadata stays in the compiled/manifest data). The legacy private /__cim_fixture_media/ URL namespace may be reused as an implementation allowlist, not as a source of fixture files. No src/ or wordpress/ admission guard is weakened, and no runtime registry is opened. Codec-driven browser selection replaces the legacy hard-coded probe in Part C, not in this authoring-only step.

Bind HTTP to loopback, enforce Host/Origin and GET/HEAD, and serve only a fixed tool/runtime asset allowlist plus manifest-listed payload bytes. Snapshot-qualified URLs keep one page's compiled/capture/media consistent while the author edits and refreshes; retain a bounded number of snapshots. No URL maps to arbitrary source-folder reads. Reject unknown paths, traversal and escaping links. The client verifies compiled/capture bytes against the manifest and Motion verifies served video/caption bytes through the existing verified-memory access. Saving a valid edit and refreshing rebuilds the snapshot; errors show every actionable diagnostic.

## Proof and delivery

Commit tests and retained red runs before implementation; disclose every subsequent test edit and its reason in REVIEW.md. Cover placeholder removal, forged real labels, broken capture references, media digest changes, missing codecs, escaping paths, lowered cim_min, widened development admission (plain 1.1.0-dev and 1.0.1) and variable ZIP timestamps with assertion-catching mutations. Keep all existing mutation runners and frozen comparisons, including the 41-case v1 differential, green.

Run verify with zero skipped tests on Node 20.20.2 and 22.23.2; full three-engine browser and mutation matrix; eight-beat preview screenshots at 1366, 1536 and 1920 in each engine; two clean pinned-Node builds with plugin hash unchanged, new authoring hash explained and identical sample-pack hashes. Keep rollback material intact. Draft PR lists head, development rule, counts/results, checksums, every post-red test edit and exact-head CI. Merge waits for Daisy and Johann.

#108 can be developed separately; it blocks Part C. #107 remains open. No playback fix, WordPress serving/admission, registration, new host clock, lesson page, small-screen GIF, upgrade/rollback work or PR #102 CI follow-up is included here.
