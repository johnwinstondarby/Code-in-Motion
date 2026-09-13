# ADR 0008: Shared Contracts and Privileged Core Control

Status: Accepted for CiM v1

## Context

CiM prevents presentation and observation components from importing Core directly. Transport, Commentary, and other components still require dependency-free vocabulary such as canonical status names, boundary identifiers, result/reason codes, event names, and fault identifiers.

The architecture also requires Runtime to be the only production component that receives Core mutation authority. Static source checks are useful as a repository backstop, but a broadly shared object exposing mutation methods would still make accidental authority leakage easy.

## Decision

CiM v1 uses `src/contracts/` as the dependency-free shared vocabulary layer.

Core owns canonical state and constructs separate capabilities for:

```text
read
navigation
semantic mutation
fault mutation
status mutation
```

Runtime is the sole production recipient of the complete Core capability set.

The concrete v1 composition seam is `src/runtime/core-session.mjs`:

1. Runtime creates Core.
2. Runtime publishes a frozen projection containing only `read` and `navigation`.
3. The three mutation capabilities are stored in a private WeakMap.
4. `acquireRuntimeCoreControls(session)` grants the mutation bundle once to Runtime composition code.
5. A second acquisition fails.

Non-Runtime production code cannot obtain mutation authority by ordinary property lookup on the published projection.

Repository verification provides defense in depth:

- `tools/check-architecture-boundaries.mjs` preserves the general component dependency graph and the existing `setStatus` checks.
- `tools/check-core-authority.mjs` rejects non-Runtime Core imports, rejects non-Runtime imports of the private Runtime Core-session seam, and rejects privileged Core-control identifiers outside `src/core/` and `src/runtime/`.
- Package subpath aliases are resolved before the authority decision.

Shared contracts cannot import production components and cannot contain mutable runtime behavior.

## Consequences

- Transport and Commentary can consume shared vocabulary without importing Core.
- Core retains one canonical semantic state owner.
- Runtime owns the mutation capabilities needed for orchestration.
- Other production components receive shareable projections rather than a mutable Core object.
- A leaked Runtime Core-session projection still does not carry mutation controls.
- Static checks remain a backstop around the structural capability split.

## Rejected Alternatives

### Put shared values in Core

Rejected because presentation components would require Core imports for vocabulary.

### Duplicate shared strings across components

Rejected because spelling and version drift would weaken deterministic evidence.

### Share the complete Core object broadly

Rejected because mutation capabilities would remain reachable through ordinary object access and aliasing.

### Rely only on static analysis

Rejected because source-pattern checks are defense in depth rather than the canonical authority model.

## Verification

The repository gate proves:

- production components may import `src/contracts/`;
- `src/contracts/` cannot import production components;
- Runtime may import Core;
- non-Runtime production code cannot import Core;
- non-Runtime production code cannot import `src/runtime/core-session.mjs`;
- privileged Core-control identifiers are rejected outside Core and Runtime;
- the Runtime-published Core projection contains only `read` and `navigation`;
- the Runtime mutation-control grant is exact, frozen, and one-shot;
- faulted and disposed Core state return deterministic command rejection reasons.
