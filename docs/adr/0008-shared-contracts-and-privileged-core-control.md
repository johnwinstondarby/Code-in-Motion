# ADR 0008: Shared Contracts and Privileged Core Control

Status: Accepted for CiM v1

## Context

CiM intentionally prevents presentation and observation components from importing Core directly. Transport and Commentary still need stable shared vocabulary such as canonical status names, reserved boundary identifiers, result/reason codes, event names, and error-code constants.

Placing that vocabulary inside Core would force either duplication or exceptions to the Core dependency fence.

The architecture also requires Runtime to be the only production component that can request activity-status mutation in Core. A text-only rule around `setStatus` is useful as a repository backstop, but ordinary JavaScript aliasing can make a public mutation method easy to reach accidentally if the object carrying that method is shared broadly.

## Decision

CiM v1 adds `src/contracts/` as a dependency-free shared vocabulary layer.

Production components may import shared values from `src/contracts/` without importing one another. `src/contracts/` cannot import production components or contain mutable runtime behavior.

Shared contract candidates include:

```text
canonical status names
reserved boundary identifiers such as initial
command result and reason values
event vocabulary
stable fault/error identifiers
cross-component immutable value shapes
```

Core retains canonical status storage and validation.

Activity-status mutation through `setStatus(nextStatus)` is a **privileged Core control capability**. Runtime is the only production component that receives that capability. Other components receive Runtime projections or dependency-free shared contract values and must not receive a Core object/capability exposing status mutation.

The Core implementation branch must make the privilege structural rather than relying only on naming convention. A factory may, for example, return separate read/semantic and privileged-control capabilities, but the exact JavaScript object names are left to `feat/core-engine` as long as only Runtime receives the status-mutation capability.

The repository architecture checker retains a static `setStatus` rule as defense in depth and must catch ordinary aliasing forms such as destructuring, `.bind()`, and computed-property references outside Runtime.

## Consequences

- Transport can consume status vocabulary without importing Core.
- Commentary and other components can share stable value names without lateral dependencies.
- Core's dependency fence remains absolute rather than accumulating exceptions.
- Status mutation authority is difficult to reach accidentally once Core is implemented.
- Static analysis remains a backstop rather than the sole mechanism enforcing authority.

## Rejected Alternatives

### Put shared values in Core

Rejected because Transport and Commentary would need Core imports solely for vocabulary, weakening the component boundary.

### Duplicate status and result strings in each component

Rejected because spelling and version drift would become likely and conformance evidence would become harder to compare.

### Keep a broadly shared Core object with public `setStatus`

Rejected because ordinary JavaScript aliasing can bypass caller-pattern checks. Authority should be represented by possession of a privileged capability.

### Rely only on the architecture checker

Rejected because source-pattern enforcement is defense in depth, not the canonical runtime security/ownership model.

## Verification

The repository gate must prove:

- production components may import `src/contracts/`;
- `src/contracts/` cannot import production components;
- direct, destructured, bound, and computed `setStatus` references outside Runtime are rejected;
- Runtime use of the privileged status seam is accepted;
- the Core implementation branch exposes status mutation only through a capability retained by Runtime.
