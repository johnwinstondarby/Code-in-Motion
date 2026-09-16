# ADR 0036: WordPress Live Host Adoption

Status: Accepted

Date: 2026-09-16

## Context

ADR 0035 established `createLiveHostCiMInstance()` as the Host-owned lifecycle façade for live reduced-motion adoption. That factory solves one instance. Production WordPress pages may contain zero, one, or multiple CiM invocations, must preserve server-rendered fallback when an invocation cannot mount, and must own browser-global resources at page scope rather than instance scope.

The architecture already assigns discovery, Experience loading, Runtime creation, container selection, reduced-motion observation, and static fallback preservation to the Host/WordPress adapter. A production adapter is therefore required between stable WordPress markup and the live Host factory.

The page-level adapter must keep the existing ownership boundaries intact. It cannot make DOM state canonical, share one Runtime across invocations, dispose a shared Accessibility source from an individual instance, or reinterpret renderer/Runtime semantic outcomes.

## Decision

1. Production WordPress composition is implemented by:

```text
createWordPressLiveHost(options)
```

Its exact frozen public surface is:

```text
mount
dispose
```

2. The exact constructor options are:

```text
document
matchMedia
experienceLoader
rendererResolver
clockFactory
diagnostics
```

The injected production capabilities are exact and frozen:

```text
experienceLoader = { load }
rendererResolver = { resolve }
clockFactory = { create }
diagnostics = { report }
```

This checkpoint defines the page-host composition boundary. Packaging those capabilities in a WordPress PHP plugin or browser bundle is a later deployment step.

3. Stable WordPress invocation markup is discovered through:

```html
<div data-cim-experience="experience-id"></div>
```

`data-cim-experience` is required and must contain a non-empty Experience identity.

4. `data-cim-instance` is optional. When present it supplies the instance identity and must be unique among discovered invocations on the page. When absent, Host derives a deterministic page-order identity from the Experience identity and invocation ordinal.

5. A descendant carrying `data-cim-renderer-root` is the renderer mount root. When no such descendant exists, the invocation root itself is the renderer root.

6. DOM attributes select invocation resources and project Host availability only. They do not determine Runtime semantic command authority or canonical session state.

7. Host creates at most one reduced-motion preference source for one page-host instance. The source is created only when at least one CiM invocation exists.

8. Every mounted CiM invocation is created through `createLiveHostCiMInstance()` using the shared source's exact `{ read }` and `{ subscribe, dispose }` capabilities. Each live Host façade therefore owns only its scoped unsubscribe function, while the WordPress page host owns source-level `changes.dispose()`.

9. A successful invocation follows this order:

```text
load validated frozen Experience
resolve renderer
create clock
create live Host CiM instance
initialize Runtime
project data-cim-state="ready"
record mounted instance for page teardown
```

10. `data-cim-state="ready"` is the only successful page-host state projection introduced by this checkpoint. Failed or disposed invocations project:

```text
data-cim-state="fallback"
```

Static fallback content remains server-owned. WordPress markup and CSS may use the state attribute to expose the live presentation only after successful initialization.

11. Mounting is failure-isolated per root. A failure in one invocation cannot prevent later discovered invocations from attempting to mount. The exact frozen mount result is:

```text
{ mounted, fallback }
```

12. Experience retrieval failure retains `CIM-HST-001`.

13. Renderer resolution retains renderer subsystem ownership with `CIM-RND-001` and `component: renderer`, even though the WordPress Host invokes the resolver.

14. `CIM-HST-002` remains assigned to invalid or unresolvable deep-link entry targets and is not reused for page-host mounting.

15. WordPress page-host discovery, invocation-shape, page-owned Accessibility-source, clock/composition, readiness projection, cleanup, and page-lifecycle failures use `CIM-HST-004`. These records use the established exact diagnostic shape:

```text
code
component
instanceId
operation
message
```

`operation` identifies the failed page-host stage. Diagnostic sink failure is isolated from mounting, fallback projection, Runtime cleanup, and later invocations.

16. `CIM-HST-004` does not manufacture Core canonical error state. A mount-stage failure leaves that invocation on static fallback. If a live Runtime instance was already created, Host attempts its disposal before settling the root as failed.

17. `mount()` is single-shot. Repeated calls return the identical cached promise.

18. `dispose()` is single-shot. Repeated calls return the identical cached promise on success or rejection.

19. Page disposal owns shared-source teardown. For every already-recorded live instance, Host first calls the live façade's `dispose()`. That call synchronously removes the instance-scoped reduced-motion subscription before Runtime disposal settlement. The page host then disposes the shared source-level change listener.

20. Disposal may begin while mounting is still awaiting Experience or renderer work. The page host marks itself disposing immediately, closes any already-created shared reduced-motion source, and prevents later asynchronous completion from advancing into new Runtime work. If a live instance appears after the disposal decision, Host cleans it up before it can remain mounted.

21. Source-level teardown failure is diagnosed by the page host and participates in the page-host disposal rejection. It does not restore command authority or prevent already-started instance disposal from continuing.

22. A page with no CiM roots is a quiet success. Host returns `{ mounted: 0, fallback: 0 }` and does not create a reduced-motion source or native media-query listener.

23. This adapter remains composition code. Experience retrieval policy, renderer registry contents, browser-clock implementation, asset enqueueing, shortcode generation, and WordPress PHP packaging remain separately owned deployment capabilities.

## Consequences

WordPress now has a production JavaScript composition seam from stable page markup to `createLiveHostCiMInstance()` without widening Runtime or Accessibility authority.

Multiple CiM invocations share one browser reduced-motion listener while retaining isolated Runtime sessions and instance-scoped subscriptions.

Static fallback remains the page's safe default. Live state is projected only after successful Runtime initialization.

Fault ownership stays aligned with the existing matrix: Host loading uses `CIM-HST-001`, deep-link rejection keeps `CIM-HST-002`, live instance preference bridging uses `CIM-HST-003`, page-host mounting/lifecycle uses `CIM-HST-004`, and renderer resolution keeps `CIM-RND-001`.

The remaining WordPress work is packaging and deployment: concrete Experience loading, renderer resolution, clock construction, enqueued assets, and shortcode/block markup can bind to this exact adapter without changing its ownership rules.

## Rejected alternatives

### One reduced-motion source per invocation

That would duplicate native media-query listeners and move a page-scoped browser concern into each instance. The shared source already supports independent subscriptions.

### Let each live Host façade dispose the shared source

ADR 0035 explicitly limits each live façade to its scoped unsubscribe authority. Source-level disposal belongs to the page host that created the source.

### Trust DOM state as Runtime state

`data-cim-state` reports Host availability only. Runtime remains the authority for semantic position, target, reveal frontier, playback, faults, and lifecycle.

### Abort the full page mount after one failed invocation

WordPress pages may contain independent CiM experiences. Per-root isolation preserves otherwise healthy invocations and surrounding page content.

### Reuse `CIM-HST-002` for mount failures

`CIM-HST-002` already names deep-link target rejection in the normative fault matrix. Reuse would collapse two distinct Host failure classes under one stable code.

### Reclassify renderer resolution as a Host fault

The fault matrix already assigns renderer resolution to `CIM-RND-001`. Invocation location does not transfer subsystem ownership.

## Verification

Checkpoint verification pins:

- exact frozen WordPress Host surface `{ mount, dispose }`;
- exact constructor key set and exact frozen injected capabilities;
- stable `[data-cim-experience]` discovery;
- optional unique `data-cim-instance` and deterministic generated identity;
- optional `[data-cim-renderer-root]` selection;
- one shared reduced-motion source and native listener across multiple live instances;
- live instance creation through `createLiveHostCiMInstance()`;
- `ready` only after successful initialization;
- static fallback on invocation, load, resolution, composition, initialization, or projection failure;
- one failed root cannot block a later root;
- `CIM-HST-001`, `CIM-HST-004`, and `CIM-RND-001` ownership at their respective boundaries;
- diagnostic sink isolation;
- cleanup after initialization or readiness-projection failure;
- disposal during pending load prevents late Runtime construction;
- page-host source teardown after instance disposal initiation;
- page-host disposal promise identity on success or rejection;
- no-root path creates no Accessibility source;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
