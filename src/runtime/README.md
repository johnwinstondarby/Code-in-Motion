# Runtime / CiMInstance

## Purpose

The runtime composition layer creates one isolated CiM instance and coordinates commands across the production components.

## Owns

- `CiMInstance` lifecycle
- Instance identity and composition
- Command sequencing
- Cross-component orchestration
- Continuous playback intent
- Transition correlation, normalized progress, cancellation, and abort coordination
- Dwell scheduling during continuous playback
- Multi-instance isolation
- Initial deep-link dispatch to the matching experience
- Requesting canonical semantic commits from Core only after stable renderer settlement

The normative split between Core-owned semantic state and Runtime-owned operational state is defined in `docs/CIM-SPEC.md` §3.

## Does not own

- Canonical semantic commit authority
- Subject state interpretation
- Renderer internals
- Commentary DOM internals
- Harness behavior

## Allowed dependencies

May call documented interfaces exposed by Core, transport integration points, commentary, renderer interface, accessibility helpers, experience loading, telemetry, and fault services.

## Prohibited dependencies

No direct access to another component's private DOM or mutable internal state. No import from `harness/`. Runtime must not emit a successful canonical `step.changed` outcome without the corresponding Core commit.

## Verification

Integration tests must prove command ordering, instance isolation, navigation cancellation, navigation clearing playback intent, pause/resume continuity for transition and dwell, deep-link dispatch including `initial`, scrub-originated single-seek flow, and clean disposal.
