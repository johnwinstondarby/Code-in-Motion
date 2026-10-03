# R42 Playback Rate and Presentation-Time Dilation QA

ADR: `docs/adr/0047-playback-rate-and-presentation-time-dilation.md`.
PR: #70, `r42/playback-rate`.
Protected Console oracle: SHA-256 `1b636fcb…`, 19 boundaries, unchanged by this slice.

## Scope

This record maps each ADR 0047 Verification family to the committed proof and to mutation probes exercised during review. It separates production-code coverage from harness-driver assertion-strength checks.

Playback rate changes presentation timing only. Source time remains authoritative for semantic event timestamps and operational deadlines. Renderer contexts do not expose rate.

## Verification traceability

| ADR 0047 family | Committed proof | Evidence | Mutation evidence |
|---|---|---|---|
| Presentation scheduler | `tests/presentation-scheduler.test.mjs` | 0.5×, 1×, and 2× dilation; re-anchoring; remaining-interval re-arming; source-paced frames with presentation `now()`; validation; cancellation ownership | Ignoring rate, inverted delay conversion, and broken re-anchoring are detected by later Runtime/Console proofs as well. |
| Authored versus effective rate, range, no-op, basic lifecycle | `tests/runtime-playback-rate.test.mjs` | v1 starts at 1.0; v2 uses `presentation.default_playback_rate`; pre-play change appears in `playback.started`; finite range [0.5, 2.0]; same-rate no-op; paused rate changes arm no work | Range and event/state assertions fail if invalid values are accepted, no-op emits a rate event, or the effective start rate is not recorded. |
| Source-time authority and renderer non-exposure | `tests/runtime-playback-rate-authority.test.mjs` | Renderer context stays at the exact contract surface; abort and dispose acknowledgement deadlines remain 1000 source ms at 0.5× and 2× | Moving dispose-path abort acknowledgement to presentation time is caught; moving dispose acknowledgement to presentation time is caught; leaking `playbackRate` into renderer configuration is caught. |
| Lifecycle rejection and lifecycle-render source-time authority | `tests/runtime-playback-rate-lifecycle-authority.test.mjs` | Initialization, recovery, faulted, disposal-in-progress, and disposed behavior; initialization/recovery abort acknowledgement at exactly 1000 source ms for 0.5× and 2× | Moving `#settleCancelledLifecycleRender` acknowledgement timing to presentation time is caught by initialization and recovery cases. Checkpoint-4 follow-up bounds the 1000 ms assertion so the 0.5× late direction fails directly instead of leaving a pending promise. |
| Full Git specimen dilation and protected oracle | `tests/runtime-playback-rate-git-oracle.test.mjs` | 1× = 12,760 source ms; 0.5× = 25,520; 2× = 6,380; identical complete renderer frame sequence; convergence on all 19 protected digests | Rate ignored, dilation inverted, renderer timing constant 45→46 ms, and altered oracle digest are each caught. Steady-state playback intentionally does not prove presentation-`now()` scaling by itself. |
| Mid-typing continuity and renderer-facing clock | `tests/runtime-playback-rate-midflight-git.test.mjs` | Direct 2×→0.5× clock probe: source 200 maps to presentation 400 and callback fires at source 1,400; real Git 1×→2× mid-typing settles at 9,728 source ms with identical frames/oracle | Inverted `now()` scaling is caught by the direct clock proof; ignored rate conversion and removed re-anchoring are caught; Git proof separately guards continuity across the change. |
| Output reveal, response entry, and dwell changes | `tests/runtime-playback-rate-phase-continuity.test.mjs` | Real Console paths start at 2× and change to 0.5×; output reveal 665→2,060 ms; response entry 250→700 ms; dwell next transition at 1,500 ms; transition identity and one rate event preserved | Inverted `now()` scaling is caught in all three real-renderer cases; source-clock dwell arming is caught; a fabricated `transition_id` on an idle/dwell rate event is caught. |
| Pause composition | `tests/runtime-playback-rate-pause-composition.test.mjs` | Typing, ordinary output reveal, interactive output reveal, response entry, and authored dwell; DOM and presentation `now()` freeze while source time advances; 2×→0.5× while paused arms nothing; resume uses only the preserved remainder | Failure to cancel armed renderer work, paused rate change that re-arms work, advancing renderer `now()` during pause, restarting a full renderer interval, restarting full dwell, and resuming at the old rate are caught. Reveal pauses are source 160 / presentation 320 and carry an explicit strict-inside-interval guard so a frame boundary cannot mask a restart fault. |
| Replay evidence and schedule reconstruction | `tests/runtime-playback-rate-replay.test.mjs` | Recorded effective start rate plus post-start `playback.rate_changed` events reconstruct 0→600→2,390 source-ms boundary schedule and the protected renderer evidence through Runtime with `source: replay` | **Production coverage:** `playback.started` recording the authored default instead of the effective rate is caught; presentation-time event timestamps are caught. **Harness-driver assertion checks:** dropping the 100 ms typing change, dropping the 1,000 ms dwell change, or applying the 2,000 ms output change one source ms late are caught by the independent replay driver. There is no production replay engine in `src/` in this slice. |

## Mutation record

The mutation probes below were applied one at a time and restored after each run.

| ID | Fault | Result |
|---|---|---|
| P1 | Ignore playback rate in presentation delay conversion | Caught |
| P3 | Invert playback-rate scaling for presentation `now()` | Caught by direct clock proof and non-1× real-renderer phase proofs |
| P4 | Remove presentation re-anchoring on rate change | Caught by direct clock and Git mid-typing continuity proofs |
| D1 | Arm authored dwell on source time | Caught by dwell phase proof |
| E1 | Add `transition_id` to a dwell/idle `playback.rate_changed` event | Caught by dwell event-shape proof |
| A1 | Move transition/dispose abort acknowledgement deadline to presentation time | Caught |
| A2 | Move renderer-dispose acknowledgement deadline to presentation time | Caught |
| A3 | Move lifecycle-render abort acknowledgement deadline to presentation time | Caught after checkpoint 4; bounded follow-up prevents the slow direction from hanging |
| X1 | Expose playback rate through renderer context/configuration | Caught |
| C1 | Change Console typing timing constant from 45 to 46 presentation ms | Caught by full Git specimen duration proof |
| O1 | Alter one protected Console oracle digest | Caught |
| M1 | Pause fails to cancel armed renderer work | Caught in all four renderer animation cases |
| M2 | Rate change while paused re-arms work | Caught in renderer and dwell paths |
| M3 | Renderer-facing `now()` advances while paused | Caught in all four renderer animation cases |
| M4a | Renderer resume restarts the full current interval | Caught in typing, both reveal cases, and response entry after reveal pause points moved strictly inside an interval |
| M4b | Dwell resume restarts full authored dwell | Caught |
| M5 | Resume uses pre-pause 2× instead of current 0.5× | Caught in renderer and dwell paths |
| R1 | `playback.started` records authored default instead of effective start rate | Caught; production Runtime coverage |
| R2 | Replay driver drops the source-100 typing rate change | Caught; harness-driver assertion check |
| R3 | Replay driver drops the source-1,000 dwell rate change | Caught; harness-driver assertion check |
| R4 | Replay driver applies the source-2,000 output rate change at 2,001 | Caught; harness-driver assertion check |
| R5 | `playback.rate_changed` timestamps use presentation time | Caught; production Runtime coverage |

## Protected invariants

- The Console oracle remains the same 19-digest artifact.
- Rate does not enter Core state or canonical renderer evidence.
- Renderer contexts remain exactly the RENDERER-CONTRACT surface.
- Source-time abort/dispose/fault deadlines remain independent of playback rate.
- Semantic event timestamps remain source time.
- Rate changes preserve semantic position, transition identity, frame sequence, and settled renderer output.
- `0.1.10` remains excluded from post-R42 packaging. RC#2 release identity remains at least 0.2.0.

## Closure condition

ADR 0047 is ready for implementation-slice closure when:

1. `docs/EVENTS.md` documents `playback.started` effective rate and `playback.rate_changed`;
2. `docs/CIM-SPEC.md` §5 documents `setPlaybackRate(rate)` and its lifecycle/range semantics;
3. `docs/CIM-SPEC.md` §8 documents source versus presentation time and rate/pause composition;
4. the exact closure head passes Verify CiM contracts, WordPress Floor QA, WordPress Browser E2E, and WordPress Playground PR Preview.
