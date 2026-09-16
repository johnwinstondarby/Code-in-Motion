# ADR 0034: Runtime Reduced-Motion Adoption

Status: Accepted

Date: 2026-09-16

## Context

ADR 0031 established read-only reduced-motion preference observation. ADR 0032 established construction-time Host sampling into Runtime. ADR 0033 added a separate live preference-change observation capability while deliberately leaving adoption by an already-running Runtime unresolved.

Runtime renderer contexts are exact frozen values. Each render receives one boolean `reducedMotion` value as part of that context. Runtime also owns transition, pause, dwell, recovery, and disposal lifecycles. A preference change can therefore arrive while renderer work is active, while its transition clock is paused, while playback is dwelling between steps, while Runtime is restoring a recovery anchor, or while the instance is stable.

Live adoption must honor the learner's latest preference without mutating a renderer context that has already crossed the Runtime boundary and without inventing semantic navigation, cancellation, recovery, or playback activity solely because a preference changed.

## Decision

1. Runtime exposes:

```text
adoptReducedMotion(reducedMotion)
```

on `CiMInstance`.

2. The input must be boolean. Invalid values fail closed before changing Runtime motion configuration.

3. Runtime stores the adopted value only in its private reduced-motion configuration. Core canonical state and Runtime operational snapshot state are unchanged.

4. The return value is exact frozen data:

```text
changed
reducedMotion
```

with shape:

```text
{ changed: boolean, reducedMotion: boolean }
```

`changed` reports whether the private Runtime value changed. Re-adopting the current value returns `changed:false`.

5. Every new renderer context samples the private Runtime reduced-motion value when that render begins.

6. A renderer context already supplied to a renderer remains immutable and retains the value captured at render start. Runtime does not mutate or replace that context after handoff.

7. A preference adoption does not rerender the current stable semantic boundary solely to restate the same boundary with a different motion preference.

8. A preference adoption does not allocate a command ID or transition ID, mutate Core semantic state, emit command or semantic events, cancel active work, restart active work, or alter playback intent.

9. During an active transition, adoption changes only the value available to the next renderer context. The active transition completes under its captured value.

10. During a paused transition, adoption does not replace the renderer task or transition identity. Resuming continues the same paused work under its captured value. A later renderer context uses the adopted value.

11. During authored dwell, adoption does not restart, shorten, extend, or cancel dwell. The transition that begins after dwell samples the adopted value.

12. During renderer recovery, an already-started restoration render retains its captured value. Later renderer work samples the adopted value.

13. Adoption may occur before initialization. The initial renderer context then samples the latest adopted value.

14. Adoption is permitted while a usable instance is stable, transitioning, paused, dwelling, or recovering because the operation does not alter those lifecycles.

15. A disposing or disposed Runtime rejects adoption. Terminal lifecycle authority remains with `dispose()`.

16. Runtime does not import Accessibility or subscribe to browser preference changes. Host composition remains responsible for connecting the ADR 0033 change-observation seam to `adoptReducedMotion()` in a later checkpoint.

## Consequences

The reduced-motion preference can change during a live CiM session without violating renderer-context immutability or rewriting semantic history.

The adoption boundary is deterministic: a render uses the preference that existed when its context was created. The next render uses the latest adopted value.

Long-running renderer work may finish under a preference that changed after render start. CiM accepts that bounded delay rather than interrupting an established transition solely for a presentation preference change. Renderers that need finer-grained internal motion response would require a different renderer capability contract and are outside this decision.

Stable content is not rerendered solely for preference adoption. This avoids presentation-only preference changes creating renderer evidence or observable semantic activity where no navigation occurred.

Host can later connect Accessibility change records to Runtime through one narrow boolean adoption seam without transferring `MediaQueryList`, browser event, or subscription authority into Runtime.

## Rejected alternatives

### Mutate the active renderer context

Renderer contexts are frozen capability boundaries. Mutating an already-issued context would violate the existing renderer contract and make render behavior depend on out-of-band state changes.

### Abort and restart every active transition

This would convert a presentation preference change into cancellation and transition lifecycle activity, potentially changing semantic timing and playback behavior.

### Rerender the current stable boundary immediately

A stable rerender would create renderer work without semantic movement and would complicate evidence ordering for a preference-only change.

### Alter dwell timing when reduced motion is adopted

Authored dwell is semantic playback pacing rather than animation duration. Preference adoption therefore leaves dwell timing unchanged.

### Give Runtime the live Accessibility source

Runtime receives a boolean adoption call rather than browser observation authority. Accessibility owns observation; Host owns composition; Runtime owns application to future renderer contexts.

## Verification

Runtime reduced-motion adoption verification pins:

- exact frozen `{ changed, reducedMotion }` adoption results;
- same-value adoption as a private configuration no-change;
- boolean-only input validation;
- pre-initialization adoption reaching the initial renderer context;
- stable adoption without rerender, Core mutation, operational mutation, or event emission;
- the following renderer context receiving the adopted value;
- active and paused renderer work retaining its captured value;
- transition identity and renderer task preservation across pause/resume after adoption;
- authored dwell duration and remaining-time preservation;
- the post-dwell renderer context receiving the adopted value;
- active recovery rendering retaining its captured value;
- later renderer work after recovery receiving the adopted value;
- terminal rejection during disposing or disposed lifecycle;
- absence of Accessibility imports or browser-observation authority in Runtime;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.