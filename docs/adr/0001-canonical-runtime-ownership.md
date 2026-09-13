# ADR 0001: Canonical Runtime Ownership

Status: Accepted for CiM v1

## Context

CiM coordinates transport, commentary, rendering, fault recovery, deep linking, telemetry, and replay around one learner-controlled semantic timeline. Independent modules cannot maintain separate authoritative ideas of the current semantic position without creating disagreement during seek, reverse, pause, recovery, or replay.

The architecture therefore requires one owner for canonical runtime position and one orchestration boundary for cross-component sequencing.

## Decision

`CiMInstance` is the composition and orchestration root for one mounted CiM experience.

Core owns the canonical semantic session state used by that instance.

At minimum, the session model must represent:

```text
instanceId
experienceId
experienceVersion
status
currentStepId
targetStepId
transitionId
transitionProgress
revealFrontier
error
```

`currentStepId` identifies the last committed stable semantic boundary. `targetStepId` identifies a pending destination while a transition is active.

No renderer, transport control, commentary pane, telemetry subscriber, host adapter, or harness component may independently declare or mutate canonical semantic position.

Subject-specific `state` remains opaque to Core. Core may associate an opaque state payload with a semantic boundary but cannot inspect its domain-specific contents.

## Consequences

- Transport sends commands to `CiMInstance` rather than changing visual or commentary state directly.
- Commentary projects canonical position rather than deriving position from its own DOM.
- Renderers receive the state selected by runtime orchestration and cannot advance the semantic timeline.
- Telemetry reports canonical transitions but cannot cause them.
- Fault recovery resolves against the last committed stable boundary.
- Multi-instance pages maintain independent session models and event sequences.
- A subject-state or render digest cannot substitute for `currentStepId` because multiple semantic positions may intentionally have equivalent state.

## Rejected Alternatives

### Renderer-owned position

Rejected because visual state is one projection of the instructional session and may remain unchanged across observation steps.

### Transport-owned position

Rejected because transport is a learner-facing control surface rather than the owner of renderer settlement, commentary, recovery, or host initialization.

### Event-stream-owned position

Rejected because events are observation records. Reconstructing live authority from asynchronously consumed events introduces ordering and replay ambiguity.

### Distributed shared ownership

Rejected because seek, cancellation, reverse, and recovery would require consensus among presentation modules.

## Verification

The synthetic harness must prove that after every accepted command:

- one canonical position is observable;
- transport, commentary, and renderer settlement agree with that position;
- observation steps may advance `currentStepId` while state and render digests remain unchanged;
- a failed transition cannot partially commit canonical position.
