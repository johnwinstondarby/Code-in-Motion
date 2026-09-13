# Runtime / CiMInstance

## Purpose

The runtime composition layer creates one isolated CiM instance and coordinates commands across the production components.

## Owns

- `CiMInstance` lifecycle
- Instance identity
- Command sequencing
- Cross-component orchestration
- Transition correlation and cancellation coordination
- Multi-instance isolation
- Initial deep-link dispatch to the matching experience

## Does not own

- Subject state interpretation
- Renderer internals
- Commentary DOM internals
- Harness behavior

## Allowed dependencies

May call documented interfaces exposed by core, transport integration points, commentary, renderer interface, accessibility helpers, experience loading, telemetry, and fault services.

## Prohibited dependencies

No direct access to another component's private DOM or mutable internal state. No import from `harness/`.

## Verification

Integration tests must prove command ordering, instance isolation, navigation cancellation, pause/resume continuity, deep-link dispatch, and clean disposal.
