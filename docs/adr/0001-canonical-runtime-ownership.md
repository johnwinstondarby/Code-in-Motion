# ADR 0001: Canonical Runtime Ownership

Status: Accepted for CiM v1

## Context

CiM coordinates transport, commentary, rendering, fault recovery, deep linking, telemetry, and replay around one learner-controlled semantic timeline. Independent modules cannot maintain separate authoritative ideas of the current semantic position without creating disagreement during seek, reverse, pause, recovery, or replay.

The architecture therefore requires one owner for canonical semantic position and one orchestration boundary for cross-component sequencing.

## Decision

`CiMInstance` is the composition and orchestration root for one mounted CiM experience.

Core owns and mutates the canonical semantic session state through a documented interface. Runtime decides when a requested destination is eligible to settle and asks Core to commit only after stable renderer settlement succeeds.

`CIM-SPEC.md` §3 is the normative session-model definition. Other documents must reference that model rather than restating a divergent field list.

Core owns canonical semantic facts, including the committed semantic position and reveal frontier. Runtime owns operational transition mechanics, correlation identifiers, normalized transition progress, abort state, and continuous playback intent.

The reserved semantic boundary identifier `initial` represents the stable boundary before the first authored step.

No renderer, transport control, commentary pane, telemetry subscriber, host adapter, or harness component may independently declare or mutate canonical semantic position.

Subject-specific `state` remains opaque to Core. Core may associate an opaque state payload with a semantic boundary but cannot inspect its domain-specific contents.

## Consequences

- Transport sends commands to `CiMInstance` rather than changing visual or commentary state directly.
- Runtime sequences renderer settlement and asks Core to commit the destination after successful settlement.
- Core validates and commits canonical semantic movement against the loaded semantic timeline.
- `step.changed` is a Core-owned event because it reports the canonical commit.
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

### Runtime-owned canonical commit

Rejected because it collapses orchestration and semantic authority into one module and contradicts the dedicated Core boundary. Runtime sequences; Core commits.

### Event-stream-owned position

Rejected because events are observation records. Reconstructing live authority from asynchronously consumed events introduces ordering and replay ambiguity.

### Distributed shared ownership

Rejected because seek, cancellation, reverse, and recovery would require consensus among presentation modules.

## Verification

The synthetic harness must prove that after every accepted command:

- one canonical position is observable from Core;
- transport, commentary, and renderer settlement agree with that position;
- observation steps may advance `currentStepId` while state and render digests remain unchanged;
- a failed transition cannot partially commit canonical position;
- Runtime cannot emit a successful semantic commit without the corresponding Core commit.
