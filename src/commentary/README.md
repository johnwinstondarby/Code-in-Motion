# Running Commentary

## Purpose

Commentary projects validated authored commentary through canonical semantic reveal state into a persistent learner-facing instructional stream.

Commentary consumes semantic facts. It does not own canonical semantic movement or reveal-frontier advancement.

## Owns

- Commentary entry presentation
- Canonical active-entry presentation
- Previously revealed history presentation
- Commentary-local selection state
- Native Commentary DOM projection and entry activation
- Commentary-entry seek requests through a narrow fixed-provenance navigation capability
- Safe structured commentary-link presentation
- Commentary-local follow and suspension policy
- Newer-steps availability projection
- Native Commentary autoscroll mechanics and learner scroll-position detection
- Native newer-steps indicator presentation and activation

## Does not own

- Canonical semantic position
- Reveal-frontier advancement or reset
- Runtime command acceptance or settlement
- Transport policy
- Subject rendering
- Renderer control
- Raw HTML execution from experience content
- Semantic event emission

## Checkpoint 1: reveal projection

Checkpoint 1 is observation-only. It establishes which authored commentary entries are visible from the canonical reveal frontier before local selection, active styling, DOM, scrolling, or commentary-entry activation is introduced.

Construction receives exactly:

```text
boundaryIds
observation
entries
```

`boundaryIds` is the frozen canonical semantic order beginning with `initial`.

`observation` is one exact frozen capability containing only:

```text
snapshot
```

Composition may wrap `CiMInstance.read.snapshot` to provide this capability. Commentary receives no complete `CiMInstance`, command surface, event surface, disposal capability, Transport object, renderer, or Core control.

`entries` is a frozen array aligned one-for-one with authored semantic boundaries. There is no authored Commentary entry for `initial`.

Each source entry contains exactly:

```text
stepId
text
links
```

Each structured link contains exactly:

```text
id
label
href
```

Authored data must already have crossed the validated experience freeze boundary. Checkpoint 1 rejects mutable, accessor-backed, widened, symbol-extended, or ordinal-misaligned input.

### Visibility rule

Every `read()` obtains a fresh Runtime snapshot and selects only canonical `revealFrontier`.

The exact frozen public surface is:

```text
read
```

Each `read()` returns:

```text
revealFrontier
entries
```

`entries` is the ordered authored prefix through the frontier. At `initial`, the array is empty.

Each projected entry contains exactly:

```text
stepId
index
text
links
```

`index` is the existing semantic boundary ordinal, so the first authored Commentary entry has index 1. No second Commentary-specific ordinal is introduced.

Backward navigation and Home do not re-hide entries while Core preserves the high-water reveal frontier. Targeted initialization exposes the prefix through the targeted boundary. Restart removes authored Commentary visibility only after Core resets `revealFrontier` to `initial`.

Checkpoint 1 deliberately has no local `selected` state and no canonical `active` presentation. Visibility and learner selection are separate concerns.

## Checkpoint 2: Commentary-local selection

Checkpoint 2 layers local learner selection over the exact checkpoint 1 reveal capability without changing canonical visibility or issuing semantic commands.

Construction receives exactly one frozen capability:

```text
reveal
```

`reveal` is the exact checkpoint 1 surface containing only:

```text
read
```

The exact frozen checkpoint 2 public surface is:

```text
read
select
clear
```

Local state contains only `selectedStepId`, initially `null`.

Every operation validates a fresh checkpoint 1 reveal state before returning projected state. The projected state contains exactly:

```text
revealFrontier
selectedStepId
entries
```

Every visible entry preserves checkpoint 1 data and adds exactly:

```text
selected
```

`select(stepId)` accepts only a currently visible Commentary entry. Selecting an unrevealed or unknown semantic identity fails closed without changing local state. Selecting the already selected entry is idempotent local state and produces no command-style outcome envelope or semantic event.

Backward navigation and Home preserve selection while the selected entry remains visible under the high-water reveal frontier. When a valid fresh reveal projection no longer contains the selected entry, including after Restart resets the frontier to `initial`, Commentary reconciles local selection to `null`.

Malformed fresh reveal state cannot silently erase valid local selection. Reconciliation occurs only after the checkpoint 1 state validates successfully.

`clear()` changes only Commentary-local selection and returns the latest valid visibility projection. Checkpoint 2 receives no Runtime, Transport, command, event, renderer, DOM, disposal, or Core authority.

Checkpoint 3 adds semantic movement through a separate narrow command capability. Local selection itself remains Commentary-local state and does not imply navigation.

## Checkpoint 3: native presentation and entry navigation

Checkpoint 3 adds canonical active-entry presentation, native Commentary DOM projection, entry activation, structured-link projection, and a separate fixed-provenance semantic navigation seam.

### Presentation

Construction receives exactly:

```text
selection
observation
entryCount
```

`selection` is the exact checkpoint 2 `{ read, select, clear }` surface. `observation` is a separate exact frozen `{ snapshot }` capability used only to read canonical `currentStepId`.

The exact frozen presentation surface contains only:

```text
read
```

Each read returns:

```text
revealFrontier
currentStepId
selectedStepId
entryCount
entries
```

Every visible entry preserves checkpoint 2 state and adds one canonical presentation flag:

```text
active
```

`active` follows canonical `currentStepId`. `selected` follows Commentary-local `selectedStepId`. These are independent facts. At `initial`, no authored Commentary entry is active even if high-water reveal history remains visible after Home.

### Navigation

Commentary navigation receives one exact frozen command capability containing only:

```text
seek
```

The navigation adapter exposes only:

```text
seek
```

It always forwards semantic movement as:

```text
seek(stepId, "commentary")
```

The adapter fixes provenance and returns the Runtime command outcome by reference. It does not normalize results, suppress same-boundary commands, or interpret command acceptance.

### Native binding

The native binding receives exact Commentary controls, checkpoint 3 presentation, local `select`, and the narrowed navigation capability.

Each Commentary control separates:

```text
root
text
select
links
```

`text` is the selectable authored prose surface. It receives text through `textContent` and no click, pointer-drag, or synthetic keyboard listener.

`select` is a native `button[type="button"]`. Browser Enter/Space activation remains native. The binding listens only for native click activation.

`links` is a frozen array of native anchors aligned with validated structured link records. Commentary projects link label, `href`, and stable link ID. It does not install link-activation listeners; browser link behavior remains native.

Semantic step identity is captured from validated presentation when an entry first becomes visible. Mutable DOM attributes never define a seek target. Every activation revalidates fresh presentation before local selection and semantic navigation occur.

Refresh owns only Commentary presentation fields and is transactional. Failed DOM projection or listener installation restores prior owned state where possible. Disposal removes only listeners installed by the binding and remains retryable after removal failure.

Checkpoint 3 receives no complete `CiMInstance`, Transport surface, renderer authority, Core control, or semantic event-emission capability.

## Checkpoint 4 follow suspension and temporary holds

ADR 0050 amends ADR 0029. Construction still receives exactly `{ presentation }`, whose frozen capability contains only `read`. Every operation validates fresh presentation before changing policy.

The exact frozen follow surface is `read`, `suspend`, `resume`, `hold`, and `release`. State contains exactly `following`, `held`, `newerStepsAvailable`, and `latestVisibleStepId`. `following` begins true; `held` begins false. The latest identity is the final visible entry or null.

Hold reasons are exactly `pointer`, `focus`, and `selection`. Acquisition is idempotent per reason. Holds preserve follow mode but pause acknowledgement and movement. New reveals while held may raise pending content. Releasing the last hold catches up only while still following. It never resumes a learner-owned viewport.

The first unheld suspension records the fresh frontier. Suspension during a hold preserves its pending baseline; repeated suspension does not acknowledge later content. Explicit resume acknowledges fresh content even if held, while future reveals still respect holds. Backward canonical navigation does not fabricate pending content; Restart-shaped contraction rebases acknowledgement without forcing follow on.

This policy owns no DOM, scroll geometry, navigation, Runtime, Transport, renderer, or event authority.

## Checkpoint 5 native scroll follow binding

ADR 0050 amends ADR 0030. Construction receives exactly `viewport`, `indicator`, `follow`, `newerStepsLabel`, and `scrollIntent`. The last is a frozen read-only capability reporting native learner scroll intent. Follow is the exact frozen amended checkpoint 4 capability. The native button retains `type=button` and a text label. The viewport provides only native listener/scroll mechanics and geometry.

The exact frozen binding surface is `refresh`, `reposition`, and `dispose`. The binding installs one viewport scroll listener and one indicator click listener. WordPress separately owns pane pointer/focus/selection listeners; this binding installs no synthetic keyboard or drag handlers.

`maxScrollTop = max(0, scrollHeight - clientHeight)` and `scrollTop >= maxScrollTop - 1` determine the newest position. Actual learner movement away suspends following. Deliberate return to that position resumes. Unchanged-position events from new content or own scrolling, and contraction/clamping, never change ownership.

Refresh moves once per new content identity only while following and unheld. A held refresh does not record an automatic scroll, so releasing the last hold catches up without requiring another reveal. Pending content exposes the native resume control. Activation scrolls first and resumes only after successful movement. Default-prevented clicks yield.

`reposition(top)` is a mechanical destination supplied by WordPress for deliberate navigation. It validates finite non-negative geometry, clamps to the available range, uses the bottom when omitted, and records the resulting own scroll. It does not change follow ownership or semantic state.

All scrolling uses immediate `behavior: auto`. Geometry and fresh state validate before mutation; indicator writes remain transactional. Partial construction rolls back listeners. Disposal remains scoped, idempotent after success, and retryable after listener-removal failure. No Runtime, Transport, renderer, semantic event, navigation, or full presentation authority is injected.

## Interaction ownership

ADR 0024 applies to Commentary text. Pointer drag-selection over learner-facing text remains browser-owned and cannot enter Transport scrub interaction. Commentary preserves selectable prose by keeping text separate from the native entry-activation button.

## Safe authored content

Commentary text is rendered as text data, never executable HTML. Structured links use validated `id`, `label`, and `href` fields rather than authored HTML fragments.

## Later checkpoints

Later Commentary work may add shared accessibility presentation or other explicitly scoped behavior without changing checkpoints 1 through 5. Complete learner-path composition remains verified by the synthetic harness rather than by granting Commentary broader production authority.

## Verification

Checkpoint 1 tests prove:

- exact frozen observation and projection surfaces;
- no authored Commentary at `initial`;
- ordered prefix reveal through any authored frontier;
- backward canonical movement does not re-hide previously revealed entries;
- every read follows fresh canonical reveal state;
- targeted-entry and Restart-shaped frontier behavior;
- exact frozen entry and structured-link records;
- metadata alignment with canonical semantic order;
- malformed, mutable, widened, accessor-backed, and unknown-frontier inputs fail closed;
- no selection, command, event, DOM, Transport, renderer, or complete Runtime authority enters the projection;
- repository schema, architecture, Core-authority, and full test gates remain green.

Checkpoint 2 tests prove:

- exact frozen controller, projected state, and selected-entry records;
- visibility and local selection remain independent facts;
- selection accepts only currently visible entries;
- repeated selection is idempotent local state without command-style outcome data;
- backward navigation and Home preserve selection while visibility remains;
- Restart-shaped visibility reset clears a now-hidden selection;
- malformed reveal data cannot corrupt existing local selection;
- `clear()` changes only local selection;
- the injected checkpoint 1 capability remains exact and frozen;
- no Runtime, Transport, command, event, renderer, DOM, disposal, or Core authority enters checkpoint 2;
- repository schema, architecture, Core-authority, and full test gates remain green.

Checkpoint 3 tests prove:

- canonical active state and Commentary-local selected state remain independent;
- current semantic identity must align with visible Commentary state;
- native binding projects selectable text, validated structured links, local selection, and canonical active state;
- step identity is captured from validated presentation rather than mutable DOM attributes;
- newly revealed controls acquire identity only after validated presentation reveals them;
- stale hidden controls cannot navigate after Restart;
- selectable text and structured links acquire no pointer or synthetic keyboard listeners;
- navigation uses the exact one-function seek adapter with fixed `source: commentary` provenance;
- same-boundary and other Runtime outcomes remain Runtime-owned and are returned without normalization;
- DOM refresh, listener installation, and disposal preserve their rollback and ownership boundaries;
- repository schema, architecture, Core-authority, and full test gates remain green.

Checkpoint 4 tests prove:

- exact frozen follow controller and state surfaces;
- following is enabled by default and newest visible identity follows fresh checkpoint 3 presentation;
- first suspension establishes the current reveal frontier as the acknowledgement baseline;
- later reveal advancement raises newer-step indication while suspended;
- repeated suspension does not acknowledge waiting newer entries;
- resume acknowledges the current frontier and clears newer-step indication;
- backward canonical movement does not create a false newer-step indication;
- Restart-shaped reveal contraction rebases acknowledgement without forcing follow mode;
- suspension before an initial read establishes the current frontier as its baseline;
- malformed fresh presentation fails closed without acknowledging new reveal state;
- checkpoint 3 presentation identity and active/selected consistency are revalidated at the follow boundary;
- no DOM, scrolling, navigation, Runtime, Transport, event, disposal, or renderer authority enters checkpoint 4;
- repository schema, architecture, Core-authority, and full test gates remain green.

Checkpoint 5 tests prove:

- exact frozen scroll binding and exactly one viewport scroll plus one native indicator click listener;
- fresh reveal autoscrolls to the bottom only while follow is active;
- repeated refresh of the same latest semantic entry does not repeat autoscroll;
- learner scroll-away suspends follow without fabricating newer Commentary;
- newer reveal while suspended shows the indicator without moving the viewport;
- manual return to the bottom resumes follow and clears the indication;
- the one-CSS-pixel bottom tolerance is deterministic;
- indicator activation scrolls first, then resumes follow;
- native default-prevented indicator activation yields without local action;
- immediate `behavior: auto` scrolling is used;
- failed autoscroll restores indicator projection and does not change follow policy;
- invalid viewport geometry fails before follow mutation;
- checkpoint 4 authority remains exact and frozen and the indicator label is required;
- malformed follow state fails before DOM or listener mutation;
- partial listener installation is rolled back;
- disposal is scoped, idempotent after success, and retryable after failure;
- no semantic navigation, Runtime, Transport, renderer, or semantic event authority enters checkpoint 5;
- repository schema, architecture, Core-authority, and full test gates remain green.
