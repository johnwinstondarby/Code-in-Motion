# ADR 0022: Native Transport Button Binding and Activation

- Status: Accepted
- Date: 2026-09-15

## Context

Checkpoint 13 exposes explicit learner-facing action and label records for playback, previous, next, home, end, and restart. The final v1 Transport control seam needs to project those records onto native buttons and forward native activation through narrow checkpoint 1 command capabilities.

The playback action can change between `play` and `pause` without a DOM refresh, so playback activation must consult fresh presentation state. Static controls have fixed semantic identities and do not require state reads to choose their commands.

## Decision

Checkpoint 14 constructs from exactly three capabilities:

```text
controls
presentation
commands
```

`controls` is an exact frozen plain record containing distinct native `button[type="button"]` controls for:

```text
playback
previous
next
home
end
restart
```

`presentation` is the exact frozen checkpoint 13 `{ read }` surface.

`commands` is an exact frozen plain record containing only:

```text
play
pause
previous
next
home
end
restart
```

The exact frozen public binding surface is:

```text
refresh
dispose
```

Construction validates a complete checkpoint 13 state, projects every control once, then installs one `click` listener on each control. `refresh()` reads a fresh presentation state and owns only:

```text
textContent
aria-label
data-cim-action
```

The binding does not write `disabled`, `role`, `tabindex`, or command-acceptance state. Native focus and Enter/Space activation remain browser-owned.

Static button clicks dispatch their fixed command by control identity. Playback clicks obtain a fresh checkpoint 13 presentation read and dispatch the resulting explicit `play` or `pause` command. Mutable DOM attributes never select a command.

An already default-prevented click yields. The binding does not call `preventDefault()` or `stopPropagation()`, synthesize keyboard events, debounce, coalesce, serialize, wait for outcomes, or create an in-flight gate. Synchronous command errors are not converted into local acceptance policy.

A command submission does not trigger an automatic presentation refresh. Composition remains responsible for scheduling refresh after canonical or operational settlement.

Every refresh validates the complete presentation before writing and transactionally restores checkpoint-owned DOM fields after a write failure. Partial listener installation is rolled back together with construction-time DOM projection. Disposal removes only checkpoint 14 click listeners, is idempotent after complete success, and retains failed removals for retry.

## Consequences

Checkpoints 1 through 14 now form the v1 Transport path from narrow learner intent through semantic range, marker, keyboard, and native button presentation and activation without moving Runtime acceptance authority into the UI layer.

Host composition may choose layout, CSS, icons, and refresh scheduling without changing Transport semantic ownership.

## Rejected alternatives

- Reading `data-cim-action` to select commands. Mutable DOM is presentation data rather than semantic command authority.
- Disabling buttons based on projected lifecycle state. Runtime remains the sole command-acceptance authority.
- Synthesizing Enter or Space handlers. Native buttons already provide keyboard activation.
- Automatically refreshing after each command. Command settlement is asynchronous and composition owns observation-driven refresh scheduling.
