# ADR 0019: Native Visual Rail DOM Projection

- Status: Accepted
- Date: 2026-09-15

## Context

Checkpoint 10 exposes exact visual records for the reserved initial anchor and authored semantic markers. A browser presentation layer needs to apply those records to visible controls while preserving the established separation between presentation and interaction.

## Decision

Checkpoint 11 binds the checkpoint 10 visual rail projection to one native `button[type="button"]` initial control and a frozen ordered array of native authored-marker buttons.

The public surface is exact and frozen:

```text
refresh
```

Construction performs one refresh. Later refreshes obtain a fresh checkpoint 10 presentation record.

The binding owns only each control's visible text plus these semantic and styling attributes:

```text
aria-label
aria-current
data-cim-step-id
data-cim-index
data-cim-current
data-cim-target
data-cim-preview
```

Authored marker controls additionally receive:

```text
data-cim-revealed
```

`aria-current="step"` is present only on the canonical current boundary. Preview and pending target remain separate data flags. The initial anchor has no reveal flag because reveal history applies to authored commentary boundaries.

The binding installs no listeners and receives no command capability. Native button role, focus, and keyboard activation remain browser-owned.

Every refresh validates the complete presentation and control alignment before writing. It snapshots all checkpoint-owned fields across all controls before the first write. A write failure restores those fields across the complete rail. Incomplete rollback produces an `AggregateError` containing the original failure and rollback failures.

## Consequences

Visual CSS may distinguish current, target, preview, and revealed states without reading Runtime or reinterpreting semantic state.

Marker activation remains a separate later checkpoint. Composition retains refresh scheduling after external canonical settlement.

## Rejected alternatives

- Installing click or keyboard listeners in the visual binding. That would combine presentation authority with interaction authority.
- Replacing native buttons with custom interactive elements. Native controls already supply focus and keyboard activation semantics.
- Using preview as `aria-current`. `aria-current` reports canonical position; preview remains local until commit.
