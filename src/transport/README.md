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

## Later checkpoints

Checkpoint 2 adds read-only semantic timeline projection and marker state through an explicitly separate observation surface. Checkpoint 1 has no observation capability to retrofit around.

Later checkpoints add scrub gesture state, DOM focus scope, selectable-text safeguards, ARIA behavior, and visual transport presentation without changing the checkpoint 1 command authority boundary.

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
