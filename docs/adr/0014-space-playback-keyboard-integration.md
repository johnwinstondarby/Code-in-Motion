# ADR 0014: Space Playback Keyboard Integration

Status: Accepted

Date: 2026-09-15

## Context

Transport checkpoint 1 defines Space as activation of an already-selected playback action. Checkpoint 4 establishes scoped DOM keyboard ownership and intentionally leaves Space unbound. Checkpoint 5 supplies the missing read-only playback presentation projection:

```text
read() -> { action }
```

where `action` is exactly `play` or `pause`.

Space can now be integrated without giving the DOM keyboard layer direct Runtime read authority or allowing it to infer playback state.

Two interaction hazards require explicit rules. A focused native button already receives browser Space activation, so a root-level handler must yield rather than submit a duplicate command. Keyboard auto-repeat can also generate repeated Space keydown events and oscillate play/pause state if each repeat is accepted.

## Decision

### Preserve checkpoint 4 and add a stricter integration constructor

The checkpoint 4 constructor remains unchanged:

```text
createTransportKeyboardBinding({ root, timelineKey })
```

Checkpoint 6 adds a separate constructor:

```text
createTransportPlaybackKeyboardBinding({
  root,
  timelineKey,
  playbackKey,
  playbackPresentation
})
```

The new constructor installs exactly one `keydown` listener on the injected root and returns the same exact frozen one-method disposal surface as checkpoint 4.

It receives no complete Transport controller, command port, Runtime read surface, event stream, renderer, commentary surface, or `CiMInstance`.

`playbackPresentation` must be the exact frozen checkpoint 5 surface containing only `read`. `playbackKey` is the narrow checkpoint 1 command mapping capability.

### Space uses the projected action

For an eligible Space keydown with exact `KeyboardEvent.key` value `" "`:

1. apply the checkpoint 4 native-interaction yield rules;
2. read a fresh playback presentation state;
3. validate the exact frozen `{ action }` record;
4. call `preventDefault()` once;
5. call `playbackKey(" ", action)` once.

The keyboard layer does not cache the action and does not infer it from prior commands or local state.

If presentation read throws or returns malformed state, the handler fails closed without preventing native behavior and without submitting a command.

The legacy `Spacebar` key spelling is outside the v1 contract.

### Space auto-repeat is ignored

A Space event with `event.repeat === true` performs no presentation read, no `preventDefault()`, and no command submission.

Timeline navigation keys retain normal key-repeat behavior. Repeated ArrowLeft, ArrowRight, Home, or End events continue through the checkpoint 4 timeline path.

This asymmetry prevents rapid play/pause oscillation while preserving deliberate repeated semantic navigation.

### Native controls retain ownership

The checkpoint 4 ownership rules apply before playback presentation is read. Space therefore yields on native controls, editing regions, protected ARIA interactions, modifier chords, IME composition, active text selection, already-prevented events, and events outside the injected scope.

In particular, Space on a focused native play/pause button is handled by the browser button activation path and is not duplicated by the scoped root keyboard handler.

## Consequences

- Space can activate the current playback action without direct Runtime access.
- Checkpoint 4 remains valid and unchanged for consumers that need timeline-only keyboard behavior.
- One integrated binding owns both timeline keys and Space, avoiding overlapping root listeners.
- Playback action selection remains checkpoint 5 presentation logic.
- Command acceptance remains Runtime-owned.
- Native button activation and text/editing behavior retain browser ownership.

## Verification

Tests must prove:

- the integrated binding installs one scoped listener and exposes only `dispose`;
- Space reads fresh projected `play` and `pause` actions and submits each exactly once;
- Space auto-repeat emits no read, prevention, or command;
- timeline key repeat remains eligible and does not read playback presentation;
- legacy `Spacebar` is ignored;
- Space on native controls does not double-submit;
- checkpoint 4 native-yield rules execute before playback presentation is read;
- active text selection yields Space;
- presentation exceptions, mutable state, extra keys, accessors, and unknown actions fail closed;
- widened or malformed integration authority fails closed;
- disposal remains scoped and idempotent;
- the existing checkpoint 4 constructor and tests remain green.
