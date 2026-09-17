# WordPress Live Host Contract

Status: Production Host composition contract

## Purpose

`wordpress-live-host.mjs` is the production JavaScript composition boundary between stable WordPress page markup and `createLiveHostCiMInstance()`.

It owns page discovery, page-scoped reduced-motion observation, per-root live Host construction, initialization, readiness projection, root-scoped command-capability projection, static fallback preservation, and page teardown ordering.

It does not own Experience storage policy, renderer registry contents, browser-clock implementation, Transport implementation, WordPress PHP packaging, asset enqueueing, shortcode/block generation, or external URL/fragment parsing.

## Required Markup, Verbatim

The packaging layer must emit one canonical invocation element for each CiM experience. The minimum output is:

```html
<div class="cim" data-cim-experience="git-basic-cycle"></div>
```

The element carrying `data-cim-experience` is the invocation root. `class="cim"` is the stable packaging and styling hook; JavaScript discovery is keyed to `[data-cim-experience]`.

Optional explicit instance identity is emitted on that same invocation root:

```html
<div
  class="cim"
  data-cim-experience="git-basic-cycle"
  data-cim-instance="chapter-4-git-cycle">
</div>
```

Optional dedicated renderer root and static fallback content remain descendants of the invocation root:

```html
<div
  class="cim"
  data-cim-experience="git-basic-cycle"
  data-cim-instance="chapter-4-git-cycle">
  <div data-cim-renderer-root></div>
  <div class="cim-fallback">Static fallback content.</div>
</div>
```

`data-cim-experience` is required and non-empty. `data-cim-instance` is optional but must be unique when supplied. Without an explicit instance identity, Host derives a deterministic page-order identity.

If `[data-cim-renderer-root]` is absent, the invocation root is the renderer root.

WordPress, the block editor, a page builder, or a theme may add outer wrapper elements. Those wrappers must not replace, remove, rename, or relocate the canonical invocation attributes from the invocation root. Content filtering and sanitization must preserve `data-cim-experience`, optional `data-cim-instance`, and optional descendant `data-cim-renderer-root` exactly enough for Host discovery and identity selection.

## Asset Delivery

Executable CiM JavaScript is delivered as external, versioned assets registered and enqueued through `wp_enqueue_script()`. Executable CiM engine, Host, Runtime, renderer, Transport, Commentary, or bootstrap source must not be emitted inside page content, shortcode output, block output, Custom HTML, or other inline `<script>` content. Production CiM code must not depend on `wp_add_inline_script()` for executable engine or adapter source.

CiM presentation CSS is delivered through `wp_enqueue_style()` or an equivalent plugin-owned external stylesheet path.

This requirement keeps executable source outside content-editor and publication transforms. JavaScript operators and source bytes, including `&&`, must reach the browser from the enqueued asset rather than pass through content serialization or text transformation.

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

The returned Host surface is exact and frozen:

```text
mount
commands
dispose
```

`commands(root)` is a capability projection, not a Runtime instance reference. Before successful mount, for a failed or unknown root, and after disposal begins, it returns `null`.

For a successfully mounted root it returns one frozen command-only port with exactly:

```text
play
pause
next
previous
seek
home
end
restart
```

The port exposes no `identity`, `read`, `events`, `initialize`, `adoptReducedMotion`, or `dispose` authority. Host imports no Transport implementation module. The outer composition layer may grant this command-only port to Transport.

## Mount Lifecycle

For each discovered root, Host performs:

```text
load Experience
resolve renderer
create clock
createLiveHostCiMInstance(...)
initialize()
project ready
project command-only capability
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

A root never receives a command capability before successful initialization and readiness projection. If a later construction-stage failure occurs, any provisional command projection is removed before the root settles to fallback.

## Reduced-Motion Ownership

One WordPress page host creates at most one Accessibility reduced-motion source.

All live instances receive the same source capabilities, but each `createLiveHostCiMInstance()` façade owns only its scoped unsubscribe function. The page host owns source-level `changes.dispose()`.

On page-host disposal:

1. command projections are removed synchronously for already-mounted roots;
2. already-mounted live Host façades are told to dispose;
3. each façade synchronously removes its own reduced-motion subscription before Runtime disposal settlement;
4. the page host disposes the shared source-level listener;
5. in-progress mount work is prevented from advancing into a lasting Runtime after the disposal decision;
6. late-created instances are cleaned before they can remain mounted.

`dispose()` is single-shot and returns the identical promise on success or rejection.

## Fault Ownership

The production adapter preserves the normative fault namespaces:

- `CIM-HST-001`: Experience load failure;
- `CIM-HST-002`: invalid or unresolvable deep-link target;
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

`CIM-ARCHITECTURE.md` defines the external deep-link grammar:

```text
#cim/{experience-id}/{step-id}
#cim/{experience-id}/initial
```

The current page-host adapter does not read browser location and therefore does not parse that grammar. The WordPress packaging/deep-link resolver must consume the existing grammar, resolve the Experience and semantic boundary, and pass only the resolved boundary into Runtime through ADR 0011. Invalid or unresolvable targets remain `CIM-HST-002`. WordPress packaging must not create a second platform-specific deep-link grammar.

## WordPress Transport Composition

The WordPress browser bootstrap is the outer composition root for Host and Transport. After `mount()` settles, it discovers the same canonical invocation roots, requests each root's command-only capability with `commands(root)`, and grants that port to the existing Transport controller.

`wordpress/assets/transport-binding.mjs` installs the existing scoped keyboard binding on that invocation root. It temporarily establishes `tabindex="0"` so the root can receive learner keyboard focus, and restores the previous `tabindex` on disposal.

The binding owns no Runtime state and receives no Runtime instance. Arrow keys, Home, and End flow through the existing Transport controller and therefore use Transport command-source evidence rather than Host command-source defaults.

This composition preserves the architecture rule that `src/host/` cannot import `src/transport/`. The WordPress packaging layer may import both because it is the composition boundary that grants capabilities between them.

## Packaging Output Verification

The WordPress packaging checkpoint must verify the output produced by the production shortcode or block implementation after it has passed through the real WordPress rendering and sanitization path.

The fixture used for this gate must be captured from actual production rendering output rather than maintained as a hand-written equivalent of the expected HTML. Verification must prove at least:

- the canonical invocation element remains discoverable through `[data-cim-experience]`;
- `class="cim"` and the non-empty Experience identity survive output processing;
- optional `data-cim-instance` survives unchanged when supplied;
- optional `data-cim-renderer-root` survives as a descendant when emitted;
- editor, theme, or page-builder wrappers do not prevent discovery of the invocation root;
- shortcode/block output contains no executable inline CiM JavaScript;
- external CiM JavaScript is enqueued through the plugin asset path.

A hand-written HTML fixture may test the JavaScript adapter in isolation, but it does not satisfy the packaging-output acceptance gate.

## Deployment Boundary

A WordPress PHP plugin or browser bootstrap binds concrete implementations of the injected capabilities, emits the required invocation markup, resolves the existing deep-link grammar, composes Host with command-only Transport controls, and enqueues the CiM JavaScript/CSS assets. That packaging layer must preserve this module's exact capability and markup contracts rather than embedding Runtime policy in shortcode, block, or template code.

See ADR 0036 for the accepted architecture decision.
