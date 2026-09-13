# Engine Core

## Purpose

Core owns and mutates the canonical semantic session state used by a CiM instance.

## Owns

- Current committed semantic boundary, including reserved `initial`
- Pending semantic target position
- Canonical playback/session status
- Reveal-frontier state required by the semantic model
- Canonical fault state required by session semantics
- Validation of semantic navigation requests against the loaded experience
- Canonical semantic commit after Runtime confirms stable renderer settlement

The normative session model is defined in `docs/CIM-SPEC.md` §3.

`status` is stored canonically by Core. Runtime is the only production component authorized to request an activity-status change through the privileged `setStatus(nextStatus)` control capability. Core does not derive `playing`, `transitioning`, or `paused` from Runtime-owned operational fields.

The Core implementation separates shared/readable Core capability from privileged mutation capability so non-Runtime components cannot obtain `setStatus` by ordinary object access or aliasing. ADR 0008 defines the authority boundary.

## Checkpoint 1 capability shape

`createCoreEngine()` owns mutable canonical state inside a closure and returns one frozen composition object with two frozen capabilities:

```text
read
  snapshot()

statusControl
  setStatus(nextStatus)
```

`read.snapshot()` returns a fresh frozen snapshot containing exactly the canonical v1 fields defined by `CIM-SPEC.md` §3.1. The read capability contains no status-mutation authority.

`statusControl` is the privileged activity-status capability. Production composition code may retain it only in Runtime. Other components receive Runtime projections or the read capability where the architecture permits them to observe Core state.

The initial canonical state is `idle` at boundary `initial`, with no pending target, reveal frontier `initial`, and no canonical error. `disposed` is terminal. Navigation, reveal-frontier advancement, pending-target mutation, fault settlement, and semantic commit behavior are added in later Core checkpoints.

## Does not own

- Runtime transition identity or normalized animation progress
- Continuous playback intent
- Dwell scheduling
- Abort/cancellation mechanics
- Subject-specific state interpretation
- Renderer presentation
- Commentary presentation
- Host behavior
- Telemetry storage

## Allowed dependencies

May depend on stable validated-experience interfaces, `src/contracts/`, and semantic contracts defined by the architecture.

## Prohibited dependencies

Core must not inspect inside opaque experience `state` or `renderer_config`. Core must not know Git terminology, renderer DOM structure, transport internals, commentary internals, or harness implementation.

## Verification

The synthetic fixture must prove deterministic seek, next, previous, restart, reserved-initial behavior, semantic no-op steps, boundary `no_change` behavior, reveal-frontier rules, documented status writes, and stable commit behavior independently of Git.

Checkpoint 1 proves exact initial state, frozen read snapshots, structural separation of read and privileged status capabilities, canonical status validation, terminal `disposed`, invalid-write atomicity, and multi-instance isolation.

The full Core implementation gate must additionally prove that only Runtime receives the privileged status-mutation capability.
