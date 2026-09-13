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
- Holding the privileged Core status-control capability and requesting activity-status changes through `setStatus(nextStatus)`

The normative split between Core-owned semantic state and Runtime-owned operational state is defined in `docs/CIM-SPEC.md` §3.

Runtime determines activity-status changes from its operational facts and is the only production component authorized to request `playing`, `transitioning`, or `paused` through Core's privileged control capability. Core stores the resulting canonical status.

Runtime may import shared value vocabulary from `src/contracts/`; those shared values do not grant Core mutation authority.

## Does not own

- Canonical semantic commit authority
- Canonical status storage
- Subject state interpretation
- Renderer internals
- Commentary DOM internals
- Harness behavior

## Allowed dependencies

May call documented interfaces exposed by Core, import `src/contracts/`, and use transport integration points, commentary, renderer interface, accessibility helpers, experience loading, telemetry, and fault services.

## Prohibited dependencies

No direct access to another component's private DOM or mutable internal state. No import from `harness/`. Runtime must not emit a successful canonical `step.changed` outcome without the corresponding Core commit.

Runtime must not distribute the privileged Core status-control capability to Transport, Commentary, Renderers, Host, Telemetry, Accessibility, or Experience modules.

## Verification

Integration tests must prove command ordering, instance isolation, navigation cancellation, navigation clearing playback intent, pause/resume continuity for transition and dwell, ordered status writes, deep-link dispatch including `initial`, scrub-originated single-seek flow, and clean disposal.

The Core implementation gate must prove that Runtime alone retains the privileged status-mutation capability.
