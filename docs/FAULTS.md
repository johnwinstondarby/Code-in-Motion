# Code in Motion (CiM) Fault Ownership Matrix

Status: Normative v1 fault contract

## 1. Purpose

This document assigns ownership, recovery class, restoration anchor, learner-facing outcome, and stable error-code namespace for faults named by the CiM architecture.

Fault injection belongs to the synthetic harness. Fault handling belongs to the production component that owns the failed operation.

## 2. Error-Code Namespaces

V1 uses stable component or subsystem namespaces:

```text
CIM-HST-*   host / loading / fallback / deep-link resolution
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

Within the renderer subsystem, `CIM-RND-002` and `CIM-RND-003` are reserved for later v1 renderer-lifecycle assignments so existing published codes do not need renumbering. `CIM-RND-001` covers renderer resolution even though Runtime composition invokes the resolver.

## 3. Recovery Classes

### Reject

The requested operation is invalid before mutation. Canonical state remains unchanged or initialization resolves to a defined safe boundary.

### Recover

The operation failed after work began, but Runtime can restore the last committed stable boundary and keep the instance usable.

### Fallback

Normal CiM operation cannot continue. The instance enters `faulted` or fails initialization, and the host exposes the standard static fallback while preserving the surrounding page.

### Ignore stale work

A callback or completion belongs to a superseded transition. It is discarded without changing canonical state and without classifying the condition as a learner-facing fault.

## 4. V1 Fault Matrix

| Condition | Owning component | Recovery class | Canonical anchor | Learner-facing outcome | Initial code |
|---|---|---|---|---|---|
| Experience load fails | Host / experience loader | Fallback | No runtime session required | Static fallback; page remains usable | `CIM-HST-001` |
| Invalid or unresolvable CiM deep-link target | Host / Runtime deep-link resolver | Reject | `initial` when an experience can be initialized | Diagnostic recorded; experience opens at `initial`; page remains usable | `CIM-HST-002` |
| Unsupported schema | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus diagnostic | `CIM-EXP-001` |
| Invalid/incomplete experience | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus validation diagnostic | `CIM-EXP-002` |
| Duplicate step ID | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus duplicate-ID diagnostic | `CIM-EXP-003` |
| Reserved step ID `initial` used by author | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus reserved-ID diagnostic | `CIM-EXP-004` |
| Invalid `dwell_ms` | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus field diagnostic | `CIM-EXP-005` |
| Malformed commentary link / disallowed scheme | Experience validator | Fallback before initialization | No runtime session required | Static fallback plus link diagnostic | `CIM-EXP-006` |
| Unknown renderer identifier | Runtime composition / renderer resolver | Fallback before normal playback | `initial` if Core session exists; otherwise none | Static fallback plus diagnostic | `CIM-RND-001` |
| Invalid semantic seek / unknown step | Core validation | Reject | Current committed boundary | No movement; controls remain usable | `CIM-CORE-001` |
| Command received while faulted/disposed | Runtime/Core state gate | Reject | Current committed boundary | No movement; stable rejection evidence | `CIM-RT-001` |
| Renderer throws during destination transition | Renderer | Recover when restoration succeeds | Last committed boundary | Restore previous stable view; remain usable | `CIM-RND-004` |
| Renderer reports incomplete/unstable destination | Renderer | Recover when restoration succeeds | Last committed boundary | Restore previous stable view; remain usable | `CIM-RND-005` |
| Renderer restoration also fails | Renderer + Runtime coordination | Fallback | Last known committed boundary remains evidence only | Instance unavailable/static fallback | `CIM-RND-006` |
| Delayed scheduler callback from current work violates scheduler contract | Runtime scheduler | Recover or Fallback according to effect | Last committed boundary | Stable state preserved or fallback if preservation fails | `CIM-RT-002` |
| Callback/completion belongs to cancelled transition | Runtime correlation gate | Ignore stale work | Current committed boundary | No learner-visible change | `CIM-RT-003` |
| Commentary projection fails after semantic commit | Commentary | Recover if projection can be rebuilt from Core state | Current committed boundary | Rebuild commentary projection or fallback component presentation | `CIM-COM-001` |
| Telemetry sink fails | Telemetry | Recover locally; must not change control flow | Current committed boundary | CiM continues; diagnostic may degrade | `CIM-TEL-001` |

## 5. Ownership Rules

- Core rejects invalid semantic destinations and owns canonical commit/fault status.
- Runtime coordinates transition cancellation, stale-work rejection, restoration requests, status-write requests, and cross-component settlement.
- Renderer owns visual settlement failures and restoration rendering; the renderer subsystem namespace also covers renderer resolution.
- Experience validation failures occur before normal playback.
- Host owns page-level fallback after initialization or loading failure and participates in deterministic deep-link fallback.
- Telemetry failure cannot command or stop otherwise healthy runtime behavior unless required evidence is explicitly configured as a test gate in the harness.

## 6. Recovery Evidence

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

## 7. Harness Requirements

The harness must inject and verify at least:

- invalid or incomplete experience;
- duplicate step ID;
- reserved `initial` step ID;
- invalid dwell;
- unknown renderer identifier;
- invalid seek;
- invalid or unresolvable deep-link target;
- renderer throw during transition;
- incomplete renderer settlement;
- failed renderer restoration;
- delayed current scheduler callback;
- stale cancelled callback;
- experience loading failure.

For each injected fault, expected owner, recovery class, canonical anchor, event ordering, error code, and learner-facing outcome must be asserted independently from production recovery logic.
