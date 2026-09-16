# ADR 0035: Host Live Reduced-Motion Lifecycle Composition

Status: Accepted

Date: 2026-09-16

## Context

ADR 0031 established the exact frozen reduced-motion preference capability `{ read }`. ADR 0032 established synchronous Host construction that samples that preference once and passes only a boolean into Runtime. ADR 0033 added a split Accessibility source with `{ preference, changes }`, where `changes` exposes `{ subscribe, dispose }`. ADR 0034 added Runtime `adoptReducedMotion(boolean)` and defined how future renderer contexts sample an adopted value without mutating or restarting renderer work already in flight.

Live composition now needs one component to connect Accessibility change observation to Runtime adoption while preserving lifecycle ownership. Runtime rejects `adoptReducedMotion()` once disposal begins. A Host subscription that remains active after Runtime disposal starts could therefore deliver a preference change into a terminal Runtime. Accessibility source-level `changes.dispose()` cannot solve that problem because one source may serve multiple Host compositions.

The existing checkpoint 2 Host constructor returns the raw `CiMInstance`. Returning that same raw instance from live composition would let callers invoke Runtime `dispose()` without giving Host a guaranteed synchronous point to remove its own Accessibility subscription.

## Decision

1. Live reduced-motion composition uses a Host-owned lifecycle façade. Runtime gains no terminal-lifecycle notification solely for Host subscription cleanup.

2. Existing synchronous checkpoint 2 construction remains available and unchanged:

```text
createHostCiMInstance(options)
```

It continues to sample `{ read }` once and return the raw Runtime instance for static reduced-motion composition.

3. Live composition is a separate asynchronous factory:

```text
createLiveHostCiMInstance(options)
```

Its exact options are:

```text
instanceId
experience
clock
renderer
rendererRoot
reducedMotionPreference
reducedMotionChanges
diagnostics
```

4. `reducedMotionPreference` remains the exact frozen Accessibility capability:

```text
read
```

5. `reducedMotionChanges` must be the exact frozen Accessibility checkpoint 3 capability:

```text
subscribe
dispose
```

Host receives that exact capability for structural validation but owns only the scoped unsubscribe function returned by `subscribe()`. Host never calls source-level `changes.dispose()`.

6. `diagnostics` is an exact frozen Host capability:

```text
report
```

Host live-composition diagnostics use exact frozen records with:

```text
code
component
instanceId
operation
message
```

The live-composition diagnostic code is `CIM-HST-003`. `operation` distinguishes at least `reduced_motion_adoption` and `reduced_motion_unsubscribe`. A diagnostic sink failure is isolated and cannot alter Host or Runtime control flow.

7. Live construction closes the read/construct/subscribe race in this order:

```text
read current preference
construct Runtime with that boolean
validate Runtime public surface
subscribe to preference changes
validate the returned scoped unsubscribe
re-read current preference
adopt the re-read value if it differs from the construction sample
return the Host façade
```

The second read occurs after subscription is established. A preference change during construction therefore appears either through the subscription callback, the post-subscription re-read, or both. Runtime same-value adoption is an accepted no-change fact, so duplicate observation cannot create semantic work.

8. Each successful change callback receives only the exact frozen Accessibility record `{ reducedMotion: boolean }`. Host forwards the boolean through Runtime `adoptReducedMotion()` and does not inspect or reinterpret the adoption result.

9. Change-callback failures are isolated from the Accessibility publisher and from other source subscribers. Host reports the failure through `CIM-HST-003` rather than allowing it to escape the callback silently or enter Runtime semantic evidence.

10. The Host live façade is exact and frozen. It exposes the ordinary Runtime learner/session surface but retains `adoptReducedMotion` privately for composition:

```text
identity
read
events
initialize
next
previous
seek
home
end
restart
dispose
pause
play
```

11. Runtime public-surface drift is a hard gate. `src/contracts/runtime-instance.mjs` defines the exact shared `CIM_INSTANCE_PUBLIC_KEYS`. Host explicitly defines the privately retained Runtime key set and verifies that the Host façade plus retained keys partition the Runtime public surface exactly. Runtime instances are also checked against the shared public-surface contract. Adding a Runtime public member therefore requires an explicit Host exposure decision before live composition can pass.

12. `adoptReducedMotion` is the only Runtime public member retained from Host consumers by this checkpoint. The returned façade and its reachable capability graph expose no `adoptReducedMotion` key.

13. One Accessibility source may serve multiple live Host compositions. Each composition owns only its own unsubscribe function. Disposing composition A cannot dispose the shared source, remove composition B's subscription, or prevent B from receiving later preference changes.

14. Host façade `dispose()` owns teardown ordering. On the first call it creates and caches the Host disposal promise before teardown begins, then synchronously invokes its scoped unsubscribe before calling Runtime `dispose()`. No `await` occurs between the decision to dispose and the unsubscribe attempt.

15. Repeated Host `dispose()` calls return the identical cached promise. This applies to both successful disposal and rejection, matching Runtime's single-shot outcome semantics at the Host boundary.

16. An unsubscribe failure is reported with `CIM-HST-003` but does not prevent Runtime terminal disposal from being initiated. If Runtime disposal succeeds, the Host disposal promise rejects with the unsubscribe failure. If Runtime disposal also rejects, Host returns one `AggregateError` containing both failures with the Runtime disposal failure as the cause.

17. Live factory construction is asynchronous so compensating cleanup can complete before construction rejects. If subscription installation, unsubscribe validation, post-subscription re-read, race-closing adoption, or façade construction fails after Runtime exists, Host synchronously invokes any acquired unsubscribe, initiates Runtime disposal, and awaits terminal cleanup.

18. Construction-error precedence is explicit. If compensating cleanup succeeds, the original construction error is rethrown by identity. If cleanup also fails, Host throws one `AggregateError` whose first error and `cause` are the original construction failure, followed by cleanup failures. Cleanup failure cannot replace the construction failure as the primary cause.

19. Runtime remains unaware of Accessibility source lifetime, Host diagnostics, and subscription ownership. Accessibility remains unaware of Runtime adoption and Host lifecycle. Host owns the bridge and its teardown ordering.

## Consequences

Live reduced-motion adoption can remain active for the lifetime of a Host composition without creating a disposal race into terminal Runtime state.

A shared Accessibility source remains independently disposable by its owner and can support multiple CiM instances. Host teardown removes only instance-local observation.

The live factory is asynchronous while the earlier static factory remains synchronous. Callers choosing live adoption must await construction and use the returned Host façade rather than retaining the raw Runtime instance.

The shared Runtime public-surface constant converts façade maintenance from convention into a failing contract when Runtime surface changes are not reflected in Host composition.

Host diagnostics now have a stable code for live reduced-motion bridge failures without placing those failures in Core canonical fault state or Runtime semantic events.

## Rejected alternatives

### Runtime terminal-lifecycle observation seam

Adding a Runtime disposal notification solely so Host can clean up an external subscription would expand Runtime lifecycle semantics across pre-initialization disposal, active teardown, renderer rejection, bounded acknowledgement timeouts, and reentrant disposal. Subscription ownership belongs to Host composition instead.

### Return the raw Runtime instance from live composition

A raw instance exposes `dispose()` directly and lets callers bypass Host-owned unsubscribe ordering. Documentation alone cannot make the lifecycle ordering structural.

### Let Host dispose the Accessibility source

The source may have multiple subscribers and owns one native media-query listener. Per-instance Host disposal has no authority to close that shared source.

### Subscribe without a post-subscription re-read

A preference change between the initial read and listener installation could leave Runtime permanently on the stale construction sample until another browser preference event occurs.

### Swallow live adoption failures

Silent callback failure can leave an accessibility preference unapplied with no operational evidence. Host diagnostics provide a narrow destination without contaminating Runtime semantic evidence.

## Verification

Checkpoint verification pins:

- checkpoint 2 static Host construction remains unchanged;
- exact live construction option set;
- exact frozen `{ read }`, `{ subscribe, dispose }`, and `{ report }` capabilities;
- exact Runtime public-surface contract and explicit Host/private partition;
- exact frozen Host façade with `adoptReducedMotion` absent from its reachable graph;
- initial read, subscription installation, and post-subscription re-read ordering;
- race-closing adoption reaching the initial renderer context;
- live preference changes affecting future renderer contexts without stable rerender;
- one Accessibility source serving multiple independent Host compositions;
- disposal of one composition leaving the other subscription active;
- synchronous unsubscribe before Runtime disposal settlement;
- source-level `changes.dispose()` remaining outside Host instance ownership;
- identical Host disposal promise on success and rejection;
- callback and diagnostic-sink failure isolation;
- exact frozen `CIM-HST-003` diagnostic records;
- subscription-construction rollback and original-error precedence;
- cleanup of a malformed returned unsubscribe when possible;
- unsubscribe failure still allowing Runtime terminal disposal;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
