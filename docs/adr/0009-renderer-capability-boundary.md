# ADR 0009: Renderer Capability Boundary

Status: Accepted

Date: 2026-09-13

## Context

The v1 renderer contract must allow deterministic animation, cancellation, and absolute-state rendering without exposing semantic control authority. A broad runtime context object would make authority leakage difficult to detect and would undermine the dependency and ownership model established by ADR 0008.

## Decision

Renderer input is capability-minimized and exact.

`render(state, context)` receives one frozen ten-key context defined by `docs/RENDERER-CONTRACT.md`. Missing predecessor values use explicit `null`. Experience-level and step-level renderer configuration remain separate.

Renderers receive two live capabilities only:

- a frozen read-only abort facade;
- a transition-scoped clock facade with virtual-time delay and frame scheduling.

The clock facade is revoked on settlement, abort, or disposal. It is the only allowed source of semantically significant renderer timing.

Capability conformance uses an allowlist. Inspection traverses property descriptors and prototypes without invoking unknown getters. Reachable function-valued members are prohibited except for the exact methods of the two approved facades.

Validated experience data is deep-frozen at ingestion. Renderer context is frozen before delivery.

Stable DOM/SVG output is canonicalized by a harness-owned, versioned canonicalizer. Evidence records both `render_digest` and `canonicalizer_id`.

## Consequences

- Renderers cannot receive `CiMInstance`, Core, Runtime, navigation methods, status-control handles, or equivalent authority through context.
- Pause freezes both delayed callbacks and animation-frame callbacks.
- Stale renderer work loses timing authority after transition settlement.
- Renderer configuration precedence remains renderer-owned without Runtime merging opaque data.
- Canonicalizer changes are distinguishable from renderer regressions.
- Exact key-set and near-miss tests make context expansion a deliberate contract change.

## Rejected alternatives

- Passing Runtime's scheduler directly to renderers.
- Passing a native `AbortSignal` with event-dispatch authority.
- Capability checks based on a denylist of suspicious method names.
- Allowing optional context keys.
- Runtime merging experience and step renderer configuration.
- Recording render digests without canonicalizer identity.
