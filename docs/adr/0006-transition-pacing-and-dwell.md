# ADR 0006: Transition Pacing and Dwell Ownership

Status: Accepted for CiM v1

## Context

CiM separates semantic time from wall-clock time. Continuous playback needs two distinct timing concepts:

1. transition duration, which is tied to how a renderer animates from one absolute state to another;
2. dwell duration, which is instructional time spent at a stable semantic boundary before continuous playback advances.

Leaving both implicit would let renderers determine the entire learner pace and would prevent an experience from allocating reading time to commentary-heavy steps.

## Decision

Renderer implementations own transition duration.

A renderer may derive transition duration from its implementation and opaque renderer configuration. It must use the injected CiM clock/scheduler for semantically significant animation timing. Runtime does not inspect renderer-specific transition timing values.

The shared experience schema may provide an optional non-negative integer `dwell_ms` on each semantic step.

`dwell_ms` is consumed by Runtime only during continuous playback after that step has committed and before the following transition begins.

Rules:

- direct navigation ignores `dwell_ms`;
- deep-link initialization ignores `dwell_ms`;
- `home()`, `end()`, `next()`, `previous()`, and `seek()` ignore dwell at their destination until a later explicit `play()` begins continuous playback;
- reduced-motion mode may suppress or shorten renderer transition animation, but it does not remove authored dwell;
- `pause()` during dwell freezes the injected clock and preserves the remaining dwell interval;
- a navigation command during dwell clears continuous playback intent and cancels the remaining dwell;
- absent `dwell_ms` means zero authored dwell in v1;
- site configuration may impose a safety maximum, but deterministic replay must record the effective runtime configuration if that maximum changes the authored value.

The final semantic step does not schedule a following transition after its dwell expires.

## Consequences

- Renderer animation remains renderer-owned and subject-specific.
- Instructional reading pace can be authored without introducing declarative animation instructions.
- The shared schema gains one optional field, `steps[].dwell_ms`.
- Runtime owns dwell scheduling and evidence because dwell affects continuous playback behavior.
- Replay remains deterministic when validated experience data, renderer version, runtime configuration, and virtual clock are held constant.

## Rejected Alternatives

### Renderer owns both transition and dwell

Rejected because instructional reading time is experience behavior rather than visual rendering behavior.

### Experience owns transition duration

Rejected for v1 because a generic duration field would imply control over renderer-specific animation behavior and would move the shared schema toward an animation language.

### No dwell concept in v1

Rejected because continuous playback through commentary-heavy steps would otherwise have no shared instructional pacing contract.

## Verification

The harness must prove:

- `dwell_ms` delays only continuous playback;
- navigation bypasses dwell;
- pause freezes dwell on the virtual clock;
- resume continues the remaining dwell interval;
- navigation during dwell cancels the remaining dwell and stops continuous playback intent;
- reduced motion preserves dwell;
- replay with the same effective timing inputs reproduces the same semantic event timing.
