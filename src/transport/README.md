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
- Playback action presentation projection
- Native range presentation and semantic marker labels

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

## Checkpoint 4: scoped DOM keyboard binding

Checkpoint 4 adds the first DOM-facing Transport seam without widening command authority or canonical-state observation. It binds the checkpoint 1 timeline keyboard mapping to one injected CiM keyboard scope.

Construction receives exactly two capabilities:

```text
root
timelineKey
```

`root` is the EventTarget-like interaction scope supplied by composition. `timelineKey` is the existing narrow Transport capability that accepts a key and applies the checkpoint 1 semantic mapping. The binding does not receive the complete controller, command port, Runtime read surface, event stream, renderer, commentary surface, or `CiMInstance`.

The binding installs exactly one `keydown` listener on `root`. It does not install document- or window-level keyboard listeners. The returned surface is frozen and contains exactly one method:

```text
dispose
```

`dispose()` removes only the listener installed by the binding. Successful disposal is idempotent. If the injected EventTarget throws during listener removal, disposal remains retryable because the binding marks itself inactive only after removal succeeds.

### Eligible timeline keys

Checkpoint 4 DOM dispatch accepts only the unmodified timeline navigation keys already defined by checkpoint 1:

```text
ArrowLeft
ArrowRight
Home
End
```

An eligible event calls `preventDefault()` once and forwards the key once through `timelineKey(key)`. No local debounce, coalescing, queue, or command-result interpretation is added.

Space remains outside checkpoint 4 DOM dispatch. The headless checkpoint 1 mapping requires an explicit `play` or `pause` action, and checkpoint 4 has no playback presentation-state authority from which to select that action. Checkpoint 5 supplies that action through a separate read-only projection; checkpoint 6 consumes it without widening checkpoint 4 keyboard authority.

### Native interaction wins

Timeline shortcuts yield without calling `preventDefault()` or `timelineKey()` when any of the following is true:

- the event was already default-prevented;
- IME composition is active;
- Alt, Ctrl, Meta, or Shift is pressed;
- the composed event path does not include the injected keyboard root;
- a descendant in the path is a native form, link, media, or other protected interactive element;
- a descendant is contenteditable;
- a descendant declares `tabindex`;
- a descendant exposes a protected interactive ARIA role, including a protected fallback token within a role token list;
- a descendant carries `data-cim-keyboard-native` as an explicit ownership opt-out;
- the owning document reports a non-collapsed text selection;
- selection inspection or protected-interaction inspection cannot be completed safely.

The event path is evaluated through `composedPath()` so keyboard ownership remains scoped across composed DOM boundaries. Noninteractive descendants do not block timeline navigation.

This checkpoint does not mutate focus, assign `tabindex`, create ARIA attributes, infer playback state, or bind pointer/touch interaction. It establishes only the keyboard ownership boundary required before those later presentation layers are added.

## Checkpoint 5: playback action presentation projection

Checkpoint 5 supplies the smallest read-only state needed to select the learner-facing play/pause action. It does not add command authority or command-acceptance policy.

Composition supplies a frozen plain playback observation port with exactly one function:

```text
snapshot
```

The complete `CiMInstance.read` surface is rejected because `boundaryIds()` is unnecessary for playback action selection. Composition may expose only `CiMInstance.read.snapshot` through the exact one-function wrapper.

Each presentation read obtains a fresh Runtime snapshot and selects only:

```text
canonical.status
operational.playbackIntent
```

The public playback presentation surface is frozen and exposes exactly:

```text
read
```

`read()` returns one frozen record with exactly:

```text
action
```

where `action` is `play` or `pause`.

### Action rule

The projection rule is:

```text
if status == paused:
    action = play
else if playbackIntent == true:
    action = pause
else:
    action = play
```

Paused state takes precedence because Runtime `play()` resumes preserved transition or dwell work. Outside paused state, `playbackIntent` determines whether the learner-facing action is pause.

Canonical `status` alone cannot make this decision. Continuous playback and unrelated discrete navigation may both report `transitioning`; `playbackIntent` distinguishes continuous playback from those other transitions.

### Acceptance remains Runtime-owned

Checkpoint 5 deliberately exposes no `enabled`, `disabled`, `available`, `blocked`, or equivalent field. Initialization, recovery, fault, disposal, in-flight discrete navigation, and every other command gate remain Runtime-owned.

A projected `play` action therefore means only that the next playback control activation maps to `play`; it does not promise Runtime acceptance. The checkpoint 1 command path still forwards the learner action and returns Runtime's exact outcome.

Checkpoint 5 does not expose the raw snapshot, boundary order, Runtime event stream, command methods, renderer, commentary surface, or disposal authority.

See ADR 0013.

## Checkpoint 6: Space playback keyboard integration

Checkpoint 6 joins the checkpoint 4 keyboard ownership rules with the checkpoint 5 playback action projection while preserving both earlier contracts.

The checkpoint 4 constructor remains available unchanged:

```text
createTransportKeyboardBinding({ root, timelineKey })
```

Checkpoint 6 adds a separate integration constructor:

```text
createTransportPlaybackKeyboardBinding({
  root,
  timelineKey,
  playbackKey,
  playbackPresentation
})
```

The integrated binding still installs exactly one `keydown` listener on the injected root. It exposes the same exact frozen `dispose()` surface and receives no complete Transport controller, command port, Runtime read surface, event stream, renderer, commentary surface, or `CiMInstance`.

`playbackPresentation` must be the exact frozen checkpoint 5 surface containing only `read`. `playbackKey` is the narrow checkpoint 1 playback command mapper.

### Space dispatch

The exact v1 Space key is `KeyboardEvent.key === " "`. The legacy `Spacebar` spelling is outside the contract.

For an eligible Space keydown, Transport applies this order:

1. apply the checkpoint 4 native-interaction yield rules;
2. obtain a fresh `playbackPresentation.read()` result;
3. validate the exact frozen `{ action }` record;
4. call `preventDefault()` once;
5. call `playbackKey(" ", action)` once.

If presentation read throws or returns malformed state, Transport fails closed without calling `preventDefault()` and without submitting a playback command.

Native controls retain ownership. Space on a focused native play/pause button therefore follows the browser button-activation path and is not duplicated by the root binding.

### Repeat rule

Space auto-repeat is ignored. A Space event with `event.repeat === true` performs no presentation read, no prevention, and no command submission.

Timeline keys retain normal repeat behavior. Repeated ArrowLeft, ArrowRight, Home, and End events continue through the checkpoint 4 timeline path without reading playback presentation.

This asymmetry prevents play/pause oscillation while preserving repeated semantic navigation.

See ADR 0014.

## Checkpoint 7: native range presentation and semantic labels

Checkpoint 7 projects checkpoint 3 scrub display state into the exact headless state required by a native semantic range control. It adds no DOM listener, command authority, pointer policy, event-stream access, or Runtime implementation surface.

Construction receives exactly four inputs:

```text
boundaryIds
scrubObservation
steps
ariaLabel
```

`boundaryIds` is the frozen canonical semantic order beginning with `initial`. `scrubObservation` is the exact frozen checkpoint 3 observation surface containing only `read`. `steps` is frozen authored metadata aligned one-for-one with authored boundaries and contains exact records with `stepId`, required `label`, and nullable `marker`. `ariaLabel` is a non-empty learner-facing name for the rail.

### Native range projection

Each presentation `read()` returns one exact frozen state with:

```text
range
initialAnchor
markers
```

The `range` record contains exactly:

```text
min
max
step
value
ariaLabel
ariaValueText
```

Range geometry uses the one canonical boundary ordinal:

```text
min   = 0
max   = boundaryCount - 1
step  = 1
value = displayIndex
```

`value` follows the fresh checkpoint 3 display index. During an active scrub gesture it therefore reflects local preview; outside a gesture it follows the latest canonical position.

The accessible value text is semantic rather than technical:

```text
<accessibleLabel>, position <displayIndex + 1> of <boundaryCount>
```

The rail name comes from the explicit `ariaLabel` input and is never derived from experience IDs or step IDs.

### Initial anchor and authored markers

The reserved `initial` boundary remains separate from authored markers and is projected as:

```text
stepId          = initial
index           = 0
visualLabel     = Start
accessibleLabel = Start
```

Every authored marker contains exactly:

```text
stepId
index
visualLabel
accessibleLabel
```

For authored steps:

```text
visualLabel     = marker when supplied, otherwise label
accessibleLabel = label
```

Required authored `label` is the complete learner-facing semantic name. Optional authored `marker` is the concise visual form. A missing marker therefore changes no semantic identity or accessibility name.

### Native semantics stay native

Checkpoint 7 does not synthesize `role="slider"`, `tabindex`, `aria-valuemin`, `aria-valuemax`, or `aria-valuenow`. The later DOM binding will use a native `<input type="range">`, which supplies those native slider, focus, value, and limit semantics.

The headless projection supplies only the values and semantic labeling that the native control cannot infer from numeric ordinal alone.

Malformed boundary order, metadata count or order, mutable or widened capability surfaces, accessor-backed data, symbol extensions, unknown display identities, and invalid display ordinals fail closed.

See ADR 0015.

## Later checkpoints

Later checkpoints add the native range DOM binding, pointer/touch integration, and visual transport presentation without changing the checkpoint 1 command authority boundary, checkpoint 2 observation boundary, checkpoint 3 release-only scrub contract, checkpoint 4 native-interaction yield rule, checkpoint 5 playback-action ownership rule, checkpoint 6 Space repeat and native-ownership rules, or checkpoint 7 native-range presentation and semantic-label contract.

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

Checkpoint 4 tests prove:

- the exact frozen one-method keyboard binding surface;
- exactly one `keydown` listener is installed on the injected scope and no document listener is installed;
- unmodified ArrowLeft, ArrowRight, Home, and End dispatch exactly once and prevent native page movement;
- Space and unrelated keys remain outside checkpoint 4 DOM dispatch;
- modifier chords, prior default prevention, and IME composition yield to native behavior;
- composed-path scope is enforced;
- native controls, editing regions, tabindex descendants, protected ARIA roles, fallback role token lists, and explicit native opt-outs retain keyboard ownership;
- noninteractive descendants remain eligible for scoped timeline navigation;
- active text selection wins and selection-inspection failure fails closed;
- disposal removes only the installed listener, is idempotent after success, and remains retryable after removal failure;
- malformed or widened construction authority fails closed;
- the repository architecture and full verification gates remain green.

Checkpoint 5 tests prove:

- the exact frozen one-function playback observation port;
- the complete Runtime read surface is rejected rather than widening playback observation authority;
- the exact frozen one-method playback presentation surface;
- the returned playback state is exact, frozen, and contains only `action`;
- idle state without playback intent projects `play`;
- active continuous playback projects `pause`, including while canonical status is `transitioning`;
- discrete `transitioning` state without playback intent projects `play`;
- paused state projects `play` regardless of playback intent;
- presentation reads a fresh Runtime snapshot rather than caching an action;
- malformed status, playback intent, descriptors, and mutable nested snapshots fail closed;
- no command, event, boundary-order, disposal, or raw Runtime authority enters the presentation surface;
- the repository architecture and full verification gates remain green.

Checkpoint 6 tests prove:

- the integrated binding installs exactly one scoped listener and exposes only the frozen `dispose` surface;
- each eligible Space press reads a fresh projected action and submits `play` or `pause` exactly once;
- Space auto-repeat performs no read, prevention, or command submission;
- timeline key repeat remains eligible and does not read playback presentation;
- legacy `Spacebar` is ignored;
- Space on native descendants does not duplicate browser activation;
- checkpoint 4 native-yield rules execute before playback presentation is read;
- active text selection yields Space;
- presentation exceptions, mutable records, extra keys, accessor-backed action, and unknown actions fail closed before prevention or command submission;
- widened or malformed integration authority fails closed;
- disposal remains scoped and idempotent;
- the checkpoint 4 constructor and all prior Transport tests remain green;
- the repository architecture and full verification gates remain green.

Checkpoint 7 tests prove:

- the presentation surface, range record, initial anchor, marker array, and marker records are exact and frozen;
- native range geometry uses the canonical semantic boundary ordinal with `min: 0`, `step: 1`, and `max` equal to the final ordinal;
- `initial` remains a separate `Start` anchor and never appears as an authored marker;
- authored `marker` text is used for concise visual labels while required authored `label` supplies the accessible semantic name;
- missing authored marker text falls back to the required label;
- range value and semantic value text follow fresh scrub display state, including local preview;
- the headless output carries no custom slider role, tabindex, or redundant ARIA range-limit fields;
- authored metadata count and order must align exactly with canonical boundary order;
- step metadata and the scrub observation port reject mutable, widened, accessor-backed, or otherwise malformed authority shapes;
- malformed display identity and ordinal state fail closed;
- the learner-facing rail label is explicit and is not derived from technical IDs;
- the repository schema, architecture, Core-authority, and full verification gates remain green.
