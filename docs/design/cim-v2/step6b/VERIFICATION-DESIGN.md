# Step 6b verification and clock mechanism — before implementation

Fixture-only. No WordPress serving, pack discovery, Admin change, production registration or release.

## Verified bytes are the playback bytes

Each clip and caption descriptor names a pack-relative path or a positive integer WordPress attachment ID. There are no authored URLs. A trusted fixture resolver binds only these declared identities to explicit same-origin fixture addresses. The Motion pane receives a restricted media-access service, not general fetch, URL resolution, Core, Runtime or host objects.

The service fetches with redirect rejection and a bounded byte reader, checks size and SHA-256 using Web Crypto, and creates Blob URLs from those exact verified byte arrays. Only those Blob URLs are assigned to video/track elements; the original response address is never a playback address. Captions have independent size/hash/type checks. Mismatch, unsupported content, missing data and deadline expiry revoke/withhold playback and return the common text fallback. URLs and temporary listeners are revoked on replacement/disposal/cancellation. Late results cannot resurrect a discarded transition.

Fixture limits: 4 MiB per clip, 64 KiB per caption track, 16 MiB total referenced media per map, 32 clips and 30 seconds per clip. These deliberately small fixture limits are not promises about future production uploads. File validation checks resolved paths and refuses escaping symlinks. Attachment IDs resolve only through fixture bindings; this is not WordPress admission or evidence of public attachment access.

## Media readiness and shared time

Preparation is outside semantic playback time. A private, opt-in fixture coordinator owns the clock hold; Motion does not receive pause/resume controls. It prepares/verifies/decodes the target clip before releasing a shared transition. Every other pane waits on that same readiness barrier, so a fast Console cannot run ahead while the clip loads. Preparation has an independent bounded I/O deadline, since a timeout must still fire while semantic time is held.

During a media transition the coordinator observes decoder buffering/readiness, user playback intent and cancellation. Buffering holds the shared clock and native video together; it never means completion. Readiness releases the hold only when the learner still intends playback. A user pause therefore survives media becoming ready. A separate bounded buffering deadline fails the clip and releases its participation without holding other panes indefinitely. Navigation cancels the old barrier and immediately starts reconstructing the destination; no network or decoder promise is awaited by a navigation command.

Motion implements mount/settle/play/dispose. The private fixture clock view may additionally provide read-only pause/resume observations for native video synchronization; it exposes no clock controller or engine object. The frozen renderer interface and existing pane contract implementation remain unchanged. The opt-in coordinator must leave the default step-5 session path and its comparisons unchanged.

The video timeline is synchronized against the scoped clock: pause/resume observations act immediately; finite clock samples correct drift or seek after clock jumps. The verified clip's end (or a successfully decoded final seek) completes Motion, not the end of downloading or buffering. Seeking or end detection has a bounded fallback. Reduced motion performs no automatic playback: show a final still or labeled poster/text alternative. A no-GUI beat retains the preceding final display or failure with its waiting note.

## WordPress plan — design only

For both pack files and attachment IDs, hashing a mutable pathname and subsequently redirecting to it is insufficient. The future server must read the source through one confined file handle into a private, immutable content-addressed snapshot, enforcing byte limits and hashing while copying. Publish the snapshot atomically only after digest verification. Playback/range responses read that verified snapshot, never the mutable original or an unverified stream. A change to the original requires revalidation and a new matching snapshot; it cannot silently replace the bytes of an existing clip. Do not send unverified bytes to the visitor while still discovering whether their digest matches.

Snapshot storage must be outside direct public writes, with content-addressed names, no in-place updates, read-only serving handles and an explicit permissions/source check on every request. Range and full responses must bind to the same immutable object and digest. Specify atomic publication, locking, cleanup/retention, disk quotas, hash deduplication scope and concurrent replacement handling before admission. If a storage backend cannot enforce immutability, use a verified bounded local spool or fail closed; an object ETag alone is not SHA-256 evidence.

Attachments are looked up by ID, checked during Admin validation and checked for anonymous visitor permission (including attachment/parent privacy) before serving. Offloaded media needs an explicitly reviewed source adapter and the same verified snapshot rule; arbitrary remote redirects are not allowed. Deleted/replaced/unauthorized sources produce the lesson/clip-specific Admin reason and visitor fallback, with stale snapshots withdrawn according to the reviewed retention policy. The exact replace/delete/export/rollback semantics, portability warnings and upload-limit reporting remain for the WordPress admission step.

This snapshot plan avoids loading large production clips entirely into browser memory and avoids verifying one object then playing another. It requires security and concurrency tests in the admission PR; this document does not claim those guarantees are implemented today.

## Media-map compatibility

Keep existing `status: deferred` maps empty and preserve their diagnostics. Add a distinct fixture-only map form rather than admitting media to old hosts or pretending production serving exists. Frozen authored/compiled v1/v2 files, legacy diagnostics and capture records remain unchanged. The packet must enumerate the deliberate v3 media-schema/validator additions.
