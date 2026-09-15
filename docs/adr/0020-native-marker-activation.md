# ADR 0020: Native Marker Activation

- Status: Accepted
- Date: 2026-09-15

## Context

Checkpoint 11 projects semantic marker state onto native buttons without interaction authority. Marker activation now needs a narrow path from native button activation to the existing checkpoint 1 `marker(stepId)` command mapper.

The DOM projection already carries step IDs as data attributes for styling and inspection, but mutable DOM cannot define command targets. Semantic identity must come from a validated Transport presentation surface.

## Decision

Checkpoint 12 installs one `click` listener on the native initial button and each native authored-marker button. Construction receives exactly:

```text
initialControl
markerControls
presentation
marker
```

`presentation` is the exact frozen checkpoint 10 `{ read }` surface. Construction reads and validates it once, captures the canonical semantic IDs aligned to control order, and never derives command targets from DOM attributes.

`marker` is the narrow checkpoint 1 marker capability. One eligible click invokes:

```text
marker(stepId)
```

exactly once. The initial control maps to `initial`; authored controls map to their captured authored IDs.

The interaction installs no keyboard listener. Native `button[type="button"]` controls retain browser Enter/Space activation and focus semantics. The interaction does not call `preventDefault()` or `stopPropagation()`. A click already marked `defaultPrevented` yields without command submission.

The interaction adds no debounce, coalescing, serialization, outcome inspection, or in-flight acceptance gate.

The exact frozen public surface is:

```text
dispose
```

Partial listener installation is rolled back. Disposal removes only checkpoint 12 listeners, is idempotent after successful completion, and retains failed removals for retry.

## Consequences

Marker activation uses the same command provenance and Runtime acceptance policy established by checkpoint 1 while the DOM remains presentation data rather than semantic authority.

Keyboard activation stays native and therefore does not duplicate the scoped keyboard bindings from checkpoints 4 and 6.

## Rejected alternatives

- Reading `data-cim-step-id` at click time. Mutable DOM would gain semantic command-target authority.
- Binding `keydown` or `keyup` for Enter and Space. Native buttons already generate click activation for keyboard use.
- Injecting the complete Transport controller. Marker activation requires only the existing `marker(stepId)` capability.
