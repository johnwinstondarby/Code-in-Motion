# Code in Motion Renderer Contract

Status: Normative v1 renderer-interface contract

## 1. Purpose

This document defines the v1 renderer lifecycle, renderer input surface, capability boundaries, transition-scoped timing, cancellation, immutability, conformance surface, and canonical-render evidence required by Code in Motion.

It narrows the renderer contract described in `CIM-SPEC.md` §10 and must be kept aligned with that section before renderer implementation merges.

## 2. Lifecycle

A v1 renderer implements:

```text
mount(context)
render(state, context)
dispose()
```

`state` is the complete non-null destination state for the requested semantic boundary.

The renderer does not receive a live `CiMInstance`, Core object, Runtime object, transport object, commentary object, telemetry sink, host adapter, or harness object.

## 3. Exact Render Context

Every call to `render(state, context)` receives a frozen context object with exactly these ten own enumerable keys:

```text
animate
fromState
fromStepId
stepId
rendererConfig
stepRendererConfig
transitionId
abortSignal
clock
reducedMotion
```

No v1 implementation may omit one of these keys or add another key.

### 3.1 Field values

- `animate`: required boolean.
- `fromState`: complete prior subject state only for a true animated continuity transition; otherwise exactly `null`.
- `fromStepId`: prior semantic boundary ID only when `fromState` is supplied; otherwise exactly `null`.
- `stepId`: required destination semantic boundary ID, including `initial`.
- `rendererConfig`: experience-level renderer configuration object as validated and frozen, or exactly `null` when absent.
- `stepRendererConfig`: destination-step renderer configuration object as validated and frozen, or exactly `null` when absent or when the destination is `initial`.
- `transitionId`: required transition correlation identity for the render request.
- `abortSignal`: required frozen read-only abort facade defined in §5.
- `clock`: required transition-scoped renderer clock facade defined in §6.
- `reducedMotion`: required boolean.

Direct seek, recovery restoration, reverse absolute navigation, deep-link initialization, and other non-animated absolute arrivals use `fromState: null` and `fromStepId: null` even when a previously committed semantic boundary exists. This prevents a renderer from accidentally constructing a delta path for an operation whose contract is absolute settlement.

## 4. Renderer Configuration Ownership

Runtime does not merge renderer configuration.

Experience-level and step-level renderer configuration are passed separately through `rendererConfig` and `stepRendererConfig`. The selected renderer owns any documented precedence rule between them.

Core and Runtime do not inspect, merge, normalize, or derive semantic behavior from renderer configuration contents.

## 5. Read-Only Abort Facade

A renderer does not receive a native `AbortSignal`.

The v1 renderer-facing abort facade is a frozen read-only object with exactly these own enumerable keys:

```text
aborted
reason
onAbort
```

Rules:

- `aborted` is a read-only boolean snapshot/projection of transition cancellation state.
- `reason` is a read-only cancellation reason value or `null` while active.
- `onAbort(fn)` registers one renderer callback and returns an opaque unsubscribe handle or function defined by the implementation contract.
- the renderer cannot dispatch, trigger, clear, replace, or otherwise control cancellation state.
- no native event-dispatch method is reachable through the facade.

An honored abort causes the active render to reject with the distinguished renderer-cancellation outcome required by `CIM-SPEC.md` §10.2. Expected cancellation is not a renderer fault.

## 6. Transition-Scoped Clock Facade

The renderer does not receive Runtime's scheduler directly.

Each render call receives a facade bound to that render's `transitionId`. The v1 clock facade is frozen and exposes exactly:

```text
now
schedule
cancel
onFrame
```

Semantics:

- `now()` returns virtual CiM time for the renderer transition.
- `schedule(fn, ms)` schedules a callback in virtual CiM time and returns an opaque handle.
- `cancel(handle)` cancels a handle created by that same facade.
- `onFrame(fn)` registers a virtual frame callback and returns an opaque handle cancellable by `cancel(handle)`.

Pause freezes both delayed callbacks and frame callbacks. No renderer animation may use `requestAnimationFrame`, `setTimeout`, `setInterval`, or another wall-clock scheduling path for semantically significant transition progress.

The facade is revoked when the render settles, aborts, or the renderer is disposed. After revocation:

- new scheduling requests are rejected or return an inert handle according to the implementation contract;
- callbacks already queued through that facade perform no renderer-visible work;
- frame callbacks stop;
- stale work cannot mutate output or affect canonical settlement.

This is a renderer-side defense against the stale-callback class represented by `CIM-RT-003`.

## 7. Capability Reachability

Renderer conformance validates capability reachability, not only top-level context keys.

The v1 capability inspector walks the renderer context graph to a maximum of eight object edges from the root context. If another reachable object exists beyond that bound, inspection fails closed rather than leaving part of the graph uninspected.

`Object.prototype`, `Array.prototype`, and `null` are terminal intrinsic prototype boundaries. Any custom prototype between a context value and those intrinsic boundaries is inspected descriptor-by-descriptor.

The capability inspector:

- traverses own properties and custom prototypes;
- reads property descriptors rather than invoking getters;
- fails if an accessor property is encountered outside the two documented read-only abort-state accessors;
- never invokes an unknown getter during inspection;
- fails on any reachable function-valued member except the exact documented methods of `abortSignal` and `clock`;
- rejects reachable live component or authority objects regardless of member names;
- fails if the graph exceeds the eight-edge v1 inspection bound.

The rule is an allowlist of permitted capabilities, not a denylist of suspicious method names.

A required near-miss fixture supplies an innocently named class instance with a prototype method through an otherwise plausible context value and must fail capability inspection. A second fixture supplies an accessor with a side effect and must prove the inspector rejects it without invoking the getter.

## 8. Immutability

Validated experience data is deep-frozen once at the ingestion boundary before it reaches Runtime or a renderer. This includes:

- `initial_state`;
- each `steps[].state`;
- experience-level `renderer_config`;
- step-level `renderer_config`;
- commentary and structured link data.

The render context object is frozen before delivery.

A renderer that needs mutable working data creates a private copy. It does not mutate shared experience data or renderer context.

Conformance retains an independent before/after snapshot assertion so immutability has both an enforcement mechanism and an external proof.

## 9. Absolute-State Settlement

For one semantic destination state, the following arrival paths must settle to canonically equivalent output:

```text
sequential animated playback
direct non-animated seek
reverse absolute navigation
restart then seek
recovery restoration
reduced-motion arrival
deterministic replay-equivalent arrival
```

`animate:true` may change the path to settlement. It does not change the stable destination output.

## 10. Conformance Surface

A conforming v1 renderer exposes inspectable DOM or SVG beneath the renderer root assigned at mount.

The renderer root is the conformance boundary. Stable comparison occurs only after the render promise resolves successfully.

Canvas, WebGL, or another opaque drawing surface requires a later versioned conformance contract.

## 11. Canonicalization and Evidence

The harness owns canonicalization. A renderer cannot provide or alter its own digest rules.

The v1 DOM/SVG canonicalizer has a versioned identity. The initial identifier is:

```text
cim-dom-svg/v1
```

Renderer evidence records at least:

```text
render_digest
canonicalizer_id
```

A change to canonicalization semantics requires a new `canonicalizer_id`. Existing evidence is never silently reinterpreted under a changed normalization policy.

The v1 normalization allowlist is explicit and narrow. It may normalize only documented representation details that carry no instructional meaning, including:

- attribute ordering;
- approved insignificant serialization whitespace;
- generated identifier substitution where the identifier has been declared non-semantic;
- approved accessibility bookkeeping that is known to vary without changing instructional output.

All other DOM/SVG differences remain significant unless a later canonicalizer version says otherwise.

Evidence comparison rules:

- same `canonicalizer_id` plus different `render_digest` indicates a possible renderer-output difference;
- different `canonicalizer_id` means the digests are not directly comparable;
- same `canonicalizer_id` plus same `render_digest` proves canonical output equivalence for that evidence surface.

## 12. Required Conformance Tests

The renderer-interface branch must include executable tests proving at least:

1. the render context has exactly the ten required keys;
2. an extra context key fails;
3. direct absolute arrivals use `fromState: null` and `fromStepId: null`;
4. experience and step renderer configuration remain separate;
5. context and validated experience data are immutable;
6. a nested/prototype function capability outside the approved facades fails inspection;
7. unknown getters are detected without invocation;
8. the abort facade exposes only its documented read-only surface;
9. the renderer cannot initiate cancellation;
10. the clock facade exposes exactly `now`, `schedule`, `cancel`, and `onFrame`;
11. paused transitions emit no delayed or frame callbacks;
12. settled, aborted, and disposed transitions revoke clock authority;
13. stale scheduled work cannot mutate renderer output after revocation;
14. expected abort rejection is distinguished from renderer failure;
15. direct, animated, reverse, restoration, reduced-motion, and replay-equivalent arrivals canonicalize identically;
16. evidence records `render_digest` with `canonicalizer_id`;
17. every new renderer-interface rule includes a near-miss test demonstrating the plausible accidental violation;
18. capability inspection fails closed when a reachable graph exceeds the eight-edge v1 bound.

## 13. Dependency Boundary

Renderer-interface production code may depend only on dependency-free shared contracts and explicitly approved renderer utilities.

It must not import Runtime, Core, transport, commentary, host, telemetry implementation, harness implementation, or another subject renderer.

Runtime constructs renderer context and capability facades. Renderers consume them without gaining semantic control authority.
