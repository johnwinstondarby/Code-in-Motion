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
2. Runtime builds a frozen `session` projection containing only `read` and `navigation`.
3. Runtime builds a frozen `controls` bundle containing `semanticControl`, `faultControl`, and `statusControl`.
4. `createRuntimeCoreSession(options)` returns the frozen pair `{ session, controls }` directly to the Runtime composition root.
5. The Runtime composition root retains `controls`; peer components receive only the projections appropriate to their role.

This construction has no acquisition window and no module-global grant map. Non-Runtime production code cannot obtain mutation authority by ordinary property lookup on the published `session` projection.

Runtime must not delegate privileged Core authority outside the composition root. Re-exporting controls, returning them from helper APIs, or wrapping privileged methods in renamed callbacks still transfers mutation authority even when the downstream call site contains none of the privileged identifier names.

Repository verification provides defense in depth:

- `tools/check-architecture-boundaries.mjs` preserves the general component dependency graph and the existing `setStatus` checks.
- `tools/check-core-authority.mjs` rejects non-Runtime Core imports, rejects non-Runtime imports of the private Runtime Core-session seam, and rejects privileged Core-control identifiers outside `src/core/` and `src/runtime/`.
- Package subpath aliases are resolved before the authority decision.
- The static gates do not claim to prove semantic non-delegation through a renamed Runtime wrapper; the authority tests record that boundary explicitly.

Shared contracts cannot import production components and cannot contain mutable runtime behavior.

## Consequences

- Transport and Commentary can consume shared vocabulary without importing Core.
- Core retains one canonical semantic state owner.
- Runtime owns the mutation capabilities needed for orchestration.
- Other production components receive shareable projections rather than a mutable Core object.
- A leaked `session` projection does not carry mutation controls.
- Runtime composition does not depend on acquisition ordering.
- Static checks remain a backstop around the structural capability split.
- Composition-root retention is the controlling rule for renamed or wrapped delegation that static identifier scans cannot prove.

## Rejected Alternatives

### Put shared values in Core

Rejected because presentation components would require Core imports for vocabulary.

### Duplicate shared strings across components

Rejected because spelling and version drift would weaken deterministic evidence.

### Share the complete Core object broadly

Rejected because mutation capabilities would remain reachable through ordinary object access and aliasing.

### One-shot WeakMap acquisition

Rejected after focused QA because caller identity was not represented. Whichever Runtime caller acquired first received the controls, and later Runtime composition could fail despite remaining inside the permitted package. Direct construction of `{ session, controls }` gives the composition root an explicit ownership boundary without acquisition order as state.

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
- the Runtime-published `session` projection contains only `read` and `navigation`;
- the Runtime `controls` bundle is exact and frozen;
- faulted and disposed Core state return deterministic command rejection reasons;
- one executable near-miss records that renamed Runtime delegation is outside the static scanners' proof and remains prohibited by the composition-root rule.
