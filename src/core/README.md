# Engine Core

## Purpose

Core owns and mutates the canonical semantic session state for one CiM instance.

## Owns

- Current committed semantic boundary, including reserved `initial`
- Pending semantic target
- Canonical session status
- Reveal frontier
- Canonical fault state
- Semantic navigation validation
- Canonical semantic commit after Runtime confirms stable settlement

The normative session model is `docs/CIM-SPEC.md` §3. Fault ownership and recovery classes are defined in `docs/FAULTS.md`.

## Capability model

Core constructs five frozen capabilities:

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

Only `read` and `navigation` are shareable beyond Runtime. The Runtime composition seam receives the complete Core object, publishes a projection containing only `read` and `navigation`, and retains a one-shot grant containing `semanticControl`, `faultControl`, and `statusControl`.

ADR 0008 defines the privileged-control boundary. `tools/check-core-authority.mjs` enforces the production ownership rule in addition to the general architecture checker.

## Checkpoint 1: canonical state ownership

Core owns the canonical v1 fields:

```text
instanceId
experienceId
experienceVersion
status
currentStepId
targetStepId
revealFrontier
error
```

Initial state is `idle` at `initial`, with no pending target, reveal frontier `initial`, and no canonical error. Snapshots are fresh and frozen. `disposed` is terminal.

## Checkpoint 2: semantic boundary resolution

Core builds one ordered boundary sequence:

```text
initial
stepIds[0]
stepIds[1]
...
```

Navigation resolution depends on semantic boundary identity, not subject-state equality. `next`, `previous`, `seek`, `home`, `end`, and `restart` resolve deterministically. Boundary exhaustion returns `no_change`; unknown seek targets return `rejected`.

## Checkpoint 3: pending target and transactional commit

`beginTarget()` records one pending destination without advancing `currentStepId`.

`commitTarget()` requires an exact match to the active target, then advances `currentStepId` and clears `targetStepId` synchronously.

`abandonTarget()` clears only the expected target and preserves the last committed boundary as the recovery anchor.

During an in-flight transition, `previous()` resolves back to the committed boundary with `no_change`.

## Checkpoint 4: reveal frontier and restart

Ordinary successful commits advance `revealFrontier` only when the committed destination is beyond the existing high-water mark.

Backward navigation and `home()` preserve previously revealed commentary. `end()` can advance the frontier to the final boundary.

`commitRestart()` is the sole v1 path allowed to reset the frontier to `initial`. Reset occurs only after `initial` is stable.

## Checkpoint 5: canonical fault lifecycle

Canonical `error` is `null` or one frozen record with exactly:

```text
code
component
recoveryClass
```

`recover` records transient recovery context and preserve the committed recovery anchor. Successful restoration clears the exact recoverable fault.

`fallback` atomically stores canonical error state and enters `faulted`. Direct `setStatus("faulted")` is invalid. Faulted Core state may advance only to `disposed`.

Restart can clear a recoverable fault after stable settlement at `initial`; it cannot clear a fallback fault.

## Checkpoint 6: lifecycle gates and Runtime-only authority

When status is `faulted`, every otherwise-valid navigation request returns:

```text
result = rejected
reason = faulted
```

When status is `disposed`, every otherwise-valid navigation request returns:

```text
result = rejected
reason = disposed
```

The lifecycle gate still performs exact request-shape validation first. It does not invoke accessors and does not permit malformed requests to hide behind a lifecycle rejection.

`src/runtime/core-session.mjs` is the production composition seam for Core ownership. It creates Core, publishes only the frozen `read` and `navigation` projection, and stores the mutation controls in a private WeakMap. `acquireRuntimeCoreControls()` is a one-shot grant: after Runtime acquires the controls once, the projection cannot yield them again.

The repository gate enforces three rules:

```text
non-Runtime production code cannot import src/core/
non-Runtime production code cannot import src/runtime/core-session.mjs
privileged Core-control identifiers are reserved to src/core/ and src/runtime/
```

Package aliases are resolved before the authority check.

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

Core may depend on stable validated-experience interfaces, `src/contracts/`, and semantic contracts defined by the architecture.

## Prohibited dependencies

Core does not import Runtime, Transport, Commentary, Renderers, Host, Telemetry, Accessibility, Experience adapters, or harness code. Core does not inspect opaque experience `state` or `renderer_config`.

## Verification

Core verification now covers:

- exact initial canonical state;
- frozen snapshots and instance isolation;
- deterministic semantic boundary resolution;
- transactional target begin/commit/abandon;
- stale-settlement rejection;
- reveal-frontier monotonicity and restart reset;
- exact canonical fault records and recovery lifecycle;
- faulted/disposed command rejection reasons;
- private Runtime Core-session composition;
- one-shot mutation-control grant;
- static rejection of non-Runtime Core imports and privileged capability references.

The next integration gate is the full branch `npm run verify` matrix before merge.
