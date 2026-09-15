# ADR 0013: Playback Presentation Projection

Status: Accepted

Date: 2026-09-15

## Context

Transport checkpoint 1 defines Space as activation of an already-selected playback action. The caller supplies either `play` or `pause`; the command mapper does not read Runtime state or invent a toggle policy.

Checkpoint 4 added scoped DOM keyboard ownership but deliberately left Space unbound because that layer had no narrow presentation authority for choosing the action.

Runtime already exposes the facts needed to project that action through `CiMInstance.read.snapshot()`:

```text
canonical.status
operational.playbackIntent
```

Neither fact is sufficient alone. A continuous-playback transition and a discrete navigation transition may both report `status: transitioning`, while `playbackIntent` distinguishes continuous playback. A paused transition or dwell must project `play` because Runtime `play()` resumes preserved work, even when playback intent remains true.

The full Runtime read surface also exposes `boundaryIds()`, which playback presentation does not require.

## Decision

### Playback presentation receives a narrow snapshot-only observation port

Composition supplies one frozen plain object with exactly one function:

```text
snapshot
```

The complete `CiMInstance.read` object is not accepted directly because its `boundaryIds()` capability is unnecessary for this projection. Composition may wrap `CiMInstance.read.snapshot` in the exact one-function port.

The projection reads a fresh snapshot for every presentation read and selects only:

```text
canonical.status
operational.playbackIntent
```

The presentation surface is frozen and exposes exactly:

```text
read
```

`read()` returns one frozen record:

```text
action
```

where `action` is exactly `play` or `pause`.

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

`paused` has precedence because Runtime `play()` is the resume command for preserved transition or dwell work.

Outside `paused`, `playbackIntent` is the authoritative fact for whether the learner-facing playback action should be pause. `status: transitioning` does not imply pause because discrete navigation and recovery can also use transitioning status.

### Presentation does not decide command acceptance

Checkpoint 5 does not project an enabled, disabled, available, blocked, or accepted state.

Initialization, recovery, fault, disposal, active discrete navigation, and other command gates remain Runtime-owned. A later UI may present broader lifecycle state through a separately documented contract, but this playback-action projection does not duplicate Runtime acceptance policy.

Checkpoint 5 therefore supplies action selection for later Space and play/pause presentation without changing the checkpoint 1 command authority boundary.

## Consequences

- Space can later call the existing `playbackKey(action)` path without reading Runtime directly.
- Continuous playback remains distinguishable from unrelated `transitioning` activity.
- Paused work consistently presents a resume action.
- Transport receives no boundary-order, event-stream, command, renderer, commentary, or disposal authority through this seam.
- The projection cannot suppress a learner action based on guessed Runtime acceptance state.

## Verification

Tests must prove:

- the observation port is frozen and contains exactly `snapshot`;
- the complete Runtime read surface is rejected;
- the presentation surface is frozen and contains exactly `read`;
- the returned state is frozen and contains exactly `action`;
- idle with no playback intent projects `play`;
- continuous playback, including `transitioning` playback, projects `pause`;
- discrete `transitioning` activity with no playback intent projects `play`;
- `paused` projects `play` regardless of playback intent;
- each read uses a fresh snapshot rather than cached state;
- malformed status, playback intent, descriptors, and mutable nested snapshots fail closed;
- no command or Runtime authority is exposed by the presentation surface.
