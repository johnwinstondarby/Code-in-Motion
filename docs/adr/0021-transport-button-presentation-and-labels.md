# ADR 0021: Transport Button Presentation and Labels

- Status: Accepted
- Date: 2026-09-15

## Context

Transport checkpoint 5 already projects the learner-facing playback action as `play` or `pause`. Previous, next, home, end, and restart are stable learner actions. A native button layer needs concise labels and action identities without acquiring Runtime command-acceptance policy.

## Decision

Checkpoint 13 adds a headless Transport button presentation. Construction receives exactly:

```text
playbackPresentation
labels
```

`playbackPresentation` is the exact frozen checkpoint 5 `{ read }` surface. `labels` is an exact frozen plain record containing non-empty learner-facing strings for:

```text
play
pause
previous
next
home
end
restart
```

The exact frozen public surface is:

```text
read
```

Each read obtains a fresh checkpoint 5 playback action and returns exact frozen button records for:

```text
playback
previous
next
home
end
restart
```

Each button record contains exactly:

```text
action
label
```

The playback record uses the fresh `play` or `pause` action and its corresponding label. The other five records preserve their fixed actions and configured labels.

Checkpoint 13 exposes no `enabled`, `disabled`, `available`, `blocked`, or equivalent field. Runtime remains the sole owner of command acceptance and lifecycle rejection.

The presentation acquires no DOM, command, event-stream, renderer, commentary, Runtime, or disposal authority.

## Consequences

Native button presentation can refresh labels and action identity from one narrow headless projection while keeping availability policy out of Transport.

A later binding may dispatch the projected action through narrow command functions without inferring Runtime state.

## Rejected alternatives

- Projecting disabled state from lifecycle status. That would create a second command-acceptance policy outside Runtime.
- Adding `togglePlayback`. Checkpoint 5 already selects the explicit learner-facing `play` or `pause` action.
- Hardcoding English labels in DOM code. Labels are explicit presentation inputs and remain independent from command identity.
