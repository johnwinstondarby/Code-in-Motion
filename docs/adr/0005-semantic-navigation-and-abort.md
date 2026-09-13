# ADR 0005: Semantic Navigation and In-Flight Transition Handling

Status: Accepted for CiM v1

## Context

CiM allows a learner to pause at any time while also supporting direct semantic navigation such as next, previous, seek, restart, Home, End, marker selection, and commentary selection.

A single rule that says every command aborts an active transition would violate learner-controlled pause behavior. A rule that queues all commands would make rapid scrub and repeated seek difficult to reason about.

The runtime therefore needs separate semantics for continuity controls and navigation controls.

## Decision

CiM distinguishes continuity commands from navigation commands.

### Continuity commands

`pause()` and `play()` preserve the active transition.

When pause occurs during a transition:

```text
currentStepId = last committed stable step
targetStepId = pending destination
transitionProgress = frozen current progress
status = paused
```

Pause does not commit the target step. A later play resumes the same transition under the injected CiM clock.

### Navigation commands

Navigation commands cancel any active animated transition and resolve deterministically to the requested semantic destination using absolute, non-animated rendering.

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
```

`currentStepId` commits only after the requested destination has settled successfully.

For an in-flight transition from B to C:

```text
next()       -> cancel animation, render C absolutely, commit C
previous()   -> cancel animation, render B absolutely, commit B
seek(D)      -> cancel animation, render D absolutely, commit D
restart()    -> cancel animation, render INITIAL absolutely, commit INITIAL
```

The runtime does not maintain an unbounded queue of semantic navigation commands. A newly accepted navigation command supersedes the active transition request according to the command rules defined in `CIM-SPEC.md`.

## Consequences

- Pause remains a true freeze of learner-controlled time.
- Semantic navigation never depends on partially rendered intermediate state.
- Rapid seek does not require replaying every crossed animation.
- Stable commit remains transactional: a destination becomes current only after successful settlement.
- Recovery can return to the last committed stable boundary if destination settlement fails.

## Rejected Alternatives

### Abort every command

Rejected because pause would cease to preserve an inspectable intermediate visual state.

### Queue every command

Rejected because rapid scrub and repeated marker selection could create stale work and ambiguous learner intent.

### Commit target position at transition start

Rejected because a renderer failure could leave canonical position ahead of the visible stable state.

### Continue an old animation after semantic seek

Rejected because the old transition is no longer the learner's requested path and may later overwrite the new destination.

## Verification

The harness must prove:

- pause freezes transition progress and leaves `currentStepId` unchanged;
- play resumes the same transition;
- navigation during animation cancels the active transition;
- stale scheduler callbacks from a cancelled transition cannot commit or alter the new destination;
- destination commit occurs only after successful stable settlement;
- renderer failure before settlement leaves the last committed stable step recoverable.
