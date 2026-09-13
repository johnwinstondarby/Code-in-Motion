# Code in Motion (CiM) Runtime Specification

Status: Normative v1 specification

## 1. Scope

This specification defines the shared runtime behavior for Code in Motion. It covers semantic position, command handling, transition settlement, renderer lifecycle, commentary reveal, deep links, reduced motion, fault settlement, and multi-instance isolation.

Subject-specific visual meaning is outside this specification. Git-specific behavior belongs to Git experience data and Git renderer documentation.

## 2. Terms

### Semantic boundary

A stable instructional position identified by an experience step ID. A semantic boundary may represent a state-changing operation or an observation that leaves subject state unchanged.

### Initial boundary

The stable experience state before the first semantic step. It is addressable internally and used by `home()` and `restart()`.

### Committed step

The last semantic boundary that completed stable settlement successfully.

### Pending target

The semantic destination of an active transition that has not yet committed.

### Subject state

The opaque renderer state associated with a semantic boundary. Core may select and pass this value but must not interpret its contents.

### Stable settlement

The point at which the renderer has completed the requested absolute destination output and runtime may commit the semantic destination.

### Reveal frontier

The highest semantic step whose commentary has been revealed during the current session.

## 3. Canonical Session State

One `CiMInstance` owns one canonical session.

The runtime state must represent at least:

```text
instanceId
experienceId
experienceVersion
status
playbackIntent
currentStepId
targetStepId
transitionId
transitionProgress
revealFrontier
error
```

`currentStepId` is `null` at the initial boundary unless the implementation gives the initial boundary a reserved internal identifier.

`targetStepId` is `null` when no semantic transition is pending.

`transitionProgress` is meaningful only when a transition exists and is normalized to the closed interval `[0, 1]`.

`playbackIntent` distinguishes continuous playback intent from a one-step navigation operation.

### 3.1 Status values

The externally meaningful v1 statuses are:

- `idle`: stable and not continuously playing;
- `playing`: continuous playback is requested and the instance is between transition operations;
- `transitioning`: an animated or semantic transition is actively progressing;
- `paused`: learner-controlled time is frozen; a pending target may or may not exist;
- `faulted`: playback is stopped because stable continuation is unavailable;
- `disposed`: the instance no longer accepts commands.

Implementations may use additional private substates but must preserve these observable semantics.

## 4. Semantic Position Is Independent from State Identity

A semantic step can advance while subject state remains equivalent to the prior step.

The reference synthetic sequence is:

```text
INITIAL -> A
step-01 -> B
step-02 -> B   observation
step-03 -> C
step-04 -> D
```

After `step-01 -> step-02`:

- `currentStepId` advances to `step-02`;
- active commentary advances to `step-02`;
- the active semantic marker advances to `step-02`;
- the semantic event sequence advances;
- state and render digests may remain unchanged.

A digest comparison must never determine semantic position.

## 5. Command Interface

The shared command surface is:

```text
play()
pause()
next()
previous()
seek(stepId)
home()
end()
restart()
```

Marker selection and commentary-entry selection resolve to `seek(stepId)` rather than defining independent navigation semantics.

Commands are submitted to `CiMInstance`. Peer modules do not call one another to implement navigation.

Every accepted command receives a command/correlation identity suitable for telemetry and deterministic replay.

## 6. Command Semantics at Stable Boundaries

### 6.1 `play()`

At a stable boundary with a following step, `play()` sets continuous playback intent and begins transition toward the following semantic boundary.

At the final step, `play()` leaves the instance stable at the final step and does not wrap to the beginning.

### 6.2 `pause()`

At a stable boundary, `pause()` sets status to `paused` without changing semantic position.

### 6.3 `next()`

At a stable boundary, `next()` resolves to the immediately following semantic boundary.

At the final step, `next()` is a successful no-movement command or a rejected boundary command according to the transport API contract, but it must not wrap. The chosen return code must be consistent across all control surfaces.

For v1, the recommended behavior is an accepted no-movement result with an explicit `at_end` result code.

### 6.4 `previous()`

At a stable step, `previous()` resolves to the immediately preceding semantic boundary. From the first semantic step, it resolves to the initial boundary.

At the initial boundary, it does not wrap.

### 6.5 `seek(stepId)`

`seek(stepId)` resolves directly to the named valid semantic boundary. It does not animate through intervening steps.

An unknown step ID is rejected without changing session state.

### 6.6 `home()`

`home()` resolves to the initial boundary and preserves the current reveal frontier.

### 6.7 `end()`

`end()` resolves directly to the final semantic boundary. The reveal frontier advances to the final step because the learner intentionally requested that semantic position.

### 6.8 `restart()`

`restart()` resolves to the initial boundary, stops continuous playback, clears pending transition state, resets the reveal frontier to its initial value, clears recoverable transient error state, and prepares the experience to begin again.

`restart()` is therefore distinct from `home()`.

## 7. In-Flight Transition Semantics

Continuity commands and navigation commands behave differently while a transition is active.

### 7.1 Pause during transition

`pause()` freezes the injected CiM clock and preserves the active transition.

While paused mid-transition:

```text
currentStepId = last committed step
targetStepId = pending destination
transitionProgress = frozen progress
status = paused
```

No semantic commit occurs.

### 7.2 Play after paused transition

`play()` resumes the same transition from the frozen progress position using the same transition identity unless the implementation requires a new internal scheduling token. The semantic destination remains unchanged.

### 7.3 Navigation during transition

A navigation command cancels the active animated transition and resolves through absolute non-animated rendering.

For an in-flight transition from committed B to target C:

```text
next()       -> cancel active animation, render C absolutely, commit C
previous()   -> cancel active animation, render B absolutely, remain/commit B
seek(D)      -> cancel active animation, render D absolutely, commit D
home()       -> cancel active animation, render INITIAL absolutely
end()        -> cancel active animation, render FINAL absolutely
restart()    -> cancel active animation, render INITIAL absolutely and reset session reveal state
```

A navigation command supersedes the active transition. Runtime does not replay the cancelled transition after the new destination settles.

Stale scheduler callbacks or renderer completions associated with a cancelled transition must be ignored by transition identity.

## 8. Commit Rule

A semantic destination commits only after successful stable settlement.

The sequence is conceptually:

```text
accept command
select destination
create transition identity
request renderer settlement
renderer settles destination
commit currentStepId
project commentary/marker state
emit settlement events
```

Presentation updates needed to show a transition may occur before commit, but canonical `currentStepId` does not advance until the destination is stable.

If renderer settlement fails, runtime retains the last committed semantic boundary as the recovery anchor.

## 9. Renderer Contract

A v1 renderer has three required lifecycle responsibilities:

```text
mount(context)
render(state, context)
dispose()
```

An implementation may split these operations into additional methods, but the public contract must preserve their semantics.

### 9.1 `mount(context)`

Mount receives the renderer root, instance identity, accessibility/runtime services required by the renderer contract, and any experience-level renderer configuration.

The renderer must not install mutable global state shared across CiM instances.

### 9.2 `render(state, context)`

`state` is the complete destination state for the semantic boundary.

`context` may include:

```text
animate
fromState
stepId
fromStepId
rendererConfig
transitionId
abortSignal
clock
reducedMotion
```

The renderer may inspect subject state and renderer configuration. Core may not.

When `animate:false`, the renderer must settle directly to the destination without depending on prior renderer history.

When `animate:true`, the renderer may animate from prior context toward the destination but must settle to the same canonical output as `animate:false`.

The renderer must use the injected CiM clock/scheduler for semantically significant animation timing. Pausing that clock must freeze renderer progress.

The renderer must honor cancellation/abort signals and must not later overwrite a destination selected by a newer transition.

The render operation resolves only when the destination has reached stable output or rejects with a stable renderer error.

### 9.3 `dispose()`

Dispose cancels renderer-owned scheduled work, removes instance-scoped listeners, releases resources, and prevents further output mutation from the disposed renderer.

## 10. Absolute Render Equivalence

The following paths to a step must settle to equivalent canonical output:

```text
sequential playback
direct seek
reverse navigation
restart then seek
recovery restoration
reduced-motion arrival
deterministic replay
```

The conformance harness owns canonicalization. The renderer does not provide its own digest function.

Canonical comparison occurs after animated settlement and after direct non-animated rendering.

## 11. Reduced Motion

Reduced-motion mode preserves the same semantic steps, commentary, markers, commands, deep links, and final renderer states.

Reduced motion may suppress or shorten transition animation, but it cannot skip semantic boundaries or instructional content.

A reduced-motion arrival uses the same absolute destination state as a normal arrival.

## 12. Commentary Semantics

Each semantic step may provide commentary.

The commentary system maintains:

- one active entry corresponding to canonical semantic position;
- a history of revealed entries up to the reveal frontier;
- hidden future entries beyond the reveal frontier;
- user-controlled scroll position independent from semantic position;
- an auto-follow mode that suspends when the learner scrolls away from the live position.

Seeking backward changes the active entry but does not reduce the reveal frontier.

Seeking forward advances the reveal frontier to at least the requested step.

A direct deep link initializes the reveal frontier to the target step.

`restart()` resets the reveal frontier to its initial value.

Commentary-entry selection performs `seek(stepId)`.

## 13. Deep Linking

Stable semantic boundaries use:

```text
#cim/{experience-id}/{step-id}
```

On initialization, a matching mounted experience resolves directly to the requested step through non-animated absolute rendering.

A non-matching instance ignores the fragment.

An unknown experience or step fragment must not leave an instance partially initialized. The host/runtime may expose a diagnostic and continue at the configured default entry point.

Ordinary learner-driven semantic navigation should update the current fragment with `history.replaceState()` or equivalent behavior so browser history is not flooded with every step.

An explicit link-to-this-step affordance may expose or create a shareable canonical URL.

## 14. Multiple Instances

Each mounted instance has a unique `instanceId` even when two instances load the same experience ID.

The following remain instance-scoped:

- canonical session state;
- semantic sequence numbers;
- renderer root;
- commentary root;
- transport focus scope;
- timers and scheduled callbacks;
- transition identities;
- faults and recovery;
- disposal.

Keyboard commands apply only when focus is within the relevant CiM interaction scope, subject to the accessibility contract.

## 15. Experience Validation Boundary

Runtime receives only a validated `localis.cim/v1` experience.

Validation occurs before playback and before subject state reaches a renderer.

An incompatible schema version, unsatisfied `engine_min`, duplicate step ID, missing required state, invalid commentary structure, or unresolved renderer identifier prevents normal initialization.

The host page remains usable after validation failure.

## 16. Fault Settlement

Fault handling follows operation ownership.

### 16.1 Recoverable renderer failure

If rendering the target fails and the last committed stable boundary remains available, runtime attempts restoration of that boundary through non-animated absolute rendering.

Successful restoration leaves the instance usable and records the failed transition and recovery outcome.

### 16.2 Unrecoverable renderer failure

If restoration fails, runtime enters `faulted`, stops playback, and exposes the standard static fallback or unavailable state while leaving the surrounding page usable.

### 16.3 Invalid command

An invalid or out-of-range command does not change canonical state. It returns a stable rejection/result code and may emit a diagnostic event.

### 16.4 Delayed or stale callback

A callback whose transition identity is no longer current cannot commit position or mutate the current destination.

## 17. Event and Telemetry Relationship

Commands cause runtime behavior through direct interfaces.

Semantic events report observable behavior after or during that control flow. Event subscribers cannot modify canonical runtime state.

Event ordering, required fields, and event names are defined in `EVENTS.md`.

## 18. Harness Conformance Requirements

The synthetic harness must prove at least:

1. deterministic initial state;
2. next and previous accuracy;
3. direct seek accuracy;
4. observation-step position advance with unchanged state digest;
5. pause at stable boundary;
6. pause during animation with frozen progress;
7. resume of the same paused transition;
8. navigation cancellation of an active transition;
9. stale callback rejection;
10. direct and sequential render equivalence;
11. animated and non-animated render equivalence;
12. reduced-motion render equivalence;
13. restart reveal reset;
14. backward-seek reveal-frontier monotonicity;
15. renderer failure restoration;
16. unrecoverable renderer failure fallback;
17. duplicate-step and schema validation failure;
18. deep-link direct initialization;
19. multiple-instance isolation;
20. deterministic replay from scenario, seed, versions, commands, and virtual clock.

## 19. Non-Goals for v1

The shared v1 runtime does not define:

- declarative micro-animation instructions in experience data;
- renderer-specific domain schemas inside Core;
- Canvas/WebGL conformance semantics;
- cross-instance synchronized playback;
- branching learner choice graphs;
- editable learner state;
- networked collaborative sessions.

These may be added through later versioned contracts without weakening the v1 invariants above.
