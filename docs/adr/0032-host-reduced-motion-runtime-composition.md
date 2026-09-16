# ADR 0032: Host Reduced-Motion Runtime Composition

Status: Accepted

Date: 2026-09-16

## Context

ADR 0031 established a narrow Accessibility capability that observes the learner's browser reduced-motion preference through an exact frozen `{ read }` surface. Runtime already accepts a boolean `reducedMotion` construction option and includes that value in renderer context. The Host layer owns the CiM initialization boundary and may create and configure `CiMInstance` through its public construction and initialization contracts.

CiM needs a composition rule that connects these existing seams without giving Runtime browser-preference authority or giving Accessibility Runtime authority. The rule must also state whether a preference change after Runtime construction affects an already-running instance.

## Decision

1. Host owns reduced-motion composition into Runtime construction.

2. Host checkpoint 2 provides `createHostCiMInstance()` as the Runtime construction seam for this composition.

3. Construction receives exactly:

```text
instanceId
experience
clock
renderer
rendererRoot
reducedMotionPreference
```

4. `reducedMotionPreference` must be the exact frozen plain Accessibility capability:

```text
read
```

Widened, symbol-extended, mutable, accessor-backed, or non-function capability shapes are rejected.

5. Host calls `reducedMotionPreference.read()` exactly once during `createHostCiMInstance()`.

6. The sampled value must be boolean. A non-boolean result or a thrown preference read fails composition rather than selecting a fallback motion policy.

7. Host passes the sampled boolean through the existing Runtime construction option:

```text
reducedMotion
```

No Renderer Interface change is introduced.

8. The sampled value is fixed for the lifetime of that Runtime instance. Host does not resample the Accessibility capability during initialization, navigation, playback, restart, renderer recovery, or disposal.

9. A later Runtime construction samples the preference again. A platform preference change can therefore affect newly composed instances without mutating an existing instance.

10. Host checkpoint 2 installs no media-query listener, polling loop, timer, preference-change subscription, or new disposal authority.

11. Host does not obtain the preference through `window.matchMedia` or another browser global. Browser preference observation remains encapsulated by the Accessibility capability established in ADR 0031.

12. Runtime does not import Accessibility and does not receive the live preference capability. Runtime receives only the sampled boolean.

13. Accessibility does not import, construct, initialize, command, or dispose Runtime.

14. Dynamic adoption of a changed reduced-motion preference by an already-running Runtime remains a separate lifecycle decision and requires an explicit later contract.

## Consequences

Dependency direction remains explicit: Accessibility observes platform preference, Host composes components, Runtime owns session and transition behavior, and renderers receive the established boolean context value.

Each Runtime instance has one deterministic reduced-motion value for its lifetime. Renderer behavior cannot change midway through a transition because the browser preference changed outside Runtime.

A page that creates another CiM instance after the platform preference changes receives the new value through a fresh Host composition.

Future dynamic preference support cannot be added by silently resampling the existing capability. It must define timing, transition, renderer, and lifecycle semantics explicitly.

## Rejected alternatives

### Runtime reads browser preference directly

This would give Runtime browser-global and accessibility-observation authority that belongs outside the semantic engine.

### Runtime receives the live Accessibility capability

This would create a Runtime dependency on an Accessibility-owned observation interface and leave the resampling moment undefined.

### Renderers read browser preference directly

This would permit renderer-specific motion policy and could produce inconsistent behavior across renderers.

### Host subscribes to media-query changes in checkpoint 2

This would introduce listener ownership and mid-session mutation policy before CiM defines when an active Runtime may adopt a changed preference.

## Verification

Checkpoint 2 verification pins:

- exact Host construction options;
- exact frozen `{ read }` reduced-motion capability;
- one preference read during Runtime construction;
- false and true values forwarded through Runtime into renderer context;
- no resampling during Runtime initialization or later commands;
- an existing Runtime retaining its construction-time value after a live preference change;
- a later Runtime construction sampling the changed preference;
- widened, symbol-extended, mutable, accessor-backed, and non-function capabilities failing closed;
- non-boolean and throwing preference reads failing closed;
- descriptor-safe Host option validation;
- Runtime remaining free of Accessibility imports;
- Accessibility remaining free of Runtime imports;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
