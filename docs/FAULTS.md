# Code in Motion (CiM) Fault Ownership Matrix

Status: Normative v1 fault contract

## 1. Purpose

This document assigns ownership, recovery class, restoration anchor, learner-facing outcome, and stable error-code namespace for faults named by the CiM architecture.

Fault injection belongs to the synthetic harness. Fault handling belongs to the production component that owns the failed operation.

## 2. Error-Code Namespaces

V1 uses stable component or subsystem namespaces:

```text
CIM-HST-*   host / loading / fallback / deep-link resolution / live composition
CIM-EXP-*   experience validation and resolution
CIM-CORE-*  canonical semantic-state operations
CIM-RT-*    runtime orchestration and scheduling
CIM-RND-*   renderer subsystem, including renderer resolution, lifecycle, and settlement
CIM-COM-*   commentary projection
CIM-TRN-*   transport input and mapping
CIM-TEL-*   telemetry/evidence sinks
```

Expected cancellation is not a fault. Renderer cancellation is reported as `renderer.cancelled` rather than `renderer.error`.

`CIM-TRN-*` is reserved for transport input/mapping faults; the initial v1 matrix does not yet assign a transport fault code.

Within the Host subsystem, `CIM-HST-003` identifies failure of the live reduced-motion composition bridge. Exact Host diagnostic records distinguish `reduced_motion_adoption` from `reduced_motion_unsubscribe` through their `operation` field. These diagnostics do not populate Core canonical fault state. A reduced-motion adoption failure leaves the existing Runtime state unchanged. A Host-scoped unsubscribe failure is diagnosed but does not prevent Runtime disposal from being initiated.

`CIM-HST-004` identifies WordPress page-host discovery, invocation, composition, readiness projection, cleanup, and page-owned lifecycle failures. Its exact diagnostic records use the existing Host diagnostic shape and distinguish the failed stage through `operation`. Mount-stage failures leave the affected invocation on static fallback and do not populate Core canonical fault state. Page-host teardown failures are local diagnostics and cannot reverse already-started per-instance Runtime disposal. Renderer resolution remains `CIM-RND-001` even when the WordPress Host invokes the resolver.

Within the renderer subsystem, `CIM-RND-002` identifies failure to acknowledge a disposal-time render abort within the bounded Runtime window, and `CIM-RND-003` identifies failure of `renderer.dispose()` to acknowledge teardown within its bounded Runtime window. Both are terminal-containment diagnostics and do not populate Core canonical fault state. `CIM-RND-001` covers renderer resolution even though Runtime or Host composition invokes the resolver.

## 3. Recovery Classes

### Reject

The requested operation is invalid before mutation. Canonical state remains unchanged or initialization resolves to a defined safe boundary.

### Recover

The operation failed after work began, but Runtime can restore the last committed stable boundary and keep the instance usable.

### Fallback

Normal CiM operation cannot continue. The instance enters `faulted` or fails initialization, and the host exposes the standard static fallback while preserving the surrounding page.

### Ignore stale work

A callback or completion belongs to a superseded transition. It is discarded without changing canonical state and without classifying the condition as a learner-facing fault.

### Local diagnostic

A composition or observation operation fails outside canonical semantic mutation. The owning component records diagnostic evidence and contains the failure locally. Core canonical `error` remains unchanged. Any separately owned terminal operation still proceeds according to its own lifecycle contract.

### Terminal containment

A renderer fails to acknowledge teardown after disposal has begun. Runtime revokes renderer capabilities, records observational renderer fault evidence, completes canonical `disposed` settlement, and ignores any later completion. Terminal-containment diagnostics do not populate Core canonical `error` because disposal is already the terminal lifecycle outcome.

## 4. Canonical Core Fault State

When a runtime session exists, Core's canonical `error` field is either `null` or one frozen record with exactly:

```text
code
component
recoveryClass
```

`code` uses one namespace from §2. `component` must correspond to that namespace. `recoveryClass` is either `recover` or `fallback`.

`reject`, `ignore stale work`, `local diagnostic`, and `terminal containment` do not populate canonical `error`. Their evidence remains observational because they do not represent active Runtime recovery or terminal instance fault state.

Core stores canonical fault state only after the active semantic target has been cancelled or abandoned. `currentStepId` therefore remains the last committed recovery anchor and `targetStepId` is `null` when canonical fault state is recorded.

A `recover` record represents transient active recovery context. It does not by itself force status to `faulted`. Successful restoration clears the matching recoverable record. The event stream preserves the original fault and recovery evidence after canonical error state is cleared.

A `fallback` record atomically enters canonical status `faulted`. Direct status mutation to `faulted` without a matching fallback record is invalid. A recoverable record may be replaced by a fallback record when restoration fails. A fallback record cannot be cleared as recovered or by restart; faulted state may advance only to `disposed`.

A successfully settled restart may clear an active `recover` record while resetting semantic position and reveal state to `initial`.

## 5. V1 Fault Matrix

| Condition | Owning component | Recovery class | Canonical anchor | Learner-facing outcome | Initial code |
|---|---|---|---|---|---|
| Experience load fails | Host / experience loader | Fallback | No runtime session required | Static fallback; page remains usable | `CIM-HST-001` |
| Invalid or unresolvable CiM deep-link target | Host / Runtime deep-link resolver | Reject | `initial` when an experience can be initialized | Diagnostic recorded; experience opens at `initial`; page remains usable | `CIM-HST-002` |
| Live reduced-motion adoption callback or Host-scoped unsubscribe fails | Host live composition | Local diagnostic | Current committed boundary; canonical `disposed` remains authoritative during teardown | Adoption failure leaves current state unchanged; unsubscribe failure cannot block Runtime terminal disposal | `CIM-HST-003` |
| WordPress invocation discovery, invocation shape, composition, initialization, readiness projection, or cleanup fails | Host / WordPress adapter | Fallback | No surviving Runtime session required; any created instance is cleaned before fallback settlement when possible | Affected invocation remains on static fallback; later invocations continue mounting | `CIM-HST-004` |
| WordPress page-owned reduced-motion source or page-host teardown fails | Host / WordPress adapter | Local diagnostic | Per-instance Runtime disposal remains authoritative | Page teardown continues; page-host disposal may reject after already-started instance disposal | `CIM-HST-004` |
| Unsupported schema | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus diagnostic | `CIM-EXP-001` |
| Invalid/incomplete experience | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus validation diagnostic | `CIM-EXP-002` |
| Duplicate step ID | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus duplicate-ID diagnostic | `CIM-EXP-003` |
| Reserved step ID `initial` used by author | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus reserved-ID diagnostic | `CIM-EXP-004` |
| Invalid `dwell_ms` | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus field diagnostic | `CIM-EXP-005` |
| Malformed commentary link / disallowed scheme | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus link diagnostic | `CIM-EXP-006` |
| Unknown renderer identifier | Runtime or Host composition / renderer resolver | Fallback before normal playback | `initial` if Core session exists; otherwise none | Static fallback plus diagnostic | `CIM-RND-001` |
| Renderer fails to acknowledge disposal-time render abort within the bounded Runtime window | Renderer + Runtime coordination | Terminal containment | Last committed boundary | Disposal completes; late renderer completion has no authority | `CIM-RND-002` |
| `renderer.dispose()` fails to acknowledge teardown within the bounded Runtime window | Renderer + Runtime coordination | Terminal containment | Canonical `disposed` state | Event stream closes after timeout evidence; late teardown completion is ignored | `CIM-RND-003` |
| Invalid semantic seek / unknown step | Core validation | Reject | Current committed boundary | No movement; controls remain usable | `CIM-CORE-001` |
| Command received while faulted/disposed | Runtime/Core state gate | Reject | Current committed boundary | No movement; stable rejection evidence | `CIM-RT-001` |
| Renderer throws during destination transition | Renderer | Recover when restoration succeeds | Last committed boundary | Restore previous stable view; remain usable | `CIM-RND-004` |
| Renderer reports incomplete/unstable destination | Renderer | Recover when restoration succeeds | Last committed boundary | Restore previous stable view; remain usable | `CIM-RND-005` |
| Renderer restoration also fails | Renderer + Runtime coordination | Fallback | Last known committed boundary remains evidence only | Instance unavailable/static fallback | `CIM-RND-006` |
| Delayed scheduler callback from current work violates scheduler contract | Runtime scheduler | Recover or Fallback according to effect | Last committed boundary | Stable state preserved or fallback if preservation fails | `CIM-RT-002` |
| Callback/completion belongs to cancelled transition | Runtime correlation gate | Ignore stale work | Current committed boundary | No learner-visible change | `CIM-RT-003` |
| Commentary projection fails after semantic commit | Commentary | Recover if projection can be rebuilt from Core state | Current committed boundary | Rebuild commentary projection or fallback component presentation | `CIM-COM-001` |
| Telemetry sink fails | Telemetry | Recover locally; must not change control flow | Current committed boundary | CiM continues; diagnostic may degrade | `CIM-TEL-001` |

## 6. Ownership Rules

- Core rejects invalid semantic destinations and owns canonical commit/fault status.
- Runtime coordinates transition cancellation, stale-work rejection, restoration requests, status-write requests, terminal-containment timing, and cross-component settlement.
- Renderer owns visual settlement failures and restoration rendering; the renderer subsystem namespace also covers renderer resolution and renderer teardown acknowledgement regardless of which composition layer invokes the resolver.
- Experience validation failures occur before normal playback.
- Host owns page-level fallback after initialization or loading failure, participates in deterministic deep-link fallback, and owns diagnostic containment for its live reduced-motion subscription bridge.
- The WordPress page host owns discovery of stable CiM invocation markup, per-root failure isolation, the page-shared Accessibility source, page-level fallback projection, and page-host lifecycle cleanup.
- A Host-scoped unsubscribe failure cannot prevent Runtime terminal disposal, and an individual live Host composition does not dispose a shared Accessibility source. The WordPress page host may dispose that source because it created and owns the page-scoped source.
- WordPress Host invocation of renderer resolution does not transfer renderer fault ownership to Host; resolution failure remains `CIM-RND-001`.
- Telemetry failure cannot command or stop otherwise healthy runtime behavior unless required evidence is explicitly configured as a test gate in the harness.

## 7. Recovery Evidence

Recoverable production faults must preserve enough evidence to identify:

```text
component
operation
command_id when applicable
transition_id when applicable
current committed boundary
target boundary when applicable
error_code
recovery attempted
recovery outcome
```

A successful recovery does not erase the original fault event.

Local Host live-composition diagnostics must identify the stable Host code, instance identity, failed operation, and message without manufacturing Runtime command, transition, or Core fault evidence.

WordPress page-host `CIM-HST-004` diagnostics must identify the affected instance or page-host identity, failed operation, and message. They do not manufacture Runtime command, transition, or Core fault evidence. Renderer-resolution diagnostics retain `CIM-RND-001` and `component: renderer`.

Terminal-containment evidence must identify the teardown operation, applicable transition identity, stable error code, and bounded acknowledgement interval. A late renderer completion after terminal containment does not create new semantic evidence.

## 8. Harness Requirements

The harness must inject and verify at least:

- invalid or incomplete experience;
- duplicate step ID;
- reserved `initial` step ID;
- invalid dwell;
- unknown renderer identifier;
- invalid seek;
- invalid or unresolvable deep-link target;
- live reduced-motion adoption callback failure;
- Host-scoped reduced-motion unsubscribe failure;
- WordPress duplicate invocation identity;
- WordPress page-shared reduced-motion source construction failure;
- one failed WordPress invocation leaving later invocations mountable;
- WordPress page disposal during pending Experience load;
- WordPress page-shared source teardown failure;
- renderer resolution through the WordPress Host retaining `CIM-RND-001` ownership;
- renderer throw during transition;
- incomplete renderer settlement;
- failed renderer restoration;
- renderer failure to acknowledge disposal-time abort;
- renderer failure to acknowledge `dispose()` teardown;
- delayed current scheduler callback;
- stale cancelled callback;
- experience loading failure.

For each injected fault, expected owner, recovery class, canonical anchor, evidence ordering, error code, and learner-facing outcome must be asserted independently from production recovery logic.