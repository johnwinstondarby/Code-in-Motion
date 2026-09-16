# Accessibility

## Purpose

This directory holds shared accessibility contracts, helpers, and automated support used across CiM components.

## Owns

- Shared focus-management helpers
- Reduced-motion capability interfaces
- Shared ARIA utilities where appropriate
- Accessibility test helpers used by production components
- Cross-component accessibility requirements documented by the platform

## Does not own

- Another component's accessible output
- A separate accessibility DOM layered over inaccessible components
- Canonical semantic state
- Runtime or Core command authority
- Renderer control
- Feature-specific business logic

## Allowed dependencies

Production components may consume shared accessibility helpers through documented interfaces.

Accessibility helpers may receive browser or platform capabilities by injection. They do not acquire browser-global ownership by reaching through `window` or `document` when a narrower capability suffices.

## Prohibited dependencies

Accessibility code must not reach into private DOM owned by another module to repair semantics after rendering.

Production Accessibility modules must not import Runtime or Core implementation modules.

## Checkpoint 1: reduced-motion preference capability

Checkpoint 1 establishes read-only observation of the learner's browser reduced-motion preference without granting Accessibility lifecycle, Runtime, renderer, or browser-global authority.

Construction receives exactly:

```text
matchMedia
```

`matchMedia` is injected by composition. Checkpoint 1 calls it exactly once with:

```text
(prefers-reduced-motion: reduce)
```

The media-query result must expose a boolean `matches` value.

The exact frozen public surface is:

```text
read
```

Each `read()` obtains the current `matches` value from the retained media-query object. A platform update to a live media-query object can therefore be observed by a later read without reconstructing the capability.

Checkpoint 1 installs no media-query listener, polling loop, timer, or disposal surface. It does not decide when an already-running CiM instance should adopt a changed preference. Dynamic preference-change orchestration remains outside this checkpoint.

Malformed media-query results and non-boolean `matches` values fail closed. Native getter failures propagate rather than silently selecting either reduced or full motion.

The options surface is exact. Widened, symbol-extended, accessor-backed, or non-function `matchMedia` authority is rejected.

Checkpoint 1 contains no Runtime, Core, renderer, Transport, Commentary, semantic-navigation, event-emission, DOM-listener, browser-global, or disposal authority.

See ADR 0031.

## Checkpoint 2: Host reduced-motion composition

Checkpoint 2 connects the checkpoint 1 observation capability to Runtime without widening Accessibility authority.

Host receives the exact frozen `{ read }` capability and samples it exactly once while constructing a `CiMInstance`. Host passes the resulting boolean through Runtime's existing `reducedMotion` construction option. Runtime receives the boolean rather than the live Accessibility capability.

The sampled value is fixed for the lifetime of that Runtime instance. Although checkpoint 1 `read()` can observe a changed live media-query value, checkpoint 2 does not resample an existing Runtime. A later Host composition performs a fresh read and may therefore create a new Runtime with the changed value.

Accessibility installs no additional listener and gains no Runtime construction, initialization, command, renderer, event, or disposal authority from this composition. Runtime does not import Accessibility.

Dynamic adoption of preference changes by an already-running Runtime remains a separate lifecycle decision.

See ADR 0032 and the Host component contract.

## Later checkpoints

Later Accessibility work may define dynamic preference-change policy, shared focus behavior, or component-agnostic ARIA helpers. Each addition must remain a narrow capability and may not take over another component's semantic or accessible output authority.

## Verification

Checkpoint 1 tests prove:

- exact frozen `{ read }` public surface;
- exact injected `{ matchMedia }` construction authority;
- the canonical reduced-motion media query is issued exactly once;
- true and false reduced-motion preference observations;
- fresh reads from the retained live media-query object;
- malformed media-query results and non-boolean `matches` values fail closed;
- native `matches` getter failures propagate without fallback policy;
- widened, symbol-extended, accessor-backed, and non-function options fail closed;
- no media-query event subscription is installed;
- no Runtime, Core, renderer, Transport, Commentary, browser-global, listener, or disposal authority enters the capability.

Checkpoint 2 tests prove:

- Host samples the capability exactly once per Runtime construction;
- Runtime renderer context receives the sampled false or true value;
- existing Runtime instances do not resample after a live preference change;
- later Runtime construction observes the changed value through a fresh Host sample;
- malformed or widened capability shapes and invalid read results fail closed;
- Runtime remains free of Accessibility imports and Accessibility remains free of Runtime imports.

Repository schema, architecture, Core-authority, and full Node 20/22 verification gates cover both checkpoints.

Each visual component remains responsible for its own accessible output. Automated conformance tests cover keyboard operation, focus behavior, reduced motion, active-state communication, and fallback presentation.