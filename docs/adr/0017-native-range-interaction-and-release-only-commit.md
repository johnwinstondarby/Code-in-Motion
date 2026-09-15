# ADR 0017: Native Range Interaction and Release-Only Commit

Status: Accepted

Date: 2026-09-15

## Context

Transport checkpoint 8 projects checkpoint 7 semantic range presentation into a native `<input type="range">` and deliberately installs no interaction listeners. Checkpoint 3 already owns local scrub preview and release-only semantic commit.

The next seam needs to connect native range activity to that existing scrub lifecycle without introducing pointer-coordinate geometry, a second preview state, direct Runtime authority, or a second command path.

A native range control already normalizes mouse, pointer, touch, keyboard, and assistive-technology value changes into DOM range events. Transport can consume that normalized value rather than interpreting physical device coordinates.

## Decision

### Consume native range events rather than pointer geometry

Checkpoint 9 listens on one injected native range control for exactly:

```text
input
change
pointercancel
touchcancel
```

`input` and `change` are the primary interaction path. Browser-native range behavior owns mouse, pointer, touch, keyboard, focus, and value normalization.

Transport does not read pointer coordinates, calculate track geometry, install document-level drag listeners, call pointer capture, or derive semantic position from pixels.

`pointercancel` and `touchcancel` exist only to close an active local preview without issuing a semantic command.

### Keep checkpoint 3 as the scrub-state owner

Checkpoint 9 receives exactly:

```text
control
gesture
binding
```

`gesture` must be the exact frozen checkpoint 3 scrub surface:

```text
begin
update
commit
cancel
read
```

`binding` must be the exact frozen checkpoint 8 projection surface:

```text
refresh
```

The interaction layer receives no Transport controller, raw `seek`, Runtime read surface, Runtime events, renderer, commentary surface, or `CiMInstance`.

### `input` changes preview only

For each native `input` event, Transport reads the range ordinal from the control and converts it to the normalized semantic rail ratio:

```text
ratio = value / max
```

The native range contract remains:

```text
min  = 0
step = 1
max  = final semantic boundary ordinal
```

If no scrub gesture is active, `input` calls `begin(ratio)`. If a gesture is already active, it calls `update(ratio)`.

After the local preview changes, checkpoint 9 calls checkpoint 8 `refresh()` so the native range value and `aria-valuetext` reflect checkpoint 7 projection from the current local preview.

No semantic command is submitted by `input`.

### `change` commits once

A native `change` event resolves the control's current ordinal into the same scrub preview path, then calls `gesture.commit()` exactly once.

This supports both ordinary `input`-then-`change` browser sequences and a valid `change` event that arrives without a preceding `input` event.

Checkpoint 9 does not inspect, normalize, await, debounce, coalesce, or gate the command outcome returned by `gesture.commit()`.

The final preview remains the last applied checkpoint 8 projection after commit. Later canonical synchronization remains owned by the existing checkpoint 8 `refresh()` seam and the composition layer. Checkpoint 9 therefore adds no Runtime event subscription or post-command state propagation policy.

### Cancellation issues no command

If `pointercancel` or `touchcancel` occurs while preview is active, checkpoint 9 calls `gesture.cancel()` and then `binding.refresh()` to restore the latest canonical projection.

A trailing `change` associated with the cancelled native interaction is suppressed once. The next `input` begins a new interaction normally.

Cancellation while no preview is active is a no-op.

### Interaction updates are transactional before commit

Before changing local preview state, checkpoint 9 records the current checkpoint 3 scrub state.

If preview mutation or checkpoint 8 refresh fails before semantic commit, it attempts to restore the prior gesture state and prior projected presentation. If rollback is incomplete, an `AggregateError` exposes the original failure and rollback failures.

A synchronous `gesture.commit()` failure occurs after checkpoint 3 has closed local preview. Checkpoint 9 refreshes canonical presentation and rethrows the commit failure. If that canonical refresh also fails, both failures are exposed through `AggregateError`.

### Dispose only the interaction listeners

The returned checkpoint 9 surface is exact and frozen:

```text
dispose
```

`dispose()` removes the four listeners installed by checkpoint 9. Successful disposal is idempotent. Listener-removal failure leaves disposal retryable.

If local preview is active after listener removal succeeds, disposal cancels that preview and refreshes canonical presentation before closing.

Checkpoint 8 projection remains a separate capability and may continue to be refreshed by composition after checkpoint 9 interaction disposal.

## Consequences

The browser remains the physical-input normalization layer for the native range control.

Checkpoint 3 remains the sole owner of scrub preview and release-only commit state. Checkpoint 8 remains the sole owner of DOM projection. Checkpoint 9 only couples native range activity to those two existing seams.

Keyboard interaction on the focused native range continues to use browser-native slider behavior because checkpoints 4 and 6 already yield to native input controls. Those value changes enter checkpoint 9 through the same `input` and `change` events used for pointer and touch interaction.

## Verification

Checkpoint 9 verification pins:

- an exact frozen `dispose`-only interaction surface;
- exactly four listeners on the injected native range control: `input`, `change`, `pointercancel`, and `touchcancel`;
- local preview begin and update from native `input` with no semantic command;
- one semantic scrub commit from native `change`;
- valid change-only activation without a preceding input event;
- browser-normalized ordinal-to-ratio conversion with no pointer geometry;
- pointer and touch cancellation with no semantic command and canonical refresh;
- suppression of one trailing change after cancellation;
- invalid native range ordinal state failing before preview mutation or command submission;
- synchronous commit failure closing preview, refreshing canonical presentation, and propagating failure;
- canonical settlement synchronization remaining external through checkpoint 8 `refresh()`;
- disposal cancelling active preview, removing only checkpoint 9 listeners, remaining idempotent after success, and remaining retryable after listener-removal failure;
- partial listener-installation rollback;
- exact capability validation for control, checkpoint 3 gesture, and checkpoint 8 binding;
- repository schema, architecture, Core-authority, and full test gates on Node 20 and Node 22.
