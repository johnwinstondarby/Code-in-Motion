# Step 6c design — fixture-only composition

Base main 9db0421, version 1.0.1. No WordPress admission, release, version bump or installation. This note precedes implementation.

## Layout

At 1366×768, 1536×864 and 1920×1080 the root fills its viewport with an intrinsic minimum width of 1366px. A compact heading, one shared action header/tablist, the action viewport, equal-width Explanation/Engineering context cells and the existing transport form one grid. Action receives approximately 46% of available pane height; context receives the remainder. Containers use min-width:0, min-height:0 and internal vertical overflow. Flow text precedes the graphical diagram. No pane escapes its cell and the supported widths have no horizontal page scroll. Video occupies its actual slot using object-fit:contain, without crop, with a readable native caption size. Both context cells are always present.

There is no phone Player or stacked layout. Below 1366px the same minimum-width composition is retained and the page can scroll. A future WordPress small-screen notice is outside this step.

The selected action panel is opaque. The inactive Motion panel stays rendered behind Console within the action cell so WebKit can finish seeks, but is aria-hidden, inert and pointer-inactive. Only the selected tabpanel is exposed to accessibility. The shared action header names the active surface once; the Motion adapter can suppress its internal duplicate heading only in this composition. Its persistent placeholder badge remains. Default step-5/6b mounts keep their established markup.

## Trusted coordinator and composition

Extract the readiness wrapper into src/multipane/motion-coordinator.mjs as an opt-in trusted coordinator. It owns preparation/buffering holds, play/pause intent, scoped read-only observation and navigation cancellation. It imports no Core, Runtime or host. It receives a trusted driver factory and restricted verified access, creates the Motion pane, and wraps only that driver's transitions. Panes receive no controller. The existing harness becomes a thin delegate; old sessions that do not opt in are untouched. A private source composition module mounts actual Console, Explanation, Engineering and Motion adapters plus the existing controls. Test-only clock construction stays in the harness; engine authority is never handed to panes.

The composition reuses step-5 navigation semantics: action beats select their tab once at entry; manual selection persists during that beat and across context-only progression by Play/Next; Previous, End, direct jumps and deep links reconstruct default tabs and absolute pane states. Pause/resume never reset the tab. Neither context pane is a tab.

Failures show GUI recording unavailable and the clip alternative. CIM-PANE-MEDIA-UNAVAILABLE is in native details/summary (Show details), closed initially. Disclosure changes no playback state or tab and has no scripted focus transfer. The failure and waiting note remain during holds.

## Diagram

Keep step-6a validation and record-derived absolute snapshots as authority. A graphical mode draws services (capture location IDs) as nodes grouped by host. Artifact labels use capture IDs and show status words plus a shape/pattern cue; absent artifacts are explicitly listed as having no location, never assigned an invented location. Current flows come solely from the selected beat's capture records, with record IDs on arrows and tokens. Nonmoving verification records have no arrow. Initial placement has no invented source-node edge. A finite shared-clock plan moves tokens; reduced motion settles immediately. SVG title/description describe a modeled capture view; decorative geometry is aria-hidden and the full flow/state text comes first. Evidence remains in Show evidence.

Wording is literal: equal source/destination becomes “run stayed at login”; a changed location becomes “job moved from git to gpu”; no prior location becomes “run placed at login”. Status and verifying host follow separately. No self-arrow wording. No inferred missing records, neighboring-beat movement or invented IDs. A context-only beat preserves the last diagram display; navigation reconstructs the same last valid recorded state. Missing/contradictory records fail with CIM-PANE-DIAGRAM-RECORDS and text fallback.

## Optional WebM copies

Keep current single-copy maps (including legacy single WebM fixtures) and deferred-map diagnostics unchanged. Add optional webm to a clip: a closed descriptor containing source, sha256, size, type=video/webm, duration and its own captions. A clip with webm must have a primary video/mp4 descriptor. Validate each source/size/hash/type/caption independently, include both copies and both caption declarations in the 16MiB map total, and reject durations differing by more than 0.2s. Repeated caption paths are independently checked, not deduplicated out of the byte accounting.

Before fetching, query canPlayType with explicit H.264 and VP8 codec strings. Prefer a supported MP4; if H.264 is unsupported select supported WebM. Single-copy maps use their declared supported type. Only the selected copy is fetched and verified. A verification/size/network failure is terminal, never a codec retry. Only a copy that passed both byte checks but fails native decode can trigger one attempt of the other supported copy. That attempt must independently verify clip and captions and shares the original preparation deadline; it never resets the deadline. Late results are cancelled/released. Native elements only receive verified Blob URLs. Tests force the unsupported-H.264 condition and disclose the override; they also exercise actual native WebM decoding.

Shape errors in fixture maps use CIM-MEDIA-* or CIM-V3-* rather than the deferred-map code. Deferred maps retain the existing diagnostic and the null-pack regression stays covered.

## Proof and limits

Commit tests and meaningful failing logs before implementation of each part. Record every later test edit/addition, including corrections and strengthened mutation detectors. Keep existing verify/frozen outputs and the 41-case v1 differential. Run Node20/22, Linux Chromium/Firefox/WebKit, all supported sizes, assertion-detected mutations with passing baselines, reproducible builds and exact-head CI. Keep published 1.0.1 rollback files unchanged. Step7 owns the placeholder pack; step8 owns author docs/release candidate. Real lab footage and WordPress serving/access/snapshot/portability/upload handling remain deferred.

## Implementation finding: bounded native retirement

Linux WebKit exposed a separate navigation stall from issue98: synchronously calling load() on a retired video while a seek or its initial decoder load is pending can block the page. The retained trace reaches the old decoder reset and stops there. A deterministic retirement test was recorded failing before the fix. Retirement now pauses and removes the source, but only explicitly resets a decoder that has HAVE_ENOUGH_DATA and no pending seek. Other detached native buffers are left to browser lifetime management; the adapter still removes its listeners, cancels its I/O, drops references and immediately revokes both verified Blob URLs. This does not await any decoder promise or introduce a new timer. The repeated WebKit navigation run and a native-seek event regression check both page responsiveness and the retired video's paused state. Retry cleanup only clears global references when they still identify that attempt's own objects.

The graphical test uses a separate validated placeholder capture derivative: stage-job at Git, followed by the recorded transfer to GPU. The original context-chain and all frozen lessons stay unchanged. This supplies a genuine record-backed edge instead of inventing one in the renderer. Flow routes and moving tokens use a lane above node labels. No stacked/phone layout was implemented.

A further WebKit baseline showed that the detached old video can receive a late native play event after retirement. A second deterministic red test protects self-clearing native onplay/onplaying pause guards. Those handlers use only their element as this, retain no pane/controller/clock references, clear themselves when invoked, and are eligible for collection with the detached element. They do not report completion or touch the current view. All transition/readiness listeners are still explicitly removed and Blob URLs revoked immediately. The native retirement pause assertion remains in the real browser test.
