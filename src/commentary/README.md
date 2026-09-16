# Running Commentary

## Purpose

Commentary projects validated authored commentary through canonical semantic reveal state into a persistent learner-facing instructional stream.

Commentary consumes semantic facts. It does not own canonical semantic movement or reveal-frontier advancement.

## Owns

- Commentary entry presentation
- Previously revealed history presentation
- Later Commentary-local selection state
- Later native commentary DOM and interaction
- Later autoscroll and learner scroll suspension
- Later newer-steps indication
- Safe structured commentary-link presentation

## Does not own

- Canonical semantic position
- Reveal-frontier advancement or reset
- Runtime command acceptance or settlement
- Transport policy
- Subject rendering
- Renderer control
- Raw HTML execution from experience content

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

## Interaction ownership

ADR 0024 applies to Commentary text. Pointer drag-selection over learner-facing text remains browser-owned and cannot enter Transport scrub interaction. Commentary implementation must preserve selectable text rather than installing broad pointer ownership that competes with native selection.

## Safe authored content

Commentary text is rendered as text data, never executable HTML. Structured links use validated `id`, `label`, and `href` fields rather than authored HTML fragments.

## Later checkpoints

Later checkpoints add Commentary-local selection, canonical active presentation, native DOM projection and activation, link presentation, scroll policy, and complete learner-path composition without changing checkpoint 1 reveal ownership.

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
