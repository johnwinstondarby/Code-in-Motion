# ADR 0033: Reduced-Motion Preference Change Observation

Status: Accepted

Date: 2026-09-16

## Context

ADR 0031 established a narrow Accessibility capability for reading the learner's browser reduced-motion preference through an exact frozen `{ read }` surface. ADR 0032 established Host composition of that capability into Runtime construction: Host samples once and Runtime receives only the resulting boolean.

The browser preference can change while a page remains open. CiM needs a production observation seam for that change before it can define any policy for adopting a changed value inside an already-running Runtime.

The observation seam must preserve the existing checkpoint 1 and checkpoint 2 contracts. Host must still be able to receive only `{ read }`, Runtime must remain free of Accessibility dependencies, and browser-owned `MediaQueryList` objects and events must not cross the Accessibility boundary.

## Decision

1. Accessibility checkpoint 3 introduces:

```text
createReducedMotionPreferenceSource({ matchMedia })
```

2. Construction calls the injected `matchMedia` exactly once with the canonical query:

```text
(prefers-reduced-motion: reduce)
```

3. The exact frozen source surface is:

```text
preference
changes
```

4. `preference` is the checkpoint 1-compatible exact frozen capability:

```text
read
```

Its `read()` obtains the current boolean `matches` value from the retained media-query object. The capability can therefore be supplied directly to the checkpoint 2 Host construction seam without widening Host authority.

5. `changes` is the exact frozen observation capability:

```text
subscribe
dispose
```

6. The source requires the retained media-query object to provide modern `addEventListener` and `removeEventListener` methods. Accessibility installs exactly one native `change` listener for the source.

7. Legacy `addListener` and `removeListener` methods are outside this contract. Checkpoint 3 does not maintain a second listener path for older media-query APIs.

8. The native `change` event is notification only. Accessibility does not forward or interpret the raw event payload. On notification it reads the current `MediaQueryList.matches` value and validates that value as boolean.

9. Each successful notification creates an exact frozen record:

```text
reducedMotion
```

with shape:

```text
{ reducedMotion: boolean }
```

10. Subscribers receive only that record. They do not receive the raw browser event, the retained media-query object, `matchMedia`, or browser-global authority.

11. `subscribe(listener)` validates a function subscriber and returns a frozen scoped unsubscribe function. The first successful unsubscribe returns `true`; repeated calls return `false`.

12. Subscriber failures are isolated. One observer throwing does not prevent notification of the remaining observers and cannot alter the browser preference source.

13. `dispose()` removes exactly the source-owned native `change` listener, clears subscribers after successful native removal, and closes future change notification. Successful disposal is idempotent.

14. If native listener removal throws, disposal does not claim success. The source remains open so disposal can be retried.

15. Synchronous `preference.read()` remains usable after change observation is disposed. Disposal owns the listener lifecycle, not the retained preference projection.

16. If listener installation throws, construction attempts scoped rollback with the same native listener identity and preserves the original installation failure.

17. A malformed live `matches` value or a native `matches` read failure fails closed before subscriber notification. Accessibility does not cache or invent a fallback motion value.

18. The source options object remains exact and data-backed. Widened, symbol-extended, accessor-backed, or non-function `matchMedia` authority is rejected.

19. Checkpoint 3 grants no Runtime, Core, renderer, Transport, Commentary, semantic-navigation, event-emission, or browser-global authority.

20. A changed preference does not alter an already-running Runtime in checkpoint 3. Dynamic adoption remains a separate lifecycle and composition decision.

## Consequences

CiM now has a narrow production seam for observing browser reduced-motion changes without changing the checkpoint 1 read contract or checkpoint 2 Host construction contract.

One native browser listener can serve multiple Accessibility observers. Consumers see stable CiM-owned data rather than browser event objects.

Host can continue to construct Runtime from `source.preference` while ignoring `source.changes`. Existing Runtime instances therefore retain the construction-time reduced-motion value established by ADR 0032.

A later dynamic-adoption checkpoint can consume the change capability without receiving the media-query object. That later decision must specify behavior during active transitions, paused transitions, dwell, stable boundaries, disposal, and renderer settlement before it can mutate Runtime motion policy safely.

## Rejected alternatives

### Widen the checkpoint 1 preference capability

Adding `subscribe` or `dispose` to the existing exact `{ read }` surface would break the capability contract already consumed by Host checkpoint 2.

### Pass the MediaQueryList or raw browser event to Host or Runtime

This would transfer browser observation authority across component boundaries and couple downstream policy to browser objects.

### Install one native listener per subscriber

This would duplicate browser listener ownership and make subscription disposal responsible for native listener identity.

### Use legacy `addListener` and `removeListener` fallback

Checkpoint 3 defines one modern event contract rather than carrying two browser listener models.

### Apply the changed preference directly to Runtime

Observation and adoption have different lifecycle responsibilities. Applying a new value during transition, dwell, pause, or recovery requires an explicit Runtime policy that checkpoint 3 does not define.

## Verification

Checkpoint 3 verification pins:

- exact frozen `{ preference, changes }` source surface;
- exact frozen checkpoint 1-compatible `{ read }` preference projection;
- exact frozen `{ subscribe, dispose }` change capability;
- one canonical media query and one modern native `change` listener per source;
- no legacy media-query listener use;
- fresh preference reads without a second media query;
- exact frozen `{ reducedMotion }` change records sourced from live `matches` state;
- raw browser events and media-query objects remain private;
- scoped, frozen, idempotent unsubscribe behavior;
- subscriber failure isolation;
- successful disposal removes only the owned listener and closes notification;
- disposal remains retryable after native removal failure;
- preference reads remain available after change observation disposal;
- listener-installation rollback preserves the original failure;
- malformed live preference state fails closed before notification;
- widened, symbol-extended, accessor-backed, and non-function construction authority is rejected;
- absence of Runtime, Core, renderer, Transport, Commentary, semantic-command, event-emission, and browser-global authority;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
