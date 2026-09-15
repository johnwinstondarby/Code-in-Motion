# Transport and Semantic Timeline

## Purpose

Transport presents learner controls and maps committed learner intent to documented Runtime commands.

Transport converts committed learner intent into documented Runtime commands through an exact command-only port; Runtime remains the sole owner of command acceptance and semantic execution.

## Owns

- Play/pause controls
- Previous/next controls
- Home/end behavior
- Restart control
- Semantic progress rail
- Marker selection
- Scrub interaction and snap-to-step behavior
- Keyboard transport input while focus is within CiM
- Transport-local scrub preview state

## Does not own

- Canonical current-step truth
- Runtime operational state
- Continuous playback policy after a command is submitted
- Command acceptance, rejection, supersession, or coalescing policy
- Renderer control
- Commentary control
- Semantic event emission
- Subject state

## Checkpoint 1: headless semantic command port

Checkpoint 1 contains no DOM, CSS, pointer geometry, timeline projection, or canonical-state observation. It establishes the learner-intent-to-Runtime command seam.

Transport receives one frozen plain command port with exactly these eight own enumerable function properties:

```text
play
pause
next
previous
seek
home
end
restart
```

The port contains command authority only. A complete `CiMInstance`, an object with extra capabilities such as `read`, `events`, or `dispose`, an accessor-backed port, a symbol-extended port, a mutable port, or a non-plain port is invalid.

Transport production modules must not import `src/runtime/`. The composition root grants the exact command port by injection. Transport may import dependency-free shared values from `src/contracts/`.

### Learner control mapping

Ordinary learner controls submit one command with `source: transport`:

```text
play      -> play("transport")
pause     -> pause("transport")
next      -> next("transport")
previous  -> previous("transport")
home      -> home("transport")
end       -> end("transport")
restart   -> restart("transport")
```

Marker and scrub commitment use the shared semantic `seek` command with source-specific evidence:

```text
marker(stepId)       -> seek(stepId, "marker")
scrubCommit(stepId)  -> seek(stepId, "scrub")
```

Transport does not pre-screen semantic boundary IDs. It forwards the supplied ID unchanged and returns the exact Runtime outcome reference. Runtime owns unknown-step rejection, same-boundary `no_change`, and every other semantic command result.

Transport submits every committed learner action exactly once. It does not debounce, coalesce, serialize, suppress, or wait for a previous command outcome before forwarding a later action. Runtime owns supersession, rejection, transition cancellation, and command correlation. A later presentation layer may disable a control while work is active, but Transport command mapping does not create an independent acceptance policy.

Transport does not emit Core or Runtime semantic events. Runtime records command and settlement evidence.

### Headless keyboard mapping

The checkpoint 1 keyboard table is:

```text
ArrowLeft   -> previous
ArrowRight  -> next
Home        -> home
End         -> end
```

These mappings are discrete semantic navigation. They do not generate preview seeks.

Space activates an already-selected playback action. The caller supplies either `play` or `pause`; checkpoint 1 does not implement a state-reading `togglePlayback()` because the command port contains no read authority.

Keyboard handling remains scoped to the relevant CiM transport control. Later DOM and accessibility wiring must preserve native text selection and editing behavior and must not interpret unrelated selectable-text interaction as transport input.

### Scrub boundary

During v1 scrub drag, Transport may update only local thumb or preview presentation. Intermediate drag positions issue no semantic command. Commit resolves a semantic boundary in the later timeline/gesture layer and invokes `scrubCommit(stepId)` exactly once. Cancelling the gesture invokes no semantic command and restores presentation from the canonical projection when that projection is available.

This preserves ADR 0007: scrub preview remains local and semantic movement occurs only on commit.

## Checkpoint 2: read-only semantic timeline projection

Checkpoint 2 adds observation without widening command authority. The composition root grants `CiMInstance.read` separately from the checkpoint 1 command port.

The Transport observation port is one frozen plain object with exactly two own enumerable function properties:

```text
snapshot
boundaryIds
```

This is the complete Runtime read projection already exposed by `CiMInstance.read`. Passing a complete `CiMInstance`, an event surface, a command surface, an accessor-backed object, a symbol-extended object, a mutable object, or a non-plain object is invalid.

Transport captures the frozen semantic boundary order once from `boundaryIds()`. The order begins with the reserved `initial` boundary and then follows authored semantic step order. Boundary position in this array is the only ordinal used for timeline projection, snapping, and semantic seek resolution. A second authored-only ordinal is prohibited.

Each `project()` call reads a fresh Runtime snapshot and selects only three canonical identities:

```text
currentStepId
targetStepId
revealFrontier
```

Transport does not retain the raw Runtime snapshot and does not expose Runtime operational state. Each identity must refer to the captured semantic boundary order, except `targetStepId`, which may be `null` when no semantic target is pending.

The frozen timeline projection contains:

```text
currentStepId
targetStepId
revealFrontier
initialAnchor
markers
```

The reserved `initial` boundary is represented separately by one frozen rail anchor:

```text
stepId
index
current
target
```

Its values are `stepId: initial` and `index: 0`. It has no `revealed` field because `initial` has no authored commentary entry to reveal.

The `markers` array contains authored `step-*` boundaries only. Every marker keeps its canonical `boundaryIds()` ordinal, so the first authored marker has index 1. Each frozen marker contains exactly:

```text
stepId
index
current
target
revealed
```

The flag rule is symmetric: the anchor represents canonical identity `initial`; markers represent canonical identities for authored steps. If `currentStepId` or `targetStepId` is `initial`, the corresponding anchor flag is true and no authored marker carries that flag. If `revealFrontier` is `initial`, no authored marker is revealed. A backward navigation moves `current` without lowering authored reveal state.

This distinction implements the normative rule that at `initial` no authored semantic marker is active and no authored commentary entry is revealed while preserving `initial` as a valid semantic boundary, seek destination, deep-link destination, and scrub rail anchor.

The timeline surface exposes only `boundaryIds()` and `project()`. It carries no command methods, event subscription, disposal capability, raw `snapshot()` function, renderer access, or Core control.

Checkpoint 2 remains headless. Marker labels, DOM, focus behavior, and ARIA state stay outside this checkpoint.

## Checkpoint 3: headless scrub gesture and semantic snap

Checkpoint 3 adds deterministic semantic rail geometry and a local scrub gesture state machine without adding DOM, pointer-event, renderer, commentary, event-stream, or Runtime implementation authority.

The gesture receives only two capabilities:

- the frozen checkpoint 2 timeline surface;
- one `scrubCommit(stepId)` function, normally the checkpoint 1 controller method.

The gesture does not receive the complete Transport controller, command port, Runtime read port, `CiMInstance`, or event surface.

### Semantic rail geometry

The snap set contains the reserved `initial` rail anchor followed by every authored semantic step in canonical `boundaryIds()` order. Snap points are equally spaced by semantic ordinal, independent from renderer transition duration and authored dwell:

```text
ratio(index) = index / (boundaryCount - 1)
```

Input ratios are normalized headless rail coordinates. Finite values below zero clamp to zero; values above one clamp to one. The nearest snap point wins. An exact midpoint tie resolves toward the lower semantic ordinal. Tests pin the midpoint and subpixel values on both sides of it.

The lower-ordinal tie is intentional because a forward semantic seek may advance the monotonic reveal frontier, while resolving backward at an exact tie carries no irreversible reveal consequence.

The rail is therefore a semantic step indicator rather than a time-progress meter. Visual treatment should use discrete ticks or equivalent step cues rather than implying elapsed-time weighting.

The `initial` anchor is a valid scrub destination even though it is not an authored semantic marker.

### Gesture state

The exact frozen gesture surface is:

```text
begin(ratio)
update(ratio)
commit()
cancel()
read()
```

`begin()` opens one local gesture and resolves its initial preview snap. `update()` changes only local preview state. Neither operation issues a semantic command.

`read()` returns exact frozen display state:

```text
active
displayStepId
displayIndex
displayRatio
```

While a gesture is active, display state is the local preview. While inactive, display state is derived fresh from the canonical timeline projection. This prevents local preview from claiming canonical movement.

`commit()` closes local gesture state before forwarding exactly one `scrubCommit(previewStepId)` call and returns that call's exact result reference. Transport forwards a same-boundary commit exactly like any other commit; it does not suppress the command. Core resolves a stable seek to the current boundary as `no_change` with reason `already_at_boundary`, and Runtime skips transition and renderer work for that stable no-change outcome.

A duplicate commit after the same gesture is closed emits no second command. A new scrub gesture may begin immediately even while the prior Runtime outcome remains pending; Transport does not add an in-flight acceptance gate.

`cancel()` closes local gesture state, emits no command, and restores display from a fresh canonical timeline projection. If canonical position changed through another control while the scrub preview was active, cancellation follows that latest canonical position.

Only one local scrub gesture may be active at once. A second `begin()` before commit or cancellation fails closed. Non-finite rail ratios fail closed before changing local gesture state.

## Contract correction after checkpoints 2 and 3

Independent QA after checkpoint 3 identified that the original checkpoint 2 projection incorrectly gave the `initial` record `current` and `revealed` marker semantics. The correction separates the initial rail anchor structurally from authored markers and preserves the single canonical boundary ordinal.

The same review identified redundant stable rendering for `seek(currentStepId)`. Core now resolves a valid same-boundary seek as:

```text
result = no_change
details.reason = already_at_boundary
```

When no transition is active, Runtime emits command acceptance evidence and performs no transition allocation, renderer work, or semantic settlement event. Transport continues to forward the learner action unchanged and therefore does not acquire command-acceptance policy.

See ADR 0012.

## Later checkpoints

Later checkpoints add DOM focus scope, selectable-text safeguards, ARIA behavior, playback presentation state, marker labels, pointer/touch binding, and visual transport presentation without changing the checkpoint 1 command authority boundary, checkpoint 2 observation boundary, or checkpoint 3 release-only scrub contract.

## Verification

Checkpoint 1 tests prove:

- the exact frozen eight-function command port;
- rejection of a complete `CiMInstance` and every extra or hidden authority shape;
- the static Transport-to-Runtime import fence and a permitted shared-contract import near miss;
- ordinary command mapping including restart and exact source provenance;
- marker and scrub source provenance;
- unknown boundary IDs forwarded unchanged to Runtime;
- exact command-outcome reference pass-through;
- one action to one immediate command with no debounce, coalescing, serialization, or in-flight gating;
- discrete keyboard mapping and explicit Space play/pause activation;
- scrub cancellation issuing no semantic command;
- a frozen controller surface with no observation, disposal, raw seek, or event-emission capability;
- the repository architecture and full verification gates remain green.

Checkpoint 2 and correction tests prove:

- `CiMInstance.read` satisfies the exact frozen two-function observation port;
- complete-instance and extra or hidden observation authority shapes fail closed;
- semantic boundary order is captured as frozen ordinal data with `initial` first;
- `initial` is represented by a separate exact frozen anchor with canonical ordinal 0;
- authored markers retain their canonical ordinals beginning at 1;
- no authored marker is current, targeted, or revealed solely because canonical identity is `initial`;
- current, pending target, and high-water reveal state are derived from fresh canonical snapshots;
- backward position preserves authored reveal-frontier state;
- restart-shaped observation resets the frontier to `initial` without changing semantic order;
- malformed boundary order and unknown canonical boundary identities fail closed;
- no pixel, ratio, label, command, event, disposal, raw snapshot, or Runtime implementation authority enters the timeline surface;
- the repository architecture and full verification gates remain green.

Checkpoint 3 and correction tests prove:

- equally spaced semantic ordinal snap points and clamped normalized input;
- deterministic lower-ordinal resolution for exact midpoint ties, including subpixel values on both sides;
- `initial` remains a valid rail anchor and scrub destination without being an authored marker;
- the scrub surface is exact and frozen with no broader command or observation authority;
- inactive display follows fresh canonical semantic position;
- drag begin and update emit no semantic command;
- commit emits exactly one seek through `scrubCommit` with `source: scrub` and returns the exact command result reference;
- same-boundary commit remains forwarded by Transport but resolves quietly in Core and Runtime;
- duplicate commit after gesture closure emits no second command;
- cancellation emits no command and restores the latest canonical position;
- unresolved Runtime outcomes do not gate or coalesce later scrub gestures;
- overlapping gestures and non-finite ratio input fail closed;
- malformed rail order and unknown canonical display position fail closed;
- the repository architecture and full verification gates remain green.
