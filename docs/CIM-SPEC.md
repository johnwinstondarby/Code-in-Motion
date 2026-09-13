# Code in Motion (CiM) Runtime Specification

Status: Normative v1 specification

## 1. Scope

This specification defines the shared runtime behavior for Code in Motion. It covers semantic position, command handling, transition settlement, playback intent, dwell timing, renderer lifecycle, commentary reveal, deep links, semantic scrub, reduced motion, fault settlement, and multi-instance isolation.

Subject-specific visual meaning is outside this specification. Git-specific behavior belongs to Git experience data and Git renderer documentation.

## 2. Terms

### Semantic boundary

A stable instructional position identified by a semantic boundary ID. Authored steps use their `steps[].id`. The reserved ID `initial` identifies the stable experience state before the first authored step.

### Initial boundary

The stable experience state before the first semantic step. Its canonical identifier is exactly:

```text
initial
```

`initial` is addressable by navigation, events, replay evidence, and deep links. It is reserved and cannot be used as an authored `steps[].id`.

### Committed step

The last semantic boundary that completed stable settlement successfully. `initial` is a valid committed boundary.

### Pending target

The semantic destination selected for an active transition that has not yet committed.

### Subject state

The opaque renderer state associated with a semantic boundary. Core may select and pass this value but must not interpret its contents.

### Stable settlement

The point at which the renderer has completed the requested absolute destination output and Runtime may ask Core to commit the semantic destination.

### Reveal frontier

The highest semantic boundary whose commentary has been revealed during the current session. The initial value is `initial`.

### Dwell

Instructional time spent at a committed semantic boundary during continuous playback before Runtime begins the next transition.

## 3. Canonical Session Model

One `CiMInstance` owns one runtime session composition. Within that composition, **Core owns and mutates canonical semantic session state**. Runtime sequences commands, rendering, playback, and transition mechanics and asks Core to change canonical state through documented interfaces.

This section is the normative session-model definition. Other architecture documents and ADRs reference this section rather than maintaining independent field lists.

### 3.1 Core-owned canonical semantic state

Core must represent at least:

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

`currentStepId` is always a valid semantic boundary ID. Before the first authored step it is `initial`, never `null`.

`targetStepId` is `null` when no semantic transition is pending. When present it is either `initial` or a valid authored step ID.

`revealFrontier` begins at `initial` and is monotonic during a session except for the explicit reset performed by `restart()`.

`status` is stored canonically by Core. Runtime is the only production component authorized to request activity-status changes through the documented interface:

```text
Core.setStatus(nextStatus)
```

Core may validate lifecycle legality, such as preventing transitions out of `disposed`, but it does not derive `playing`, `transitioning`, or `paused` by inspecting Runtime-owned operational fields.

### 3.2 Runtime-owned operational state

Runtime must represent at least:

```text
playbackIntent
transitionId
transitionProgress
dwellRemainingMs
activeAbortState
```

`playbackIntent` distinguishes continuous playback from discrete navigation.

`transitionProgress` is meaningful only while an animated transition exists and is normalized to `[0, 1]`.

Operational transition state does not independently define canonical semantic position.

Runtime determines activity-status changes from these operational facts and requests the corresponding canonical status through `Core.setStatus(nextStatus)`.

### 3.3 Status values

The externally meaningful v1 statuses are:

- `idle`: stable and not continuously playing;
- `playing`: continuous playback intent is active while stable or dwelling;
- `transitioning`: an animated or semantic transition is actively progressing;
- `paused`: learner-controlled time is frozen; an active transition or dwell may be preserved;
- `faulted`: normal playback is unavailable because stable continuation failed;
- `disposed`: the instance no longer accepts commands.

For `playing`, `transitioning`, and `paused`, Runtime determines the requested status from Runtime-owned operational facts and calls `Core.setStatus(nextStatus)`. Core remains the canonical store and event authority for the resulting status value.

Implementations may use additional private substates but must preserve these observable semantics.

## 4. Semantic Position Is Independent from State Identity

A semantic step can advance while subject state remains equivalent to the prior step.

The reference synthetic sequence is:

```text
initial -> A
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

A digest comparison must never determine semantic position or suppress semantic settlement.

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

Marker selection, commentary-entry selection, deep-link resolution, and committed scrub navigation resolve through the same semantic command rules rather than defining independent movement semantics.

Commands are submitted to `CiMInstance`. Peer modules do not call one another to implement navigation.

Every accepted command receives a command/correlation identity suitable for telemetry and deterministic replay.

### 5.1 Command source

Observational command evidence should identify the initiating surface when useful, for example:

```text
transport
marker
commentary
scrub
deep_link
host
replay
```

The source does not change command semantics.

## 6. Command Semantics at Stable Boundaries

### 6.1 `play()`

At a stable boundary with a following authored step, an explicit `play()` sets continuous playback intent and begins the following transition immediately.

Authored dwell on the already-committed boundary is not consumed before that transition. Dwell is consumed only after a step commits as the result of continuous playback. Resuming a dwell that was explicitly paused follows §7.2 and is not a fresh stable-boundary `play()`.

At the final step, `play()` is accepted with `result: "no_change"` and `details.reason: "at_end"`. It does not wrap.

### 6.2 `pause()`

At a stable boundary, `pause()` freezes learner-controlled time and preserves any remaining dwell interval. Semantic position does not change.

### 6.3 `next()`

At a stable boundary, `next()` resolves to the immediately following semantic boundary.

At the final step, it is **accepted with no movement**:

```text
result = no_change
details.reason = at_end
```

Boundary exhaustion is not a command rejection.

### 6.4 `previous()`

At an authored step, `previous()` resolves to the immediately preceding semantic boundary. From `step-01`, it resolves to `initial`.

At `initial`, it is accepted with no movement:

```text
result = no_change
details.reason = at_start
```

### 6.5 `seek(stepId)`

`seek(stepId)` resolves directly to the named valid semantic boundary, including `initial`. It does not animate through intervening steps.

An unknown or reserved-invalid authored step ID is rejected without changing canonical state.

### 6.6 `home()`

`home()` resolves to `initial` and preserves the current reveal frontier.

### 6.7 `end()`

`end()` resolves directly to the final authored semantic boundary. The reveal frontier advances to the final step because the learner intentionally requested that position.

### 6.8 `restart()`

`restart()` resolves to `initial`, clears continuous playback intent, clears pending transition and dwell state, resets the reveal frontier to `initial`, clears recoverable transient error state, and prepares the experience to begin again.

`restart()` is distinct from `home()`.

### 6.9 Navigation clears playback intent

Every discrete navigation command clears continuous playback intent before resolving its destination:

```text
next
previous
seek
home
end
restart
marker jump
commentary jump
scrub commit
```

If continuous playback was active, Runtime emits `playback.stopped` with `details.reason: "navigation"`, except `restart()` may use the more specific reason `restart`.

After the destination settles, the instance remains stable and does not automatically continue to the following step. A subsequent `play()` is required.

## 7. In-Flight Transition Semantics

Continuity commands and navigation commands behave differently while a transition is active.

### 7.1 Pause during transition

`pause()` freezes the injected CiM clock and preserves the active transition.

While paused mid-transition:

```text
Core.currentStepId = last committed boundary
Core.targetStepId = pending destination
Runtime.transitionProgress = frozen progress
Runtime -> Core.setStatus("paused")
```

Runtime freezes transition progress and the injected clock before requesting the canonical status change. Core stores `paused` but does not infer it from Runtime-owned state.

No semantic commit occurs.

### 7.2 Play after paused transition or dwell

If `pause()` preserved an in-flight transition, `play()` resumes that same transition from the frozen progress position. The semantic destination remains unchanged. Runtime may replace a private scheduling token but must preserve semantic transition correlation and requests the appropriate canonical activity status through Core.

If `pause()` preserved an authored dwell interval, `play()` resumes the remaining dwell. This is the only case where a `play()` call begins by consuming dwell rather than immediately starting the next transition.

### 7.3 Navigation during transition

A navigation command clears continuous playback intent, cancels the active animated transition, and resolves through absolute non-animated rendering.

For an in-flight transition from committed B to target C:

```text
next()       -> cancel animation, render C absolutely, commit C
previous()   -> cancel animation, render B absolutely, no semantic movement
seek(D)      -> cancel animation, render D absolutely, commit D
home()       -> cancel animation, render initial absolutely, commit initial
end()        -> cancel animation, render final absolutely, commit final
restart()    -> cancel animation, render initial absolutely, reset reveal state
```

The mid-transition `previous()` case is accepted with `result: "no_change"` because B is already the committed boundary. A second `previous()` from stable B moves to the preceding boundary.

A navigation command supersedes the active transition. Runtime does not replay the cancelled transition after the new destination settles.

Stale scheduler callbacks or renderer completions associated with a cancelled transition must be ignored by transition identity.

## 8. Transition Pacing and Dwell

Renderer implementations own transition duration. Runtime does not inspect a generic shared transition-duration field.

Renderers must use the injected CiM clock/scheduler for semantically significant animation timing.

An experience step may provide optional `dwell_ms`. Runtime consumes this value only after that step commits as the result of continuous playback and before beginning the following transition.

Rules:

- absent `dwell_ms` means zero authored dwell;
- direct navigation and deep-link initialization discard dwell for that arrival;
- an explicit `play()` from an already-committed navigated-to boundary begins the following transition immediately;
- reduced motion preserves authored dwell after continuous-playback commits even when renderer animation is suppressed or shortened;
- `pause()` during dwell freezes the virtual clock and preserves the remaining dwell interval;
- `play()` resumes a dwell interval only when that dwell was previously paused;
- navigation during dwell cancels the remaining dwell and clears playback intent;
- if site configuration clamps authored dwell, deterministic replay records the effective runtime configuration.

If continuous playback commits the final semantic step and that step has non-zero `dwell_ms`, Runtime consumes the final dwell, emits `dwell.completed`, then clears playback intent and emits `playback.stopped` with `details.reason: "at_end"`. No following transition is scheduled. With zero final-step dwell, the `at_end` stop follows final-step settlement directly.

See ADR 0006.

## 9. Commit Rule

A semantic destination commits only after successful stable settlement.

The sequence is conceptually:

```text
accept command
select destination
Core validates destination
Runtime creates transition identity
Runtime requests renderer settlement
renderer settles destination
Runtime asks Core to commit destination
Core commits currentStepId
Runtime projects commentary/marker state
semantic settlement events are emitted
```

Presentation updates needed to show a transition may occur before commit, but canonical `currentStepId` does not advance until the destination is stable.

If renderer settlement fails, the last committed semantic boundary remains the recovery anchor.

## 10. Renderer Contract

A v1 renderer has three required lifecycle responsibilities:

```text
mount(context)
render(state, context)
dispose()
```

### 10.1 `mount(context)`

Mount receives the renderer root, instance identity, accessibility/runtime services required by the renderer contract, and any experience-level renderer configuration.

The renderer must not install mutable global state shared across CiM instances.

### 10.2 `render(state, context)`

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

When `animate:false`, the renderer settles directly to the destination without depending on prior renderer history.

When `animate:true`, the renderer may animate from prior context toward the destination but must settle to the same canonical output as `animate:false`.

The renderer must use the injected CiM clock/scheduler for semantically significant animation timing. Pausing that clock freezes renderer progress.

The renderer must honor cancellation. An aborted render rejects with a distinguished cancellation outcome that Runtime does not classify as a renderer fault. Runtime must report an honored expected cancellation as `renderer.cancelled`, correlated by `transition_id`; it must not report the cancellation as `renderer.error`.

A non-cancelled render resolves only when the destination has reached stable output or rejects with a stable renderer error.

### 10.3 `dispose()`

Dispose cancels renderer-owned scheduled work, removes instance-scoped listeners, releases resources, and prevents further output mutation from the disposed renderer.

## 11. Absolute Render Equivalence

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

## 12. Reduced Motion

Reduced-motion mode preserves the same semantic steps, commentary, markers, commands, deep links, dwell semantics, and final renderer states.

Reduced motion may suppress or shorten transition animation, but it cannot skip semantic boundaries or instructional content.

A reduced-motion arrival uses the same absolute destination state as a normal arrival.

## 13. Commentary Semantics

Each authored semantic step **must** provide commentary in `localis.cim/v1`.

The commentary system maintains:

- one active entry corresponding to the current authored semantic step;
- a history of revealed entries up to the reveal frontier;
- hidden future entries beyond the reveal frontier;
- user-controlled scroll position independent from semantic position;
- an auto-follow mode that suspends when the learner scrolls away from the live position.

At `initial`, no authored commentary entry or semantic marker is active. Previously revealed entries remain visible unless `restart()` resets the session.

Seeking backward changes the active entry but does not reduce the reveal frontier.

Seeking forward advances the reveal frontier to at least the requested step.

A direct deep link initializes the reveal frontier to the target boundary. A deep link to `initial` leaves the frontier at `initial`.

`restart()` resets the reveal frontier to `initial`.

Commentary-entry selection performs `seek(stepId)`.

## 14. Semantic Scrub

V1 scrub is a transport-local preview followed by one semantic seek on commit.

During drag:

- Transport may move the thumb and show a local nearest-step preview.
- Canonical position does not change.
- Renderer output does not change.
- Commentary and reveal frontier do not change.
- No semantic seek or transition event is emitted.

On release or equivalent commit, Transport resolves the nearest valid boundary and submits exactly one `seek(stepId)` with observational command evidence carrying `details.source: "scrub"`.

Cancelling the gesture restores the thumb to canonical position and emits no semantic seek.

Continuous arbitrary-time renderer scrubbing is outside v1. See ADR 0007.

## 15. Deep Linking

Stable semantic boundaries use:

```text
#cim/{experience-id}/{step-id}
```

The reserved initial boundary is addressable as:

```text
#cim/{experience-id}/initial
```

On initialization, a matching mounted experience resolves directly to the requested boundary through non-animated absolute rendering.

A non-matching instance ignores a fragment addressed to another mounted experience.

If a fragment names the current experience but its step is unknown, or if host-level resolution cannot resolve the requested CiM target, the resolver records the stable deep-link diagnostic defined in `FAULTS.md`, initializes the applicable experience at `initial`, and leaves the surrounding page usable. An invalid deep link never leaves a partially initialized semantic position.

Ordinary learner-driven semantic navigation should update the current fragment with `history.replaceState()` or equivalent behavior so browser history is not flooded with every step.

An explicit link-to-this-step affordance may expose or create a shareable canonical URL.

## 16. Multiple Instances

Each mounted instance has a unique `instanceId` even when two instances load the same experience ID.

The following remain instance-scoped:

- canonical session state;
- semantic sequence numbers;
- renderer root;
- commentary root;
- transport focus scope;
- timers and scheduled callbacks;
- transition identities;
- dwell state;
- faults and recovery;
- disposal.

Keyboard commands apply only when focus is within the relevant CiM interaction scope, subject to the accessibility contract.

## 17. Experience Validation Boundary

Runtime receives only a validated `localis.cim/v1` experience.

Validation occurs before playback and before subject state reaches a renderer.

An incompatible schema version, unsatisfied `engine_min`, reserved or duplicate step ID, missing required state, invalid dwell, invalid commentary structure, or unresolved renderer identifier prevents normal initialization.

The host page remains usable after validation failure.

## 18. Fault Settlement

Fault handling follows operation ownership.

### 18.1 Recoverable renderer failure

If rendering the target fails and the last committed stable boundary remains available, Runtime attempts restoration of that boundary through non-animated absolute rendering.

Successful restoration leaves the instance usable and records the failed transition and recovery outcome.

### 18.2 Unrecoverable renderer failure

If restoration fails, Runtime first clears `playbackIntent` and any active transition/dwell operational state. Runtime then calls `Core.setStatus("faulted")`. After Core stores the canonical `faulted` status, the runtime event stream reports `instance.faulted`, and the host exposes the standard static fallback or unavailable state while leaving the surrounding page usable.

This ordering prevents canonical fault status from being stored while Runtime still advertises active playback intent.

### 18.3 Invalid command

A genuinely invalid command does not change canonical state. It returns a stable rejection code and may emit a diagnostic event.

Reaching `at_start` or `at_end` is not an invalid command; it is an accepted `no_change` result.

### 18.4 Delayed or stale callback

A callback whose transition identity is no longer current cannot commit position or mutate the current destination.

## 19. Event and Telemetry Relationship

Commands cause runtime behavior through direct interfaces.

Semantic events report observable behavior after or during that control flow. Event subscribers cannot modify canonical runtime state.

All semantic event timestamps use the injected CiM clock. Wall-clock time, if captured, is telemetry-sink metadata only.

Event ordering, required fields, and event names are defined in `EVENTS.md`.

## 20. Harness Conformance Requirements

The synthetic harness must prove at least:

1. deterministic settlement at `initial`;
2. next and previous accuracy;
3. direct seek accuracy, including `seek("initial")`;
4. accepted `no_change` at start and end boundaries;
5. observation-step position advance with unchanged state/render digests;
6. pause at stable boundary;
7. pause during animation with frozen progress;
8. pause during dwell with frozen remaining dwell and required dwell evidence;
9. resume of paused transition and paused dwell;
10. navigation cancellation of active transition or dwell with required cancellation evidence;
11. navigation clears playback intent;
12. Runtime is the sole production requester of activity-status changes through `Core.setStatus(nextStatus)`;
13. explicit `play()` from a navigated-to committed boundary starts the following transition immediately rather than consuming that boundary's dwell;
14. final-step dwell, when reached through continuous playback, completes before `playback.stopped` with reason `at_end`;
15. stale callback rejection;
16. direct and sequential render equivalence;
17. animated and non-animated render equivalence;
18. reduced-motion render equivalence with preserved dwell;
19. restart reveal reset to `initial`;
20. backward-seek reveal-frontier monotonicity;
21. renderer failure restoration;
22. unrecoverable renderer failure fallback and ordered `faulted` status settlement;
23. duplicate, reserved-ID, dwell, and schema validation failure;
24. deep-link initialization, including `/initial`, and invalid-target fallback to `initial`;
25. scrub emits one seek only on commit;
26. multiple-instance isolation;
27. deterministic replay from scenario, seed, versions, validated experience, runtime configuration, commands, and virtual clock.

## 21. Non-Goals for v1

The shared v1 runtime does not define:

- declarative micro-animation instructions in experience data;
- shared authored transition-duration fields;
- renderer-specific domain schemas inside Core;
- continuous arbitrary-time renderer scrubbing;
- Canvas/WebGL conformance semantics;
- cross-instance synchronized playback;
- branching learner choice graphs;
- editable learner state;
- networked collaborative sessions.

These may be added through later versioned contracts without weakening the v1 invariants above.
