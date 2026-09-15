# ADR 0010: Runtime Pause Observability and Clock Freeze

Status: Accepted for CiM v1

## Context

CiM v1 requires `pause()` to preserve an in-flight transition and later resume that same transition. Earlier architecture text represented Runtime-owned `transitionProgress` as a normalized fractional value.

The renderer contract does not expose an authoritative fractional progress signal. Renderer implementations own transition duration and may use different animation strategies. Runtime can prove transition identity and lifecycle phase, but deriving a fraction from elapsed time would invent semantics that the renderer did not report.

Runtime does own authored dwell timing. `dwellRemainingMs` is derived from the injected CiM clock and is therefore an exact pausable and resumable quantity.

## Decision

V1 removes `transitionProgress` from the Runtime-owned operational contract and replaces it with:

```text
transitionPhase = idle | in_flight | settled
```

`transitionPhase` reports only lifecycle facts Runtime can prove. It does not estimate renderer animation completion.

During an in-flight transition, `pause()` freezes the transition-scoped renderer clock before Runtime requests canonical `paused` status. The clock facade preserves its virtual `now()` value, cancels or detaches source scheduler handles, and prevents delayed or frame callbacks from reaching the renderer while paused. Work scheduled through the facade while paused remains dormant. `play()` resumes that same clock capability, re-arms remaining scheduled work, preserves the existing `transitionId`, and leaves the Core pending target unchanged.

A paused transition therefore preserves:

```text
Core.currentStepId = last committed stable boundary
Core.targetStepId = pending destination
Runtime.transitionId = existing transition identity
Runtime.transitionPhase = in_flight
Runtime -> Core.setStatus("paused")
```

No fractional transition value is part of the v1 Runtime snapshot or semantic event contract.

For authored dwell, Runtime freezes and publishes the exact remaining interval through `dwellRemainingMs`. `play()` after a paused dwell schedules only the preserved remainder.

`playback.paused` and `playback.resumed` identify an in-flight transition with `transition_id` and `details.transition_phase: "in_flight"`. Dwell pause/resume evidence uses `details.dwell_remaining_ms`.

## Supersession

This decision supersedes only the `transitionProgress` language in ADR 0005 and the former normalized-progress clauses in `CIM-SPEC.md` and `EVENTS.md`. ADR 0005's navigation, cancellation, transactional commit, and continuity rules remain in force.

## Consequences

- Runtime reports only transition facts it owns and can verify.
- Renderers remain free to define their own animation timing without exposing a shared progress language.
- Pause correctness is established by freezing the renderer's only semantically valid time source rather than by freezing a derived number.
- Dwell remains the v1 fractional/resumable timing quantity because Runtime owns its duration and clock accounting.
- Existing snapshot consumers must replace the `transitionProgress` key with `transitionPhase`.
- Harness assertions become stronger because they test callback inactivity and semantic immobility while source time advances.

## Rejected Alternatives

### Infer progress from elapsed time

Rejected because Runtime does not own renderer transition duration and elapsed time cannot establish renderer completion fraction.

### Add a renderer progress callback in v1

Rejected because pause/resume does not require a shared fractional progress contract. Such a callback can be considered in a later version if a concrete consumer requires it.

### Keep endpoint-only values 0 and 1

Rejected because a field named progress implies meaningful intermediate values. Lifecycle phase expresses the actual v1 guarantee directly.

## Verification

The harness must prove that, while an in-flight transition is paused and the underlying scheduler advances arbitrarily:

- zero renderer delay callbacks fire;
- zero renderer frame callbacks fire;
- `transitionId` remains unchanged;
- `transitionPhase` remains `in_flight`;
- Core `targetStepId` remains unchanged;
- Core `currentStepId` remains the last committed boundary;
- no `step.changed` event is emitted.

The harness must also prove that a paused dwell retains the exact `dwellRemainingMs` while source time advances and, after resume, completes after exactly that remaining interval rather than the original full dwell.
