# ADR 0030: Commentary Scroll Follow Binding

Status: Accepted

Date: 2026-09-16

## Context

Commentary checkpoint 4 defines headless follow, suspension, and newer-steps policy without browser geometry. The learner-facing surface still needs to translate actual scroll position into that policy, keep newly revealed Commentary in view while following, and offer a native way to return to newer entries after the learner scrolls away.

That DOM behavior can remain mechanical if scroll geometry never gains semantic navigation or reveal authority.

## Decision

1. Commentary checkpoint 5 is a native DOM scroll/follow binding over checkpoint 4.

2. Construction receives exactly:

```text
viewport
indicator
follow
newerStepsLabel
```

`follow` is the exact frozen checkpoint 4 surface:

```text
read
suspend
resume
```

The binding receives no Runtime, Transport, semantic navigation, Commentary presentation, renderer, or event-emission surface.

3. `viewport` supplies only native scroll geometry and listener mechanics required by this checkpoint. `indicator` is a native `button[type="button"]` used to return to newer Commentary.

4. The exact frozen public surface is:

```text
refresh
dispose
```

5. The binding installs exactly one `scroll` listener on the Commentary viewport and one native `click` listener on the newer-steps button. It installs no pointer-drag or synthetic keyboard listeners.

6. Bottom detection uses native viewport geometry:

```text
maxScrollTop = max(0, scrollHeight - clientHeight)
atEnd = scrollTop >= maxScrollTop - 1 CSS pixel
```

The one-CSS-pixel tolerance accommodates fractional browser layout values without adding a larger heuristic zone.

7. Scrolling away from the bottom while checkpoint 4 is following calls `suspend()`.

8. Manually returning to the bottom while checkpoint 4 is suspended calls `resume()`. Returning to the newest position is therefore an explicit learner action that restores follow mode.

9. A newly revealed Commentary frontier while suspended never moves the viewport. `refresh()` exposes the native newer-steps button through checkpoint 4 `newerStepsAvailable` state.

10. Activating the newer-steps button first scrolls the viewport to the current bottom and only then calls `resume()`. If scrolling fails, follow remains suspended.

11. While already following, `refresh()` scrolls to the bottom once for each new `latestVisibleStepId`. Repeated refreshes of the same latest semantic entry do not issue duplicate scroll operations.

12. Scrolling uses immediate native behavior:

```text
behavior = auto
```

Checkpoint 5 does not introduce smooth scrolling or a reduced-motion policy. Those concerns remain available to the shared accessibility layer or a later presentation decision.

13. The newer-steps control receives its learner-facing name through native button `textContent`. Checkpoint 5 does not synthesize keyboard activation.

14. Malformed checkpoint 4 state or invalid scroll geometry fails closed before follow-policy mutation. A failed autoscroll does not alter checkpoint 4 follow state.

15. Indicator projection is transactional for the fields owned by checkpoint 5. Partial listener installation is rolled back. Disposal removes only the two listeners installed by this binding, is idempotent after success, and remains retryable after a listener-removal failure.

16. Checkpoint 5 does not perform semantic navigation, advance or reset reveal state, normalize Runtime outcomes, or emit semantic events.

## Consequences

The learner can pause Commentary following by scrolling away and restore it either by manually returning to the newest position or by activating the newer-steps button.

New semantic reveal never steals scroll position from a learner who has suspended follow.

Browser scroll geometry remains a presentation input only. It cannot choose semantic destinations or alter Runtime state.

Immediate scrolling keeps motion policy outside this checkpoint and avoids hiding an accessibility decision inside a DOM binding.

## Verification

Checkpoint 5 verification pins:

- exact frozen binding surface;
- exactly one viewport scroll listener and one native indicator click listener;
- one-CSS-pixel bottom tolerance;
- fresh reveal autoscroll while following;
- no duplicate autoscroll for an unchanged latest semantic entry;
- learner scroll-away suspension;
- no autoscroll when newer Commentary arrives while suspended;
- manual return to bottom resuming follow;
- newer-steps activation scrolling first and resuming only after successful scroll;
- native click yielding when already default-prevented;
- immediate `behavior: auto` scroll requests;
- autoscroll failure preserving checkpoint 4 follow policy;
- invalid geometry failing before follow mutation;
- exact frozen checkpoint 4 authority and required learner-facing indicator label;
- malformed follow state failing before DOM or listener mutation;
- partial listener-install rollback;
- scoped, idempotent, retryable disposal;
- absence of semantic navigation, Runtime, Transport, renderer, and semantic event authority;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
