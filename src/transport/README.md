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

Transport does not pre-screen semantic boundary IDs. It forwards the supplied ID unchanged and returns the exact Runtime outcome reference. Runtime owns unknown-step rejection and every other semantic command result.

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

Transport captures the frozen semantic boundary order once from `boundaryIds()`. The order begins with the reserved `initial` boundary and then follows authored semantic step order. Checkpoint 2 assigns only ordinal marker indices. It does not define pixel coordinates, normalized rail ratios, nearest-marker geometry, or pointer snapping policy.

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
markers
```

Each frozen marker contains exactly:

```text
stepId
index
current
target
revealed
```

`current` identifies the last committed stable semantic boundary. `target` identifies the pending semantic destination, when one exists. `revealed` is derived solely from canonical `revealFrontier`: every marker at or before the frontier in semantic order is revealed. A backward navigation therefore moves `current` without reducing the high-water reveal state. Restart observation returns both the current boundary and reveal frontier to `initial` after Runtime commits restart.

The timeline surface exposes only `boundaryIds()` and `project()`. It carries no command methods, event subscription, disposal capability, raw `snapshot()` function, renderer access, or Core control.

Checkpoint 2 remains headless. Marker labels, rail geometry, DOM, focus behavior, ARIA state, and scrub gesture coordinates stay outside this checkpoint.

## Later checkpoints

Checkpoint 3 adds scrub gesture state and semantic snap resolution over the checkpoint 2 marker order while preserving ADR 0007's preview-only drag contract.

Later checkpoints add DOM focus scope, selectable-text safeguards, ARIA behavior, playback presentation state, marker labels, and visual transport presentation without changing the checkpoint 1 command authority boundary or checkpoint 2 observation boundary.

## Verification

Checkpoint 1 tests prove:

- the exact frozen eight-function command port;
- rejection of a complete `CiMInstance` and every extra/hidden authority shape;
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

Checkpoint 2 tests prove:

- `CiMInstance.read` satisfies the exact frozen two-function observation port;
- complete-instance and extra or hidden observation authority shapes fail closed;
- semantic boundary order is captured as frozen ordinal data with `initial` first;
- projections and marker records are exact and frozen;
- current, pending target, and high-water reveal state are derived from fresh canonical snapshots;
- backward position preserves reveal-frontier marker state;
- restart-shaped observation resets the marker frontier to `initial` without changing semantic order;
- malformed boundary order and unknown canonical boundary identities fail closed;
- no pixel, ratio, label, command, event, disposal, raw snapshot, or Runtime implementation authority enters the timeline surface;
- the repository architecture and full verification gates remain green.
