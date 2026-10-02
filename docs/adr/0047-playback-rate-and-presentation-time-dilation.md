# ADR 0047: Playback Rate and Presentation-Time Dilation

Status: Accepted (R41 F6). Implementation follows as its own reviewed slice.

Date: 2026-10-02

## Context

The CiM Player offers a playback-rate control (0.5× to 2.0×), and `localis.cim/v2` carries `presentation.default_playback_rate`. Authoring JSON v1 §5 states that playback rate scales authored presentation timing (typing, output reveal, explanation reveal, dwell, and scrolling animation), while interactive controls remain immediate. No Runtime module implements a rate today (R41 F6).

`CiMInstance` receives one injected scheduler, and today uses it for two different kinds of time:

- **Learner-facing presentation time.**
  - Every transition-scoped renderer clock capability (RENDERER-CONTRACT §6, ADR 0009), within which renderers own transition duration (ADR 0006).
  - Authored dwell (ADR 0006).
- **Operational time.**
  - Renderer acknowledgement deadlines: `waitForRuntimeAcknowledgement` enforces `RENDERER_ABORT_ACK_TIMEOUT_MS` and `RENDERER_DISPOSE_ACK_TIMEOUT_MS`.
  - Event and lifecycle timing.

Both kinds currently read one clock, so rate cannot simply wrap that clock. Doing so would also dilate fault-detection deadlines.

### Pause mid-animation is already decided

The R42 runway deferred "pause mid-animation" to this ADR. ADR 0010 already defines it: `pause()` freezes the in-flight transition's clock capability and the dwell, and `play()` resumes the same transition with the exact remaining work. The `console/v1` slice-3 renderer conforms.

A probe of the real capability `pause()` and `resume()` during a Console output reveal showed:
- the DOM and facade `now()` stayed frozen across 60 seconds of source time;
- after resume, the animation settled to its protected canonical digest after exactly the preserved remaining interval (990 ms of a 1330 ms reveal paused at 340 ms).

This ADR defines no new pause semantics. It requires that proof as a standing conformance test (Verification) and defines only rate.

## Terms

- **Source time:** the injected scheduler's time. It measures the machine.
- **Presentation time:** time as the lesson experiences it. It measures the lesson. At rate `r`, one presentation millisecond elapses in `1/r` source milliseconds.

## Decision

1. **Source time remains the authority.**
   - The injected scheduler stays the raw source-time authority, and Runtime does not wrap or replace it.
   - Runtime derives exactly one rate-dilated *presentation scheduler* from it. Nothing else is dilated.

2. **Only learner-facing presentation timing uses the presentation scheduler.** This covers:
   - every transition-scoped renderer clock capability, so renderer transition timing, including `console/v1` typing, output reveal, and response entry;
   - authored dwell.

   Everything else stays on source time:
   - renderer abort and dispose acknowledgement deadlines;
   - fault and operational deadlines;
   - semantic event timestamps;
   - every other lifecycle deadline.

   A learner's rate preference never changes how quickly a stuck renderer is detected.

3. **Future presentation timing uses the same authority.** Any timed presentation that Authoring JSON v1 requires and that is not yet implemented, including timed Explanation reveal and scrolling animation, must run on the same presentation scheduler. No component may implement its own rate scaling.

4. **Rate changes when, never what.**
   - Rate changes when presentation work occurs in source time.
   - It never changes which semantic events occur, their order, which boundaries commit, or any renderer's settled output.
   - Renderers receive no rate value. Their timing constants are presentation milliseconds (for example, `console/v1`'s 45 ms per character). RENDERER-CONTRACT is unchanged.

5. **Authored default versus effective rate.** These are distinct values with distinct owners.
   - `presentation.default_playback_rate` is **experience metadata**: an authored, compiled, validated suggestion carried by `localis.cim/v2`.
   - `playbackRate` is **effective Runtime presentation state**: the rate actually in force. It is outside Core state and outside canonical evidence, because it is a learner preference and never experience content.
   - A `localis.cim/v2` instance initializes `playbackRate` from `default_playback_rate`. A `localis.cim/v1` instance initializes it to 1.0.

6. **Range.** A rate is a finite number from 0.5 through 2.0 inclusive.
   - Runtime rejects out-of-range, non-finite, and non-number values. It does not clamp.
   - The Player offers the stops 0.5, 0.75, 1.0, 1.25, 1.5, and 2.0. Runtime accepts any value in range.

7. **`setPlaybackRate(rate)` lifecycle.** Runtime gains one control command. Transport receives it through a narrow capability under ADR 0008, which is not a general clock authority.
   - **When it is accepted.** After successful initialization, while the instance is commandable: idle before first playback, playing, paused, during an in-flight transition, and during dwell.
   - **When it is rejected.** During initialization, active recovery, faulted state, disposal in progress, and after disposal, through the existing command-rejection semantics. Rejection changes no Runtime or Core state and emits no `playback.rate_changed` event. While the event stream is open, a rejected command may still produce the existing command-rejection evidence. After terminal disposal, the stream is already closed.
   - **Validation.** Synchronous. Invalid values (Decision 6) are rejected with no state change and no event.
   - **What acceptance does.** It takes effect immediately:
     - if presentation work is armed, the presentation scheduler re-anchors presentation time at the moment of change and re-arms each pending callback for its remaining presentation interval at the new rate;
     - if nothing is armed (idle, or paused per Decision 8), the new rate is simply recorded.
   - **No-op.** Setting the rate already in force is accepted and emits no event.
   - **Continuity.** Acceptance does not change continuous-playback intent, semantic position, Core state, `transitionId`, or `transitionPhase`. Nothing restarts, skips, or repeats, and no `step.changed` event is emitted.

8. **Interaction with pause (ADR 0010).** Pause and rate compose.
   - Pausing preserves the exact remaining presentation interval.
   - A rate change while paused records the new rate and arms nothing.
   - `play()` resumes the preserved remaining work at the rate then in force.

9. **Frames.** `onFrame` callbacks remain paced by the source frame clock and receive dilated presentation `now()`. Renderers must not derive semantic progress from frame counts, which RENDERER-CONTRACT §6 already implies.

10. **Reduced motion.** Renderers settle directly (RENDERER-CONTRACT §9), so rate has no renderer animation to scale. Rate still scales authored dwell, which reduced motion does not remove (ADR 0006).

11. **Discrete navigation.** Discrete arrivals already discard dwell (ADR 0006), and non-animated renders consume no time, so rate does not affect them.

12. **Observability.**
    - The Runtime snapshot gains `playbackRate`, the effective rate, as operational presentation state.
    - `playback.started` reports the rate in force when playback begins, which may differ from the initialization default if `setPlaybackRate` was accepted earlier.
    - A new event, `playback.rate_changed`, carries `details.from_rate`, `details.to_rate`, and `details.transition_phase`, plus `transition_id` when a transition is in flight. It is emitted only for accepted changes to a different value.
    - All event timestamps remain source time.
    - EVENTS.md and CIM-SPEC §5 and §8 are amended in the implementation slice.

13. **Replay.** Replay records the effective rate at playback start and each `playback.rate_changed` at its semantic position. Two runs of the same command sequence at different rates produce identical semantic event sequences, apart from rate events and source-time fields, and identical canonical renderer evidence at every boundary.

## Feasibility evidence (scratch prototype, not committed)

A 30-line dilated scheduler driving the real `console/v1` renderer and clock capabilities over the full 18-boundary animated playthrough. The prototype dilated only renderer clocks, as Decision 2 prescribes.

| Rate | Source time for the lesson | Converges to the 19-digest oracle | Frame sequence vs 1.0× |
|---|---|---|---|
| 1.0× | 12,760 ms | yes | (baseline) |
| 2.0× | 6,380 ms, exactly half | yes | identical |
| 0.5× | 25,520 ms, exactly double | yes | identical |
| 1.0× changed to 2.0× mid-typing | 9,728 ms | yes | identical |

## Consequences

- No renderer, renderer-contract, state-contract, or canonical-evidence change. The `console/v1` oracle is unaffected.
- Runtime gains one presentation-scheduler module, one command, one snapshot field, and one event. The injected scheduler's contract is unchanged.
- Fault detection is rate-independent.
- Authoring JSON v1 §5's rate guarantee holds by construction for every presentation timing routed through the single presentation scheduler, including future Explanation and scrolling animation (Decision 3).

## Rejected alternatives

### Wrap the injected scheduler and derive everything from it

Rejected. It would dilate renderer acknowledgement deadlines and event timestamps. An earlier draft of this ADR proposed it.

### Pass rate to renderers

Rejected. Every renderer would reimplement scaling, the renderer contract would grow, and a renderer that ignored rate would silently desynchronize from dwell.

### Scale renderer constants at compile time

Rejected. Rate is a runtime learner choice, and baking it into compiled output would make one experience file per rate.

### Restart the in-flight transition on rate change

Rejected. Restarting repeats visible work and breaks the identical-frame-sequence property.

### Clamp out-of-range rates

Rejected. Clamping hides caller defects.

## Verification

The implementation slice must prove:

- **Dilation.** At rates 0.5, 1.0, and 2.0, the complete animated playthrough of the Git specimen produces identical semantic event sequences, identical renderer frame sequences, and convergence to the protected 19-digest oracle. Presentation source durations scale by exactly `1/r`.
- **Source-time authority.** At rates 0.5 and 2.0, renderer abort and dispose acknowledgement timeouts fire at exactly their source-time deadlines, unchanged from 1.0×, and event timestamps are source time.
- **Mid-flight change.** A rate change during typing, output reveal, response entry, and dwell preserves the frame sequence and remaining presentation interval, keeps `transitionId`, and emits exactly one `playback.rate_changed`.
- **Pause composition (ADR 0010, standing proof).** Pause during each `console/v1` animation phase freezes DOM and presentation `now()` while source time advances. Resume settles to the oracle after exactly the remaining interval, at the rate in force at resume. A rate change while paused arms nothing until `play()`.
- **Lifecycle.** `setPlaybackRate` is accepted after successful initialization while commandable: idle before first playback, playing, paused, in-flight, and during dwell. It is rejected during initialization, active recovery, faulted state, disposal in progress, and after disposal, with no Runtime or Core state change and no `playback.rate_changed` event. Existing command-rejection evidence appears while the event stream is open. An unchanged value emits no event.
- **Range.** 0.5 and 2.0 are accepted. 0.49, 2.01, `NaN`, `Infinity`, and non-numbers are rejected without state change or event.
- **Authored versus effective rate.** A v2 experience initializes `playbackRate` from `default_playback_rate`, and a v1 experience at 1.0. `playback.started` reports the effective rate at playback start, including after a pre-start `setPlaybackRate`. `playbackRate` appears in neither Core state nor canonical evidence.
- **Replay.** Replaying a recorded session with its rate events reproduces the original presentation schedule exactly.
- **No renderer exposure.** Renderer contexts and facades remain exactly as RENDERER-CONTRACT specifies; no rate value is reachable from a renderer.
