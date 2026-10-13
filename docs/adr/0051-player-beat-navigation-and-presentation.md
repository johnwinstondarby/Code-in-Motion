# ADR 0051: Player Beat Navigation and Presentation

Status: Accepted

Date: 2026-10-13

Amends:

- ADR 0005 for v2 manual Previous and Next destinations; cancellation and segment settlement remain unchanged.
- ADR 0049 Decision 5 for the additional root-scoped structural `beats` projection.

## Context

The Player and independent pane follow/holds are implemented. AUTHORING-JSON-v1 section 16.1 and AUTHORING-TO-RUNTIME-v1 sections 4 and 12 define authored beats as the learner coordinate, while generated segments remain the canonical settlement coordinate. This checkpoint implements headings, progress, markers, manual navigation, and incoming deep links before production v2 content admission.

## Decision

1. A shared structural reader groups validated frozen v2 steps using only their beat metadata. Groups must be contiguous, ordinally aligned, agree on heading and segment count, and end at exactly one final boundary. Their total must agree with `presentation.beat_count`. It never inspects opaque state or renderer configuration. v1 has no beat groups.

2. The exact frozen `playerContent(root)` projection adds `beats` to `rendererId`, `title`, `description`, `boundaryIds`, and `entries`. Each beat contains exactly `id`, `ordinal`, `heading`, `finalStepId`, and frozen `boundaryIds`. Legacy roots receive an empty frozen array. Commentary entries retain exactly `stepId`, `text`, and `links`; Commentary still reveals and selects individual segments.

3. Runtime supplies ordered beat-final boundary IDs to Core for v2 only. Core validates that these IDs partition its canonical boundary sequence without importing Experience or interpreting subject state. The canonical snapshot and public commands do not change.

4. Manual Next from initial lands at the first beat's final boundary. From an incomplete beat it finishes that beat at its final boundary. Once the current beat is complete, Next advances to the following beat's final boundary. It never skips the remaining segments of an incomplete beat to finish a later beat. Previous lands at the preceding beat's final boundary, or initial from the first beat. Next at the final boundary and Previous at initial retain directional exhaustion. Previous during a pending transition retains the existing cancellation to the committed boundary. Command identities and provenance remain Next and Previous. v1 continues moving one boundary at a time.

5. Continuous playback still traverses every generated segment, including reduced-motion playback. Seek, internal Commentary selection, Home, End, Restart, cancellation, reveal-frontier policy, and fault/disposal rejection retain their existing contracts. Manual beat navigation does not replace automatic segment advancement.

6. Explanation entries appear under authored beat headings. A section becomes visible when its first entry is revealed; later entries within it retain individual reveal and selection. Headings and progress use authored ordinals and text rather than generated Step labels. Progress and `aria-current="step"` reflect the current committed beat, not the high-water reveal frontier or a pending target. Initial displays Start and the total beat count.

7. WordPress composes one native button marker per authored beat through a narrow seek capability and read-only observation. Activation seeks its captured final boundary with marker provenance. Mutable DOM attributes cannot retarget it. Native focus and keyboard behavior are preserved. This is a beat marker row; continuous timeline scrubbing and rate controls remain later work. Disposal makes callbacks inert immediately, withdraws listeners, removes the row, and permits retry if cleanup fails. Partial construction rolls back before presentation admission.

8. Incoming `#cim/{experience-id}/{beat-id}` links resolve v2 authored beat IDs to final boundaries before initialization and presentation. Generated v2 segment IDs are rejected as public targets. Initial remains valid. v1 retains direct step-ID links. Unrelated fragments and other experiences do not select this root. This extends the existing mount-time resolver; it does not add live hash-change navigation or rewrite URLs.

9. Deliberate navigation retains the pane ownership rules of ADR 0050. The first entry of a beat brings its heading into view; individual segment selection retains entry positioning. Beat controls are root-scoped and disposed transactionally with the Player.

10. The production v2 registry remains closed. Engine compatibility enforcement, complete anchor/evidence/risk consumers, copy, ADR 0048 color/limn work, and the known wrap collision remain separate checkpoints. No renderer DOM, canonical oracle, release version, or live installation changes are part of this decision.

## Verification

Headless proofs cover exact immutable grouping, invalid metadata, opaque-state isolation, every segment's directional destinations, command identity, segment playback, reduced motion, and v1/public-link compatibility. Browser proofs cover authored headings, progress after backward navigation and reset, one marker per beat, protected keyboard activation, captured destinations, segment Commentary, admission-time deep links, sibling isolation, and stale controls. Mutation guards must fail on targeted breakages only after the unmodified baseline passes.
