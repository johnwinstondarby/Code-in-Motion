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

The Core implementation separates readable Core capability, pure navigation resolution, semantic mutation authority, fault mutation authority, and privileged status mutation so non-Runtime components cannot reach Core mutation by ordinary object access or aliasing. ADR 0008 defines the status-authority boundary; `CIM-SPEC.md` §9 defines transactional semantic commit; `docs/FAULTS.md` defines fault ownership and recovery classes.

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

`read.snapshot()` returns a fresh frozen snapshot containing exactly the canonical v1 fields defined by `CIM-SPEC.md` §3.1. `read.boundaryIds()` returns the frozen semantic boundary order.

`navigation.resolve(request)` remains pure. Resolution reads both the last committed boundary and whether a pending target exists, but does not mutate canonical state. During an in-flight transition, `previous()` resolves to the committed source boundary with `result: no_change`, matching `CIM-SPEC.md` §7.3.

`semanticControl` is retained by Runtime-facing composition code. `beginTarget(stepId)` validates and records one pending semantic destination without changing `currentStepId`. A second pending target cannot replace the active target implicitly; Runtime must cancel or abandon the existing target first.

`commitTarget(expectedStepId)` succeeds only when the expected ID exactly matches the active pending target. It updates `currentStepId` and clears `targetStepId` in one synchronous mutation. A missing or mismatched expected target fails without changing canonical state. This prevents a stale settlement for a different destination from committing over the active target.

`abandonTarget(expectedStepId)` clears only the matching pending target and preserves `currentStepId`. Renderer failure or cancellation can therefore leave the last committed semantic boundary as the recovery anchor required by `CIM-SPEC.md` §9.

## Checkpoint 4 reveal frontier and restart policy

Successful ordinary semantic commits advance `revealFrontier` to the later of its existing high-water mark and the committed destination. This makes reveal state monotonic across normal navigation. Forward playback, forward seek, deep-link-style arrival, and `end()` can advance the frontier. Backward seek, `previous()`, and `home()` can change `currentStepId` without hiding commentary already revealed.

`beginTarget()` and `abandonTarget()` do not reveal commentary. Reveal advancement occurs only after `commitTarget()` confirms stable settlement.

`restart()` is the single v1 operation allowed to lower the reveal frontier. Runtime resolves restart to `initial`, settles that destination, then calls `commitRestart()`. The operation succeeds when `initial` is the active pending target, or when `initial` is already the committed stable boundary. It sets `currentStepId` to `initial`, clears `targetStepId`, and resets `revealFrontier` to `initial` synchronously. A different active target or an unstabilized non-initial position fails closed without changing state.

## Checkpoint 5 canonical fault state and recovery lifecycle

The composition object exposes five frozen capabilities:

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
  commitRestart()

faultControl
  recordFault(fault)
  clearRecoverableFault(expectedCode)

statusControl
  setStatus(nextStatus)
```

Canonical `error` is either `null` or one frozen record with exactly:

```text
code
component
recoveryClass
```

`code` uses a documented `CIM-*` namespace. `component` must match that namespace. `recoveryClass` is either `recover` or `fallback`, the two `FAULTS.md` classes that represent active fault state. `reject` and `ignore stale work` do not populate canonical `error`.

`recordFault()` accepts only exact enumerable data properties and rebuilds the record into a fresh frozen object. Core requires `targetStepId === null` before canonical fault storage, so Runtime must cancel or abandon active semantic work first. This preserves `currentStepId` as the recovery anchor.

A `recover` fault stores transient canonical error context while leaving the current activity status unchanged. Successful restoration clears it through `clearRecoverableFault(expectedCode)`. A second recoverable fault cannot overwrite active recovery context. A recoverable fault may escalate to a `fallback` fault when restoration fails.

A `fallback` fault atomically stores the replacement canonical error and sets status to `faulted`. Direct `setStatus("faulted")` is prohibited because `faulted` must have matching canonical error state. Once faulted, semantic mutation is unavailable and the only status transition is to `disposed`.

A successfully settled restart clears a `recover` fault together with the reveal-frontier reset. Restart cannot clear a fallback-class fault. Historical fault evidence remains in the event stream even after Core clears transient canonical error state.

`statusControl` remains the privileged activity-status capability. Production composition code may retain it only in Runtime. `semanticControl` and `faultControl` are likewise Runtime-facing mutation capabilities. The read and navigation capabilities contain no mutation authority.

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

The synthetic fixture must prove deterministic seek, next, previous, restart, reserved-initial behavior, semantic no-op steps, boundary `no_change` behavior, reveal-frontier rules, documented status writes, stable commit behavior, and fault recovery independently of Git.

Checkpoint 1 proves exact initial state, frozen read snapshots, structural separation of read and privileged status capabilities, canonical status validation, terminal `disposed`, invalid-write atomicity, and multi-instance isolation.

Checkpoint 2 proves canonical boundary ordering, exact navigation-request validation, non-wrapping next/previous behavior, valid and invalid seek behavior, home/end/restart destination resolution, semantic advancement independent of subject-state identity, and zero canonical-state mutation during stable-boundary resolution.

Checkpoint 3 proves one-pending-target ownership, target validation, atomic commit-and-clear, stale commit and stale abandon rejection, failure/cancellation preservation of the committed recovery anchor, paused-transition position preservation, and in-flight `previous()` semantics.

Checkpoint 4 proves monotonic reveal advancement on successful commit, backward-navigation reveal preservation, `home()` preservation, `end()` advancement, transactional restart reset, stable-initial restart reset, and fail-closed restart guards.

Checkpoint 5 proves exact frozen canonical fault records, namespace/component alignment, pending-target clearance before fault storage, recoverable-fault clearing, recover-to-fallback escalation, atomic fallback/faulted alignment, fallback terminality, restart clearing of recoverable transient error only, and preservation of the last committed recovery anchor.

The full Core implementation gate must additionally prove that only Runtime receives privileged Core mutation capabilities.
