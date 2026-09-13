# ADR 0007: Semantic Scrub Contract

Status: Accepted for CiM v1

## Context

The transport owns scrub interaction and snap-to-step behavior. Earlier architecture decisions cite rapid scrub as a reason to keep commands separate from the observational event stream, but v1 did not define whether pointer movement itself should issue semantic seeks.

Continuous seek-on-drag would flood the semantic event stream, advance commentary frontier repeatedly, and create unnecessary renderer settlement work. A release-only contract preserves deterministic semantic navigation while still allowing a responsive transport preview.

## Decision

V1 scrub is a transport-local preview followed by one semantic seek on commit.

During pointer or touch drag:

- Transport may move the scrub thumb and show a local preview label or nearest semantic marker.
- Canonical semantic position does not change.
- Commentary active state and reveal frontier do not change.
- Renderer state does not change.
- No semantic command or transition event is emitted for intermediate pointer positions.

When the learner releases or otherwise commits the scrub control:

1. Transport resolves the nearest valid semantic boundary according to its marker mapping.
2. Transport submits exactly one `seek(stepId)` command to `CiMInstance`.
3. The command carries `details.source: "scrub"` in observational command evidence.
4. Normal seek semantics apply, including stopping continuous playback intent, absolute settlement, reveal-frontier advancement for forward seeks, and deep instance isolation.

Cancelling the scrub gesture before commit restores the transport thumb to the canonical semantic position and emits no semantic seek.

Keyboard interaction on the semantic progress control uses discrete semantic navigation rather than generating a stream of preview seeks.

## Consequences

- The semantic event stream remains low-frequency and ordered.
- Scrub preview responsiveness does not depend on renderer performance.
- Commentary does not flicker through intermediate entries during drag.
- The harness can identify scrub-originated navigation without defining a second command type.
- Continuous arbitrary-time renderer scrubbing is outside v1 and may be added later through a separate versioned contract.

## Rejected Alternatives

### Seek continuously on every drag update

Rejected because it creates high event volume, repeated renderer settlement, and unclear commentary-frontier behavior.

### Renderer-only visual preview during drag

Rejected for v1 because it would introduce a second non-canonical visual state path and additional renderer lifecycle requirements.

### Remove scrub from v1

Rejected because semantic progress scrubbing is part of the CiM learner-control model.

## Verification

The harness and transport tests must prove:

- intermediate drag positions emit no semantic seek;
- scrub commit emits exactly one seek;
- cancelled scrub emits no seek;
- scrub-originated seek evidence includes `details.source: "scrub"`;
- forward scrub advances reveal frontier only after semantic settlement;
- backward scrub preserves the existing high-water reveal frontier;
- scrub while playing stops continuous playback intent before settlement.
