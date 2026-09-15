# ADR 0012: Initial Rail Anchor and Same-Boundary Seek Settlement

Status: Accepted

Date: 2026-09-15

## Context

Transport checkpoints 2 and 3 established a canonical semantic boundary order beginning with the reserved `initial` boundary, followed by authored `step-*` boundaries. The first timeline projection represented every boundary with one marker-shaped record. That representation gave `initial` `current`, `target`, and `revealed` marker flags.

The normative specification distinguishes these concepts. `initial` is a valid semantic boundary and navigation destination, while at `initial` no authored semantic marker is active and no authored commentary entry exists to reveal. The original projection therefore conflated the semantic rail anchor with authored marker and commentary state.

Scrub review also exposed a second issue. Transport correctly forwards every committed learner action to Runtime, but a stable `seek(currentStepId)` previously resolved as success and caused a redundant absolute render and transition evidence even though semantic position did not change.

## Decision

### Initial is a rail anchor, not an authored marker

`boundaryIds()` remains the single canonical semantic order:

```text
initial, step-01, step-02, ...
```

Boundary position in that array is the only ordinal used by Transport for geometry and semantic resolution.

Transport timeline projection represents `initial` separately as an exact frozen rail anchor with:

```text
stepId
index
current
target
```

The anchor has `stepId: initial` and `index: 0`. It has no `revealed` field.

The `markers` collection contains authored `step-*` boundaries only. Authored markers retain their canonical `boundaryIds()` ordinals, beginning at 1, and expose:

```text
stepId
index
current
target
revealed
```

Canonical identity flags are symmetric: the anchor represents `initial`; authored markers represent authored boundary identities. If current or target identity is `initial`, no authored marker receives that flag. If the reveal frontier is `initial`, no authored marker is revealed.

### Semantic rail geometry uses equal boundary spacing

Scrub snap geometry is based only on semantic ordinal:

```text
ratio(index) = index / (boundaryCount - 1)
```

Renderer transition duration and authored dwell do not weight the rail. Exact midpoint ties resolve toward the lower semantic ordinal. Out-of-rail finite input clamps to the end anchors.

The semantic rail is a step indicator rather than an elapsed-time progress meter.

### Same-boundary seek is an accepted no-change

Core resolves a valid stable seek whose requested boundary equals the committed boundary as:

```text
result = no_change
reason = already_at_boundary
fromStepId = currentStepId
toStepId = currentStepId
```

Transport does not pre-screen or suppress the command. It forwards the learner action unchanged.

When no transition is active, Runtime emits `command.accepted` with the no-change result and reason, then performs no transition allocation, renderer call, transition settlement event, or `step.changed` event.

If an in-flight transition exists, Runtime may still cancel that work and restore the committed boundary absolutely under the existing in-flight navigation rules. The no-change result does not grant stale renderer output semantic authority.

## Consequences

- `initial` remains seekable, deep-linkable, replayable, and scrubbable without being presented as an authored semantic marker.
- Commentary reveal semantics apply only to authored commentary-bearing steps.
- Transport keeps one ordinal across projection and scrub geometry.
- Same-boundary scrub commits remain observable learner actions without producing fake movement evidence or redundant stable rendering.
- Transport retains no command acceptance policy.
- Midpoint tie behavior cannot accidentally advance the monotonic reveal frontier.

## Verification

Tests must prove:

- no authored marker is current, targeted, or revealed solely because canonical identity is `initial`;
- the initial anchor retains ordinal 0 and authored marker ordinals begin at 1;
- `targetStepId: initial` marks the anchor and no authored marker;
- exact midpoint and subpixel values on either side follow the lower-ordinal tie rule;
- finite out-of-rail scrub coordinates clamp to the end anchors;
- stable same-boundary scrub seek returns `no_change / already_at_boundary`;
- stable same-boundary seek emits command acceptance only and performs no renderer or transition work;
- Transport continues to submit the command rather than suppressing it.
