# ADR 0023: Same-Boundary Navigation Consistency

Status: Accepted

Date: 2026-09-16

## Context

ADR 0012 established `no_change / already_at_boundary` for a stable `seek()` whose destination equals the committed semantic boundary. That path prevents redundant renderer and transition work for scrub release or marker activation on the current boundary.

`home()` and `end()` still resolved `success` even when their fixed destination already equaled the committed boundary. Runtime therefore allocated a transition and renderer settlement for learner intent that produced no semantic movement. Commentary is about to consume reveal and semantic evidence, so these redundant settlements should be removed before Commentary depends on the event stream.

`restart()` is different. It may reset the monotonic reveal frontier or clear recoverable restart state while the committed boundary is already `initial`. Boundary identity alone therefore cannot classify Restart as a no-op.

## Decision

1. A stable `home()` at `initial` resolves:

```text
result = no_change
reason = already_at_boundary
fromStepId = initial
toStepId = initial
```

2. A stable `end()` at the final authored boundary resolves the same `no_change / already_at_boundary` shape using the final boundary ID.

3. Same-boundary `seek()` remains governed by ADR 0012. Marker activation and scrub release on the current step therefore share the same quiet resolution through their existing `seek()` mapping.

4. Runtime accepts these `no_change` outcomes and emits command acceptance evidence only. It allocates no transition, performs no renderer work, emits no renderer settlement, emits no transition settlement, and emits no semantic step-change event.

5. `next()` at the final boundary retains reason `at_end`, and `previous()` at `initial` retains reason `at_start`. Those commands describe directional boundary exhaustion rather than an explicitly requested fixed destination.

6. `restart()` remains a `success` path even when invoked at `initial`. Restart is a semantic reset operation, not merely fixed-destination navigation, and may reset reveal-frontier or recoverable state.

7. Transport remains policy-free. It forwards Home, End, marker, and scrub learner intent exactly once and returns the Runtime outcome unchanged.

## Consequences

Commentary and later harness consumers see no fabricated transition-settlement sequence for fixed-destination learner intent that does not move semantic position.

The `already_at_boundary` reason now consistently describes explicit navigation to the currently committed boundary while preserving `at_start`, `at_end`, and Restart reset semantics as distinct cases.

## Verification

Verification pins:

- Core `home()` at `initial` returns `no_change / already_at_boundary`;
- Core `end()` at the final boundary returns `no_change / already_at_boundary`;
- Runtime performs no renderer or transition work for either case;
- marker activation on the current authored step follows the existing quiet same-boundary `seek()` path;
- Restart at `initial` remains a successful semantic reset path;
- repository schema, architecture, Core-authority, and full test gates remain green on Node 20 and Node 22.
