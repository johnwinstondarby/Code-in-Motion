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

The Core implementation separates readable Core capability, pure navigation resolution, and privileged mutation capability so non-Runtime components cannot obtain `setStatus` by ordinary object access or aliasing. ADR 0008 defines the authority boundary.

## Checkpoint 1 capability shape

Checkpoint 1 established closure-private canonical state, frozen read snapshots, and the privileged activity-status capability.

The initial canonical state is `idle` at boundary `initial`, with no pending target, reveal frontier `initial`, and no canonical error. `disposed` is terminal.

## Checkpoint 2 boundary and navigation model

`createCoreEngine()` now receives the ordered authored `stepIds` from validated experience data. Core builds one frozen semantic boundary order:

```text
initial
stepIds[0]
stepIds[1]
...
```

The boundary model receives identifiers only. Opaque subject state and renderer configuration are unavailable to navigation resolution, so equivalent subject states cannot suppress semantic advancement.

The composition object exposes three frozen capabilities:

```text
read
  snapshot()
  boundaryIds()

navigation
  resolve(request)

statusControl
  setStatus(nextStatus)
```

`read.snapshot()` returns a fresh frozen snapshot containing exactly the canonical v1 fields defined by `CIM-SPEC.md` §3.1. `read.boundaryIds()` returns the frozen semantic boundary order.

`navigation.resolve(request)` is pure in checkpoint 2. It resolves `next`, `previous`, `seek`, `home`, `end`, and `restart` against the current committed boundary but does not mutate `currentStepId`, `targetStepId`, reveal state, error state, or status. Runtime settlement and Core target/commit mutation are added in checkpoint 3.

Boundary exhaustion follows the public command contract: `previous` at `initial` returns `no_change` with `at_start`, and `next` at the final authored step returns `no_change` with `at_end`. An unknown seek target returns `rejected` with `unknown_step`. `home` and `restart` both resolve to `initial`; their different reveal, playback, dwell, and error effects remain outside this pure resolution checkpoint.

`statusControl` remains the privileged activity-status capability. Production composition code may retain it only in Runtime. The read and navigation capabilities contain no status-mutation authority.

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

Checkpoint 2 proves canonical boundary ordering, exact navigation-request validation, non-wrapping next/previous behavior, valid and invalid seek behavior, home/end/restart destination resolution, semantic advancement independent of subject-state identity, and zero canonical-state mutation during resolution.

The full Core implementation gate must additionally prove that only Runtime receives the privileged status-mutation capability.
