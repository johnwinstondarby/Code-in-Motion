# ADR 0005: Semantic Navigation and In-Flight Transition Handling

Status: Accepted for CiM v1

## Context

CiM allows a learner to pause at any time while also supporting direct semantic navigation such as next, previous, seek, restart, Home, End, marker selection, commentary selection, and semantic scrub commit.

A single rule that says every command aborts an active transition would violate learner-controlled pause behavior. A rule that queues all commands would make rapid navigation difficult to reason about.

The runtime therefore needs separate semantics for continuity controls and navigation controls.

## Decision

CiM distinguishes continuity commands from navigation commands.

### Continuity commands

`pause()` and `play()` preserve the active transition or dwell interval.

When pause occurs during a transition:

```text
Core.currentStepId = last committed stable boundary
Core.targetStepId = pending destination
Runtime.transitionProgress = frozen current progress
Core.status = paused
```

Pause does not commit the target step. A later play resumes the same transition under the injected CiM clock.

When pause occurs during authored dwell, Runtime freezes the remaining dwell interval. A later play resumes the remainder.

### Navigation commands

Every discrete navigation command clears continuous playback intent.

If playback intent was active, Runtime emits `playback.stopped` before resolving the new navigation request. The normal reason is `navigation`; restart may use `restart`.

Navigation commands include:

```text
next()
previous()
seek(stepId)
restart()
home()
end()
marker selection
commentary-step selection
scrub commit
```

Navigation cancels an active animated transition or remaining dwell and resolves deterministically to the requested semantic destination using absolute, non-animated rendering.

Core commits `currentStepId` only after the requested destination has settled successfully.

For an in-flight transition from committed B to target C:

```text
next()       -> cancel animation, render C absolutely, commit C
previous()   -> cancel animation, render B absolutely, no semantic movement
seek(D)      -> cancel animation, render D absolutely, commit D
restart()    -> cancel animation, render initial absolutely, commit initial and reset reveal state
```

Mid-transition `previous()` is accepted with `result: "no_change"` because B is already the committed boundary. A second `previous()` from stable B moves to the preceding semantic boundary.

The runtime does not maintain an unbounded queue of semantic navigation commands. A newly accepted navigation command supersedes active transition or dwell work according to `CIM-SPEC.md`.

## Consequences

- Pause remains a true freeze of learner-controlled time.
- Semantic navigation never depends on partially rendered intermediate state.
- Navigation leaves the learner at the requested stable destination instead of silently continuing continuous playback.
- Stable commit remains transactional: a destination becomes current only after successful settlement.
- Recovery can return to the last committed stable boundary if destination settlement fails.
- Scrub uses the same seek semantics after its transport-local preview commits.

## Rejected Alternatives

### Abort every command

Rejected because pause would cease to preserve an inspectable intermediate visual state.

### Preserve playback intent after navigation

Rejected because marker, commentary, scrub, Home, End, and seek operations are explicit learner requests to inspect a semantic destination. Automatically advancing after arrival would make identical commands produce surprising learner-visible behavior.

### Queue every command

Rejected because rapid marker selection could create stale work and ambiguous learner intent.

### Commit target position at transition start

Rejected because a renderer failure could leave canonical position ahead of the visible stable state.

### Continue an old animation after semantic seek

Rejected because the old transition is no longer the learner's requested path and may later overwrite the new destination.

## Verification

The harness must prove:

- pause freezes transition progress and leaves canonical `currentStepId` unchanged;
- pause freezes dwell without consuming virtual time;
- play resumes the same transition or remaining dwell;
- navigation clears playback intent;
- navigation during animation cancels the active transition;
- navigation during dwell cancels remaining dwell;
- stale scheduler callbacks from cancelled work cannot commit or alter the new destination;
- mid-transition `previous()` produces accepted `no_change` when the source boundary is already committed;
- destination commit occurs only after successful stable settlement;
- renderer failure before settlement leaves the last committed stable boundary recoverable.
