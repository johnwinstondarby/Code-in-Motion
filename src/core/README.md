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

The Core implementation separates readable Core capability, pure navigation resolution, semantic mutation authority, and privileged status mutation so non-Runtime components cannot reach Core mutation by ordinary object access or aliasing. ADR 0008 defines the status-authority boundary; `CIM-SPEC.md` §9 defines transactional semantic commit.

## Checkpoint 1 capability shape

Checkpoint 1 established closure-private canonical state, frozen read snapshots, and the privileged activity-status capability.

The initial canonical state is `idle` at boundary `initial`, with no pending target, reveal frontier `initial`, and no canonical error. `disposed` is terminal.

## Checkpoint 2 boundary and navigation model

`createCoreEngine()` receives the ordered authored `stepIds` from validated experience data. Core builds one frozen semantic boundary order:

```text
initial
stepIds[0]
stepIds[1]
...
```

The boundary model receives identifiers only. Opaque subject state and renderer configuration are unavailable to navigation resolution, so equivalent subject states cannot suppress semantic advancement.

Boundary exhaustion follows the public command contract: `previous` at `initial` returns `no_change` with `at_start`, and `next` at the final authored step returns `no_change` with `at_end`. An unknown seek target returns `rejected` with `unknown_step`. `home` and `restart` both resolve to `initial`; their different reveal, playback, dwell, and error effects remain outside pure destination resolution.

## Checkpoint 3 pending target and transactional commit

The composition object exposes four frozen capabilities:

```text
read
  snapshot()
  boundaryIds()

navigation
  resolve(request)

semanticControl
  beginTarget(stepId)
  commitTarget(expectedStepId)
  abandonTarget(expectedStepId)

statusControl
  setStatus(nextStatus)
```

`read.snapshot()` returns a fresh frozen snapshot containing exactly the canonical v1 fields defined by `CIM-SPEC.md` §3.1. `read.boundaryIds()` returns the frozen semantic boundary order.

`navigation.resolve(request)` remains pure. Resolution reads both the last committed boundary and whether a pending target exists, but does not mutate canonical state. During an in-flight transition, `previous()` resolves to the committed source boundary with `result: no_change`, matching `CIM-SPEC.md` §7.3.

`semanticControl` is retained by Runtime-facing composition code. `beginTarget(stepId)` validates and records one pending semantic destination without changing `currentStepId`. A second pending target cannot replace the active target implicitly; Runtime must cancel or abandon the existing target first.

`commitTarget(expectedStepId)` succeeds only when the expected ID exactly matches the active pending target. It updates `currentStepId` and clears `targetStepId` in one synchronous mutation. A missing or mismatched expected target fails without changing canonical state. This prevents a stale settlement for a different destination from committing over the active target.

`abandonTarget(expectedStepId)` clears only the matching pending target and preserves `currentStepId`. Renderer failure or cancellation can therefore leave the last committed semantic boundary as the recovery anchor required by `CIM-SPEC.md` §9.

Checkpoint 3 does not mutate status, reveal frontier, or canonical error as a side effect of target begin/commit/abandon. Reveal policy, restart reset behavior, and canonical fault settlement remain later Core checkpoints.

`statusControl` remains the privileged activity-status capability. Production composition code may retain it only in Runtime. The read and navigation capabilities contain no mutation authority.

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

Checkpoint 2 proves canonical boundary ordering, exact navigation-request validation, non-wrapping next/previous behavior, valid and invalid seek behavior, home/end/restart destination resolution, semantic advancement independent of subject-state identity, and zero canonical-state mutation during stable-boundary resolution.

Checkpoint 3 proves one-pending-target ownership, target validation, atomic commit-and-clear, stale commit and stale abandon rejection, failure/cancellation preservation of the committed recovery anchor, paused-transition position preservation, and in-flight `previous()` semantics.

The full Core implementation gate must additionally prove that only Runtime receives privileged Core mutation capabilities.
