# Accessibility

## Purpose

This directory holds shared accessibility contracts, helpers, and automated support used across CiM components.

## Owns

- Shared focus-management helpers
- Reduced-motion capability interfaces
- Shared ARIA utilities where appropriate
- Accessibility test helpers used by production components
- Cross-component accessibility requirements documented by the platform
- Reduced-motion browser observation source lifetime

## Does not own

- Another component's accessible output
- A separate accessibility DOM layered over inaccessible components
- Canonical semantic state
- Runtime or Core command authority
- Renderer control
- Host subscription composition or Runtime disposal ordering
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

The sampled value is fixed for the lifetime of that Runtime instance under checkpoint 2 alone. Although checkpoint 1 `read()` can observe a changed live media-query value, checkpoint 2 does not resample an existing Runtime. A later Host composition performs a fresh read and may therefore create a new Runtime with the changed value.

Accessibility installs no additional listener and gains no Runtime construction, initialization, command, renderer, event, or disposal authority from this composition. Runtime does not import Accessibility.

See ADR 0032 and the Host component contract.

## Checkpoint 3: reduced-motion preference change observation

Checkpoint 3 adds a live browser preference-change observation seam without changing a running Runtime.

Construction receives exactly:

```text
matchMedia
```

`createReducedMotionPreferenceSource()` calls the injected function exactly once with the canonical reduced-motion query. The returned media-query object must provide a boolean `matches` value and modern `addEventListener` and `removeEventListener` methods.

The exact frozen source surface is:

```text
preference
changes
```

`preference` is the checkpoint 1-compatible exact frozen capability:

```text
read
```

This projection can be supplied directly to Host checkpoint 2 or checkpoint 5.

`changes` is the exact frozen capability:

```text
subscribe
dispose
```

The source installs exactly one native `change` listener. It does not use legacy `addListener` or `removeListener` fallback methods.

A native change notification causes Accessibility to read the current live `matches` value. The browser event payload is not forwarded or used as preference state. A successful observation publishes an exact frozen record:

```text
reducedMotion
```

with shape:

```text
{ reducedMotion: boolean }
```

Subscribers receive only that record. The retained media-query object, raw browser event, injected `matchMedia`, `window`, and `document` remain private.

Each `subscribe(listener)` returns a frozen scoped unsubscribe function. Unsubscribe is idempotent. A subscriber failure is isolated and does not prevent notification of remaining subscribers.

`dispose()` removes only the source-owned native `change` listener and clears subscribers after successful native removal. Successful disposal is idempotent. If native removal throws, the source remains open and disposal can be retried.

Disposing the change-observation surface does not invalidate `preference.read()`. The synchronous preference projection continues to read the retained media-query object's live state.

Listener-installation failure attempts scoped rollback with the same listener identity and preserves the original installation failure. Malformed live `matches` values fail closed before subscriber notification.

Checkpoint 3 does not update Runtime, cancel or replace transitions, alter dwell, change renderer context, emit semantic Runtime events, or decide when a changed preference takes effect for an active CiM session.

Checkpoint 3 contains no Runtime, Core, renderer, Transport, Commentary, semantic-navigation, event-emission, or browser-global authority.

See ADR 0033.

## Checkpoint 4: Runtime reduced-motion adoption boundary

Checkpoint 4 defines how an already-running Runtime accepts a changed reduced-motion value while preserving renderer-context immutability and existing lifecycle semantics.

Runtime exposes:

```text
adoptReducedMotion(reducedMotion)
```

The input must be boolean. Runtime stores the accepted value in its private motion configuration and returns exact frozen data:

```text
{ changed: boolean, reducedMotion: boolean }
```

Each new renderer context samples the latest private value when that render begins. A context already handed to a renderer retains the value it captured at render start.

Preference adoption alone does not rerender a stable boundary, allocate command or transition identity, mutate Core state, emit semantic or playback events, cancel active work, replace paused work, restart dwell, or restart recovery.

During an active or paused transition, the existing renderer task completes under its captured value. During dwell, the authored dwell interval remains unchanged and the following render samples the latest adopted value. During recovery, an already-started restoration render retains its captured value and later work samples the adopted value. Adoption before initialization applies to the initial renderer context.

A disposing or disposed instance rejects adoption. Runtime receives only the boolean value and still does not import Accessibility or receive browser-observation authority.

Checkpoint 4 defines Runtime application semantics only. Connecting checkpoint 3 `changes.subscribe()` to this Runtime seam, including unsubscribe and disposal ordering, belongs to Host checkpoint 5.

See ADR 0034 and the Runtime component contract.

## Checkpoint 5: Host live reduced-motion lifecycle composition

Checkpoint 5 connects the checkpoint 3 source to checkpoint 4 Runtime adoption without transferring source ownership into Host or browser observation into Runtime.

Host live composition receives `source.preference` as the exact frozen `{ read }` capability and `source.changes` as the exact frozen `{ subscribe, dispose }` capability. Host validates the complete change capability but owns only the scoped unsubscribe returned by `subscribe()`.

Host does not call `changes.dispose()`. The Accessibility source may serve multiple Host compositions, so source-level disposal remains with the source owner. Disposing one Host composition removes only that composition's subscriber and leaves the source's native media-query listener and other subscribers active.

Live construction reads the preference, constructs Runtime, subscribes to changes, then reads the preference again. That post-subscription read closes the window where the browser preference could change between initial sampling and listener installation. If the second value differs, Host adopts it before returning the live composition.

Later change records remain exact frozen `{ reducedMotion: boolean }` data. Host forwards only the boolean to Runtime adoption. Accessibility never receives the Runtime instance, Runtime adoption capability, Host diagnostics, or Runtime disposal authority.

Host owns synchronous per-instance unsubscribe ordering before Runtime disposal. Accessibility continues to own native listener installation/removal and source-level disposal semantics.

A Host adoption callback failure does not escape through the Accessibility publisher. Host reports the failure through its own `CIM-HST-003` diagnostic surface. Accessibility observer isolation still ensures one failing Host subscriber cannot prevent notification of other subscribers.

See ADR 0035 and the Host component contract.

## Later checkpoints

Later Accessibility work may define shared focus behavior or component-agnostic ARIA helpers. Each addition must remain a narrow capability and may not take over another component's semantic or accessible output authority.

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
- checkpoint 2 alone does not resample an existing Runtime after a live preference change;
- later Runtime construction observes the changed value through a fresh Host sample;
- malformed or widened capability shapes and invalid read results fail closed;
- Runtime remains free of Accessibility imports and Accessibility remains free of Runtime imports.

Checkpoint 3 tests prove:

- exact frozen `{ preference, changes }` source surface;
- exact frozen checkpoint 1-compatible `{ read }` preference projection;
- exact frozen `{ subscribe, dispose }` change capability;
- one canonical media query and one modern native `change` listener per source;
- no legacy media-query listener fallback is used;
- preference reads remain fresh without issuing another media query;
- subscribers receive exact frozen `{ reducedMotion }` records sourced from live `matches` state rather than raw browser events;
- unsubscribe is scoped, frozen, and idempotent;
- subscriber failures are isolated;
- disposal removes only the owned native listener, closes notifications, and remains retryable after native removal failure;
- preference reads remain usable after change observation is disposed;
- listener-installation failure attempts scoped rollback;
- malformed live preference state fails closed before subscriber notification;
- widened, symbol-extended, accessor-backed, and non-function construction authority fails closed;
- no Runtime, Core, renderer, Transport, Commentary, semantic-command, event-emission, or browser-global authority enters the source.

Checkpoint 4 tests prove:

- exact frozen Runtime adoption result data;
- same-value adoption without lifecycle activity;
- boolean-only input validation;
- pre-initialization adoption reaching initial renderer context;
- stable adoption without rerender, snapshot mutation, or event emission;
- future renderer contexts sampling the latest adopted value;
- active and paused renderer contexts retaining their captured value;
- dwell timing preservation with the following render using the adopted value;
- recovery rendering retaining its captured value while later work uses the adopted value;
- disposing or disposed Runtime rejects adoption;
- Runtime remains free of Accessibility and browser-observation dependencies.

Checkpoint 5 tests prove:

- live Host composition consumes exact frozen checkpoint 1 and checkpoint 3 capabilities;
- the post-subscription read closes the initial sampling race;
- live changes are routed to future Runtime renderer contexts without stable rerender;
- Host exposes no Runtime adoption authority to consumers;
- one source can serve multiple Host compositions independently;
- disposing one Host composition does not remove another subscriber or dispose the source;
- Host unsubscribe occurs synchronously before Runtime disposal settlement;
- callback failures remain isolated and produce Host diagnostics;
- source-level native listener ownership remains in Accessibility.

Repository schema, architecture, Core-authority, and full Node 20/22 verification gates cover all five checkpoints.

Each visual component remains responsible for its own accessible output. Automated conformance tests cover keyboard operation, focus behavior, reduced motion, active-state communication, and fallback presentation.