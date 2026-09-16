# Host and WordPress Adapter

## Purpose

The host layer connects a page to the canonical CiM runtime without embedding platform logic in publication content.

## Owns

- Host invocation discovery
- WordPress plugin integration
- External asset enqueue
- Experience-ID handoff
- Initialization boundary
- Cross-component construction inputs required by Runtime
- Host-level static fallback when CiM cannot initialize
- Live reduced-motion subscription composition and per-instance unsubscribe ordering
- Host diagnostics for live reduced-motion bridge failures
- WordPress page-scoped reduced-motion source lifetime when the page host creates that shared source
- WordPress per-invocation mount isolation, readiness projection, and page-host teardown ordering

## Does not own

- Engine semantics
- Subject renderer logic
- Accessibility preference-detection semantics
- Accessibility source-level disposal from an individual live Host instance
- Runtime reduced-motion application semantics
- Inline authored JavaScript in publication pages

## Allowed dependencies

May create and configure `CiMInstance` through its public construction and initialization contracts.

May consume narrow Accessibility capabilities needed to configure Runtime without transferring browser-observation authority into Runtime.

May retain a scoped Accessibility unsubscribe function when Host composition owns the corresponding Runtime lifecycle façade.

A WordPress page host may create one shared Accessibility preference source and therefore owns that source's page-level disposal after per-instance Host disposal has begun.

## Prohibited dependencies

Host must not reach Core directly or command Transport, Commentary, or renderers outside Runtime's public seams.

Individual Host instance disposal must not call Accessibility source-level `changes.dispose()` because that source may be shared by multiple compositions.

Executable CiM JavaScript must remain in plugin-owned external assets enqueued through WordPress rather than inline page, shortcode, block, template, or Custom HTML content. The production packaging contract is defined in [`WORDPRESS.md`](WORDPRESS.md).

## Accessibility checkpoint 2: reduced-motion Runtime composition

`createHostCiMInstance()` composes the Accessibility reduced-motion preference with Runtime construction.

The exact Host construction options are:

```text
instanceId
experience
clock
renderer
rendererRoot
reducedMotionPreference
```

`reducedMotionPreference` must be the exact frozen Accessibility capability:

```text
read
```

Host calls `read()` exactly once during Runtime construction. The result must be boolean and is forwarded through Runtime's existing `reducedMotion` option.

The sampled value remains fixed for that Runtime instance. Initialization and later Runtime commands do not resample the preference. A later Host composition samples the capability again and therefore may receive a changed browser preference.

Host checkpoint 2 installs no media-query listener, polling loop, timer, or preference-change subscription. Dynamic adoption of a changed preference by an existing Runtime remains outside this checkpoint.

Host does not query browser globals for reduced motion. Accessibility owns preference observation, Host owns composition, Runtime receives only the sampled boolean, and renderers receive the established Runtime context value.

Malformed, widened, mutable, symbol-extended, accessor-backed, non-function, throwing, or non-boolean preference capability behavior fails composition without selecting a fallback motion policy.

See ADR 0032.

## Accessibility checkpoint 3 compatibility

Accessibility checkpoint 3 may construct a split reduced-motion source with:

```text
preference
changes
```

Host checkpoint 2 consumes only the source's `preference` projection, whose exact frozen surface remains:

```text
read
```

The checkpoint 3 `changes` capability is not part of `createHostCiMInstance()` construction options. Host checkpoint 2 does not subscribe to reduced-motion changes, receive raw browser media-query objects, or change an existing Runtime's sampled `reducedMotion` value.

This preserves the checkpoint 2 construction boundary while Accessibility owns the independent browser preference-change observation lifecycle.

See ADR 0033.

## Accessibility checkpoint 5: Host live reduced-motion lifecycle composition

`createLiveHostCiMInstance()` composes Accessibility checkpoint 3 change observation with Runtime checkpoint 8 adoption through a Host-owned lifecycle façade.

The live factory is asynchronous because any failure after Runtime construction may require Host to unsubscribe, initiate Runtime disposal, and await compensating terminal cleanup before rejecting construction.

The exact live construction options are:

```text
instanceId
experience
clock
renderer
rendererRoot
reducedMotionPreference
reducedMotionChanges
diagnostics
```

`reducedMotionPreference` remains the exact frozen capability:

```text
read
```

`reducedMotionChanges` must be the exact frozen checkpoint 3 capability:

```text
subscribe
dispose
```

Host validates the complete change capability but owns only the scoped frozen unsubscribe function returned by `subscribe()`. Host never calls source-level `dispose()`.

`diagnostics` must be the exact frozen Host capability:

```text
report
```

Live-composition failures use exact frozen Host diagnostic records:

```text
code
component
instanceId
operation
message
```

with `code: CIM-HST-003` and `component: host`. `operation` distinguishes `reduced_motion_adoption` from `reduced_motion_unsubscribe`. Diagnostic-sink failure is isolated from Host and Runtime control flow.

### Construction ordering

Host closes the preference race with this order:

```text
read preference
construct Runtime
validate Runtime public surface
subscribe to changes
validate scoped unsubscribe
re-read preference
adopt the re-read value when it differs from the construction sample
return Host façade
```

The post-subscription read closes the window where the browser preference could change between initial sampling and listener installation. Runtime same-value adoption is inert, so duplicate observation does not create semantic work.

Each later Accessibility change record is validated as exact frozen `{ reducedMotion: boolean }` data and forwarded only to Runtime `adoptReducedMotion(boolean)`. Host does not inspect the adoption result. A callback failure is isolated from the Accessibility source and reported through `CIM-HST-003`.

### Host façade and surface drift

The exact frozen live Host façade is:

```text
identity
read
events
initialize
next
previous
seek
home
end
restart
dispose
pause
play
```

Runtime `adoptReducedMotion` is retained privately by Host composition and is absent from the returned façade and its reachable capability graph.

`src/contracts/runtime-instance.mjs` defines `CIM_INSTANCE_PUBLIC_KEYS`, the exact Runtime public surface contract. The live Host contract asserts that its exposed keys plus its explicitly retained Runtime keys partition that surface exactly. Each constructed Runtime instance is also checked against the shared contract. A later Runtime public-surface change therefore requires an explicit Host exposure decision before the live composition gate can pass.

### Shared source ownership

One Accessibility source may serve multiple live Host compositions. Each composition owns its own returned unsubscribe function. Disposing one composition removes only that subscription. The Accessibility source retains ownership of its native media-query listener and source-level `dispose()` unless a higher-level owner, such as the WordPress page host, created that source and owns its lifetime.

### Disposal ordering

The first Host façade `dispose()` call creates and caches its Host disposal promise before teardown begins. It then synchronously invokes the scoped unsubscribe before calling Runtime `dispose()`. No `await` occurs between the disposal decision and the unsubscribe attempt.

Repeated Host `dispose()` calls return the identical cached promise, including the identical rejection outcome.

An unsubscribe failure is diagnosed but cannot prevent Runtime terminal disposal from being initiated. If Runtime disposal succeeds, Host disposal rejects with the unsubscribe error. If Runtime disposal also rejects, Host returns one `AggregateError` containing both failures with the Runtime failure as the cause.

### Construction rollback and error precedence

If a post-Runtime construction step fails, Host synchronously invokes any acquired unsubscribe, initiates Runtime disposal, and awaits terminal cleanup.

When cleanup succeeds, the original construction error is rethrown by identity. If cleanup also fails, Host throws one `AggregateError` whose first error and `cause` preserve the original construction failure, followed by cleanup failures. Cleanup cannot replace the construction failure as the primary cause.

Runtime receives no Accessibility source, browser media-query object, Host diagnostic capability, or subscription lifetime authority. Accessibility receives no Runtime instance or adoption capability.

See ADR 0035.

## WordPress production checkpoint: live page-host adoption

`createWordPressLiveHost()` connects stable WordPress invocation markup to `createLiveHostCiMInstance()`.

Its exact options are:

```text
document
matchMedia
experienceLoader
rendererResolver
clockFactory
diagnostics
```

Its exact frozen public surface is:

```text
mount
dispose
```

The page host discovers `[data-cim-experience]` roots. `data-cim-experience` is required and non-empty. `data-cim-instance` may supply a unique explicit instance identity; otherwise Host derives a deterministic page-order identity. A descendant `[data-cim-renderer-root]` is used when present; otherwise the invocation root is the renderer root.

The page host creates at most one reduced-motion preference source and shares its narrow capabilities with every live Host instance on that page. Each live instance retains only its scoped subscription cleanup; the page host owns the shared source-level listener because it created the source.

For each invocation the production order is:

```text
load Experience
resolve renderer
create clock
createLiveHostCiMInstance(...)
initialize()
project data-cim-state="ready"
```

Failure projects `data-cim-state="fallback"` and does not stop later roots from attempting to mount. DOM state reports Host availability only; Runtime remains canonical for semantic state.

The exact mount result is frozen data:

```text
{ mounted, fallback }
```

A page with no CiM roots returns `{ mounted: 0, fallback: 0 }` without constructing the reduced-motion source.

WordPress page-host fault ownership is:

```text
CIM-HST-001  Experience load
CIM-HST-002  invalid or unresolvable deep-link target
CIM-HST-003  live per-instance reduced-motion bridge
CIM-HST-004  WordPress page-host mount and page-owned lifecycle
CIM-RND-001  renderer resolution
```

The adapter currently enters through default `initialize()`. ADR 0011 defines targeted entry, and `CIM-ARCHITECTURE.md` defines the external grammar `#cim/{experience-id}/{step-id}` plus the `initial` form. The current page-host adapter does not parse browser location. The packaging/deep-link resolver consumes that existing grammar and passes only a resolved boundary to Runtime through `initialize({ stepId, source: 'deep_link' })`.

Concrete Experience loading, renderer registry contents, browser clock construction, deep-link parsing/resolution, PHP shortcode/block packaging, and external asset enqueue remain deployment bindings around this exact page-host contract. Canonical markup, `wp_enqueue_script()` delivery, and real WordPress-rendered fixture requirements are pinned in [`WORDPRESS.md`](WORDPRESS.md).

See ADR 0036.

## Verification

Checkpoint 2 tests prove:

- exact Host construction options;
- exact frozen `{ read }` reduced-motion capability;
- one preference read per Runtime construction;
- false and true values reach renderer context through Runtime;
- no resampling during initialization or later Runtime commands;
- an existing Runtime retains its construction-time value after a live preference change;
- a newly composed Runtime samples the changed preference;
- malformed capability and Host option shapes fail closed;
- non-boolean and throwing preference reads fail closed;
- architecture and Core-authority boundaries remain intact.

Checkpoint 3 compatibility preserves those same Host tests unchanged: `source.preference` satisfies the exact checkpoint 2 `{ read }` seam, while `source.changes` remains outside static Host construction authority.

Checkpoint 5 tests prove:

- exact live Host option, façade, Runtime public-surface, retained-key, and diagnostic key sets;
- the Host façade is frozen and exposes no reachable `adoptReducedMotion` authority;
- the post-subscription re-read closes the construction race;
- live change adoption affects future renderer contexts without rerendering the stable boundary;
- one Accessibility source can serve two Host compositions and disposing one does not affect the other;
- Host unsubscribe runs synchronously before Runtime disposal settlement;
- source-level Accessibility disposal remains outside Host instance ownership;
- repeated Host disposal returns the identical promise on success and rejection;
- callback failures produce exact frozen `CIM-HST-003` diagnostics and cannot escape through the Accessibility publisher;
- diagnostic-sink failure cannot alter production flow;
- subscription-installation failure triggers compensating Runtime disposal while preserving the original construction failure;
- malformed unsubscribe results are cleaned up when possible;
- unsubscribe failure cannot prevent Runtime terminal settlement;
- live capabilities remain exact, frozen, and least-authority;
- schema, architecture, Core-authority, and Node 20/22 repository gates remain green.

The WordPress production checkpoint adds verification for:

- exact page-host and injected capability surfaces;
- stable markup discovery and deterministic instance identity;
- one shared reduced-motion source across multiple live instances;
- per-root failure isolation and static fallback;
- Experience, Host, and renderer fault namespace ownership;
- initialization and readiness cleanup;
- disposal while Experience loading is pending;
- diagnostic-sink isolation;
- page-shared source teardown failure;
- no-root quiet operation;
- exact cached mount and disposal promises;
- full repository verification on Node 20 and Node 22.