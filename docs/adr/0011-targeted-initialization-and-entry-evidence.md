# ADR 0011: Targeted Initialization and Session-Entry Evidence

Status: Accepted

Date: 2026-09-15

## Context

Runtime checkpoint 6 completed terminal disposal and stale-work containment. The next Runtime seam is semantic entry at a boundary selected before renderer initialization, including Host-resolved deep links and deterministic replay.

Host owns URL and fragment parsing. Runtime owns semantic settlement. Allowing Runtime to accept URL fragments would leak Host policy into the Runtime/Core boundary and create a second deep-link parser.

The existing `step.initial` event was defined around the literal `initial` boundary. Direct entry at an authored boundary makes that definition too narrow. Startup entry also has provenance but no learner command and therefore no `command_id`.

## Decision

### Runtime receives a boundary ID, never a URL fragment

Host resolves external navigation syntax to an experience identity and semantic boundary before calling Runtime. Runtime accepts only the resolved boundary ID and initialization provenance.

The v1 initialization surface is:

```text
initialize()
initialize({ stepId, source })
```

Defaults are:

```text
stepId = initial
source = host
```

Valid initialization provenance is:

```text
host
deep_link
replay
```

Transport, marker, commentary, and scrub sources remain command provenance and cannot initiate the instance lifecycle directly.

### Initialization target validation precedes renderer lifecycle

Runtime validates lifecycle state, initialization options, the requested semantic boundary, renderer contract, renderer root, and scheduler before `renderer.mount()` begins.

An unknown initialization boundary throws synchronously from `initialize()` before renderer mount, transition allocation, event publication, or canonical mutation. Because no lifecycle work began, the caller may retry initialization with a valid boundary.

### Targeted entry is one absolute render

A valid targeted initialization performs one renderer mount and one absolute render of the requested entry boundary. Runtime does not initialize at `initial` and then seek to the requested target.

The entry render uses:

```text
animate = false
fromState = null
fromStepId = null
stepId = requested entry boundary
state = complete state of requested entry boundary
stepRendererConfig = requested boundary renderer configuration, or null for initial
```

The standard ten-key renderer context remains unchanged.

For an authored entry boundary, Runtime opens that boundary as the pending semantic target before rendering and commits it only after stable renderer settlement. Renderer failure abandons the pending target and leaves the canonical committed boundary at `initial` with no entry event.

### `step.initial` means session entry

`step.initial` is the exactly-once successful session-entry event. The name is retained for v1 compatibility, but its semantic meaning is broader than the literal `initial` boundary.

`step.initial.step_id` may be any valid semantic boundary ID. It identifies the boundary at which the session entered stable semantic operation.

Startup entry has no predecessor and no learner command. `step.initial` therefore carries no `command_id` and does not imply `step.changed`.

Initialization provenance is recorded as:

```text
details.source = host | deep_link | replay
```

### Entry frontier follows the entry boundary

A direct authored-boundary entry initializes canonical semantic position and reveal frontier to that boundary. Entry at `initial` leaves both at `initial`.

`restart()` remains a fresh-session semantic reset and returns both `currentStepId` and `revealFrontier` to `initial`. `home()` remains distinct and preserves the reveal frontier according to the existing v1 navigation contract.

### Entry does not consume authored dwell

Authored dwell is consumed only after a step commits as the result of continuous playback. Direct initialization, including deep-link entry, never consumes the target boundary's `dwell_ms`.

An explicit `play()` from a targeted entry begins the following transition immediately. If the entry boundary is the final authored step, `play()` is accepted with `no_change` and `at_end`; it does not consume dwell or render again.

### Shared validated experience data remains inert

Multiple `CiMInstance` objects may receive the same frozen validated experience object. Targeted initialization keeps canonical state, transition correlation, renderer calls, and event streams instance-local. Initialization never writes to the shared experience graph.

### Terminal acknowledgement uses injected time

The checkpoint 6 acknowledgement bound remains measured in injected CiM time for deterministic replay. The Host must continue advancing the injected CiM clock through terminal teardown. Suspending that clock also suspends acknowledgement-timeout progress and can leave an instance in `disposing` until clock advancement resumes.

## Consequences

Host remains the only component that interprets URL or fragment syntax. Runtime receives semantic identity only.

Direct deep-link entry does not create an artificial command, intermediate `initial` render, `step.changed`, or dwell interval.

Replay can reproduce startup position and provenance without inventing a learner command.

`EVENTS.md`, `CIM-SPEC.md`, Runtime documentation, and replay evidence use the session-entry meaning of `step.initial`.

## Verification

Checkpoint 7 focused verification proves default entry, direct authored-boundary entry, exact target state and renderer context, pre-mount validation, entry provenance/frontier, restart reset, dwell exclusion, final-entry `play()` behavior, targeted renderer-failure cleanup, disposal-time entry cancellation, reentrant-disposal commit prevention, and shared-experience instance isolation.

Checkpoint 7 is complete only after its focused suite and the full `npm run verify` gate both pass.
