# WordPress Live Host Contract

Status: Production Host composition contract

## Purpose

`wordpress-live-host.mjs` is the production JavaScript composition boundary between stable WordPress page markup and `createLiveHostCiMInstance()`.

It owns page discovery, page-scoped reduced-motion observation, per-root live Host construction, initialization, readiness projection, static fallback preservation, and page teardown ordering.

It does not own Experience storage policy, renderer registry contents, browser-clock implementation, WordPress PHP packaging, asset enqueueing, shortcode/block generation, or URL/fragment syntax.

## Stable Invocation Markup

Minimum invocation:

```html
<div data-cim-experience="git-basic-cycle">
  <!-- Static fallback content may remain here. -->
</div>
```

Optional explicit instance identity:

```html
<div
  data-cim-experience="git-basic-cycle"
  data-cim-instance="chapter-4-git-cycle">
</div>
```

Optional dedicated renderer root:

```html
<div
  data-cim-experience="git-basic-cycle"
  data-cim-instance="chapter-4-git-cycle">
  <div data-cim-renderer-root></div>
  <div class="cim-fallback">Static fallback content.</div>
</div>
```

`data-cim-experience` is required and non-empty. `data-cim-instance` is optional but must be unique when supplied. Without an explicit instance identity, Host derives a deterministic page-order identity.

If `[data-cim-renderer-root]` is absent, the invocation root is the renderer root.

## Host Availability Projection

A root is projected to:

```text
data-cim-state="ready"
```

only after its live Host instance initializes successfully.

Failure or disposal projects:

```text
data-cim-state="fallback"
```

The state attribute reports Host availability only. Runtime canonical state remains inside Runtime.

Server-rendered fallback content is the safe default. WordPress CSS may reveal live content only for `ready` roots and preserve fallback content for all other states.

## Production Capability Boundary

`createWordPressLiveHost()` requires exactly:

```text
document
matchMedia
experienceLoader
rendererResolver
clockFactory
diagnostics
```

Injected capabilities are exact and frozen:

```text
experienceLoader = { load }
rendererResolver = { resolve }
clockFactory = { create }
diagnostics = { report }
```

The page host does not acquire broader loader, renderer-registry, scheduler, logging, WordPress, or browser-global authority through these objects.

## Mount Lifecycle

For each discovered root, Host performs:

```text
load Experience
resolve renderer
create clock
createLiveHostCiMInstance(...)
initialize()
project ready
```

One failed root projects fallback and does not prevent later roots from mounting.

The mount result is exact frozen data:

```text
{ mounted, fallback }
```

`mount()` is single-shot and returns the identical promise on repeated calls.

A page with no CiM roots returns:

```text
{ mounted: 0, fallback: 0 }
```

without creating a reduced-motion source.

## Reduced-Motion Ownership

One WordPress page host creates at most one Accessibility reduced-motion source.

All live instances receive the same source capabilities, but each `createLiveHostCiMInstance()` façade owns only its scoped unsubscribe function. The page host owns source-level `changes.dispose()`.

On page-host disposal:

1. already-mounted live Host façades are told to dispose;
2. each façade synchronously removes its own reduced-motion subscription before Runtime disposal settlement;
3. the page host disposes the shared source-level listener;
4. in-progress mount work is prevented from advancing into a lasting Runtime after the disposal decision;
5. late-created instances are cleaned before they can remain mounted.

`dispose()` is single-shot and returns the identical promise on success or rejection.

## Fault Ownership

The production adapter preserves the normative fault namespaces:

- `CIM-HST-001`: Experience load failure;
- `CIM-HST-002`: reserved for invalid/unresolvable deep-link targets;
- `CIM-HST-003`: live reduced-motion adoption or instance-scoped unsubscribe failure;
- `CIM-HST-004`: WordPress page-host discovery, invocation, composition, readiness projection, cleanup, or page-owned lifecycle failure;
- `CIM-RND-001`: renderer resolution failure, even when Host invokes the resolver.

Diagnostic sink failure cannot alter mount, cleanup, fallback, or later-root control flow.

## Entry Target Scope

This checkpoint initializes each WordPress invocation through default Host entry:

```text
initialize()
```

ADR 0011 remains the targeted-entry contract:

```text
initialize({ stepId, source: 'deep_link' })
```

The repository does not yet define WordPress URL or fragment syntax for resolving that target. The parser/resolver and its `CIM-HST-002` failure path remain a separate Host deployment checkpoint. No URL syntax is inferred by this adapter.

## Deployment Boundary

A WordPress PHP plugin or browser bootstrap can bind concrete implementations of the four injected capabilities and enqueue the CiM JavaScript/CSS assets. That packaging layer must preserve this module's exact capability and markup contracts rather than embedding Runtime policy in shortcode or template code.

See ADR 0036 for the accepted architecture decision.
