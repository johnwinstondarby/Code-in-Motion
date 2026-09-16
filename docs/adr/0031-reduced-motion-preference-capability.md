# ADR 0031: Reduced-Motion Preference Capability

Status: Accepted

Date: 2026-09-16

## Context

The Renderer Interface Contract already carries a `reducedMotion` boolean, and Runtime renderer context validates and forwards that value. The synthetic renderer already settles immediately when reduced motion is true. What CiM lacks is a production browser-preference seam that can obtain the learner's reduced-motion preference without Runtime, Core, Transport, Commentary, or a renderer reaching into browser globals.

The first Accessibility checkpoint needs to establish observation authority without simultaneously deciding dynamic preference-change orchestration.

## Decision

1. Accessibility checkpoint 1 supplies a browser reduced-motion preference capability.

2. Construction receives exactly one injected function:

```text
matchMedia
```

Accessibility does not read `window.matchMedia` directly. Browser-global ownership stays with composition.

3. Construction calls `matchMedia()` exactly once with the canonical media query:

```text
(prefers-reduced-motion: reduce)
```

4. The returned media-query object must expose a boolean `matches` value at construction time.

5. The exact frozen public surface contains only:

```text
read
```

6. Every `read()` obtains the current `matches` value from the retained media-query object and returns that boolean. The value is therefore fresh if the platform updates the live media-query object.

7. Checkpoint 1 installs no `change` listener, legacy media-query listener, polling loop, timer, or disposal surface. It does not decide when an already-running CiM instance adopts a later preference change.

8. A malformed `matchMedia` result, a non-boolean `matches` value, or a native `matches` getter failure fails closed. Accessibility does not silently choose either motion mode as a fallback.

9. The options object is exact and data-backed. Widened, symbol-extended, accessor-backed, or non-function `matchMedia` authority is rejected.

10. The capability contains no Runtime, Core, renderer, Transport, Commentary, DOM-listener, semantic-navigation, event-emission, browser-global, or disposal authority.

11. Existing architecture fences continue to prohibit production Accessibility imports of Runtime and Core implementation modules.

## Consequences

The browser preference is available through a narrow injected capability rather than through browser-global access inside semantic or rendering components.

A composition layer can sample the preference and pass the resulting boolean into the existing Runtime `reducedMotion` option without changing the Renderer Interface Contract.

Dynamic adoption of preference changes during an existing session remains a separate decision. Checkpoint 1 deliberately avoids listener ownership and lifecycle policy so that future work can specify those semantics explicitly.

The capability's fresh `read()` behavior means a later composition policy can observe a changed platform preference without reconstructing the Accessibility capability.

## Verification

Checkpoint 1 verification pins:

- exact frozen `{ read }` capability;
- exact injected `{ matchMedia }` construction authority;
- canonical `(prefers-reduced-motion: reduce)` query issued exactly once;
- false and true reduced-motion observations;
- fresh reads from the retained live media-query object;
- malformed `matchMedia` results failing closed;
- non-boolean initial and later `matches` values failing closed;
- native `matches` getter failures propagating without fallback policy;
- widened, symbol-extended, accessor-backed, and non-function options rejected;
- zero media-query event subscriptions;
- absence of Runtime, Core, renderer, Transport, Commentary, listener, browser-global, and disposal authority;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
