# ADR 0018: Visual Rail Projection and Preview State

- Status: Accepted
- Date: 2026-09-15

## Context

Transport checkpoints 2, 3, and 7 already hold the facts needed to draw a semantic rail. Checkpoint 2 projects canonical current, pending target, and reveal-frontier state. Checkpoint 3 owns local scrub preview. Checkpoint 7 supplies learner-facing labels and exposes the preview ordinal through the native range projection.

Visual rail code needs those facts in one presentation record without acquiring command authority, Runtime access, or a second semantic model. Canonical position and scrub preview must remain distinguishable because a learner may preview an unrevealed boundary without committing semantic movement.

## Decision

Checkpoint 10 adds a headless visual rail presentation with exactly one public method:

```text
read
```

Construction receives only the exact frozen checkpoint 2 timeline surface and exact frozen checkpoint 7 range-presentation surface.

Each read returns a separate `initialAnchor` and authored `markers`. Records preserve canonical `current`, pending `target`, and authored `revealed` flags and add a presentation-only `preview` flag derived from the current checkpoint 7 range ordinal.

The initial anchor record contains:

```text
stepId
index
visualLabel
accessibleLabel
current
target
preview
```

Each authored marker contains the same fields plus:

```text
revealed
```

`preview` never changes canonical current state or reveal history. Label and ordinal alignment must match the canonical boundary order exactly. Malformed, widened, mutable, accessor-backed, or inconsistent inputs fail closed.

## Consequences

Visual code can style current, target, revealed, and preview states independently without reading Runtime or reimplementing scrub semantics.

The visual projection remains headless. It installs no DOM listeners, mutates no elements, submits no commands, and owns no command acceptance policy.

A later checkpoint may bind these presentation records to native marker controls without changing their semantic meaning.

## Rejected alternatives

- Reusing `current` to indicate local scrub preview. This would falsely claim canonical movement before release-only commit.
- Deriving labels from step IDs. Learner-facing labels already belong to the experience presentation contract.
- Reading Runtime directly from the visual layer. Existing Transport projections already expose the required facts through narrower capabilities.
