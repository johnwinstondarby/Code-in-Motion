# Code in Motion WordPress Release QA

This file records the WordPress-specific Release QA baseline for Checkpoint #1 and the first CiM Release Candidate.

## Environment authority

WordPress Playground is a POC, reviewer-preview, exploratory-QA, and MCP-agent environment. Playground output is never an authoritative rendering or sanitizer fixture.

Docker-backed `wp-env` is the authoritative WordPress integration environment for shortcode rendering, sanitizer fixtures, compatibility testing, upgrade testing, and Release Candidate installation.

## R1/R2 browser-clock gates

The production WordPress browser clock uses separate source families for delayed work and frame work:

- `schedule()` uses the injected timer source;
- `onFrame()` uses the injected animation-frame source;
- `cancel()` dispatches to the source family that owns the handle;
- each created clock owns an isolated handle namespace;
- `now()` rejects a regressing source value.

Release tests prove that Runtime render-abort acknowledgement and renderer-dispose acknowledgement both reach bounded terminal settlement while animation-frame progress is frozen. Disposal acknowledgement therefore does not depend exclusively on `requestAnimationFrame()` progress.

## R6 baseline

The initial supported WordPress floor is **WordPress 6.5**. The floor environment uses the current 6.5 security/maintenance patch, **WordPress 6.5.10**, with **PHP 7.4**.

The repository-root `.wp-env.json` is the floor configuration. It mounts the repository root as the plugin tree so the current unbundled production modules remain inside the installed plugin directory.

The pinned wp-env tool version for this baseline is **@wordpress/env 11.15.0**.

Start the environment from the repository root with:

```sh
npm run wp-env -- start
```

Stop it with:

```sh
npm run wp-env -- stop
```

The default development URL is `http://localhost:8888`.

## Bootstrap policy

CiM v1 retains the existing classic external WordPress bootstrap:

1. PHP enqueues `wordpress/assets/bootstrap.js` with `wp_enqueue_script()`.
2. `bootstrap.js` dynamically imports `bootstrap-module.mjs`.
3. `bootstrap-module.mjs` composes the production WordPress Host from the unbundled production module tree.

CiM v1 does not depend on `wp_enqueue_script_module()` or `wp_register_script_module()`. WordPress 6.5 is therefore a selected support floor rather than a Script Modules API dependency.

Executable CiM source remains external. The packaging gate continues to reject executable inline CiM source.

## Asset-versioning policy

The WordPress plugin version remains the canonical release version and versions the top-level bootstrap, stylesheet, and Experience URL.

Because static imports inside an unbundled ES-module graph do not inherit the query string from their importing module, the Release artifact must also give the shipped production module tree a **version-bearing physical URL path**. R12 defines the exact directory layout, but the invariant is fixed here:

> No N+1 Release may resolve a production `.mjs` URL that is byte-for-byte address-identical to an N-era module when that module's contents may differ.

This rule is exercised by the R16 warm-browser-cache upgrade test.

## R7 fixture rule

Authoritative shortcode/sanitizer fixtures are generated only from Docker-backed `wp-env`. The fixture provenance records at least:

- WordPress version;
- PHP version;
- CiM commit SHA;
- CiM plugin version;
- wp-env version;
- generation command;
- generation date.

A hand-authored equivalent and Playground-rendered output do not qualify as the Release fixture.

## R8 browser E2E

R8 is complete as two evidence gates. Both use a real Chromium browser against Docker-backed `wp-env` and the production WordPress plugin path.

### R8a — production-path mount

Chromium loads a real `wp-env` WordPress page containing the diagnostic shortcode and proves the shipped path:

```text
WordPress shortcode
→ canonical invocation root
→ external bootstrap.js
→ bootstrap-module.mjs
→ Experience fetch
→ validation / ingestion
→ production WordPress Host
→ Runtime
→ synthetic renderer
```

The browser assertion requires `data-cim-state="ready"`, the expected synthetic initial rendering, the expected production module requests, and no browser console or page errors.

The Playwright version used by this gate is pinned in CI. Browser E2E remains downstream of the authoritative `wp-env` environment.

### R8b — semantic navigation

The production WordPress Host now exposes a root-scoped command projection in addition to `mount()` and `dispose()`:

```text
commands(root)
```

A command port exists only for a successfully mounted invocation root. It is frozen and contains exactly:

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

It exposes no Runtime read surface, event surface, identity object, reduced-motion authority, or disposal authority. The projection is removed synchronously when page-host disposal starts.

The Host does not import Transport. `bootstrap-module.mjs` remains the outer composition root: it retrieves the command-only port, creates the existing Transport controller, and installs the existing scoped keyboard binding through `wordpress/assets/transport-binding.mjs`. That binding gives the invocation root a temporary `tabindex="0"` while active and restores the previous value on disposal.

The authoritative browser proof focuses the real CiM invocation root and sends `ArrowRight`. The production Transport path must advance the synthetic Experience from:

```text
initial / node A
```

to:

```text
step-01 / node B
```

The test also requires the browser to fetch the shipped Transport controller and keyboard-binding modules through the production module graph. No test-only global, direct Runtime import, alternate Host composition, or direct renderer mutation qualifies as R8 evidence.

## R9 same-Experience three-instance isolation

R9 proves that sharing one immutable Experience does not imply shared mutable execution state.

The production browser-binding tests establish the component contracts used by the page proof:

- the WordPress Experience loader validates and ingests one frozen object, shares the same post-ingestion object for repeated and concurrent requests, and performs only one fetch for the shared Experience;
- the renderer resolver performs exact lookup and creates a fresh renderer instance for every resolve;
- the browser clock factory creates independent scheduler instances with isolated handle ownership.

The WordPress page-host integration test composes three invocation roots over one shared frozen Experience reference and requires:

- three successful mounts;
- three distinct renderer instances;
- three distinct clock instances;
- three distinct root-scoped command ports;
- independent semantic navigation, where commands addressed to one instance do not change the renderer state of either sibling;
- page-host disposal to dispose all three renderers exactly once and remove all command projections.

A separate production live-Host-facade test disposes one of three live instances directly, then proves the two sibling façades remain operational and independently navigable before their own disposal. This is the R9 proof of instance-local disposal without widening the WordPress page Host with a per-root disposal API. Root-removal ownership remains R10 scope.

The authoritative Chromium + Docker `wp-env` test renders one real WordPress page containing three shortcodes with explicit instance identities:

```text
r9-one
r9-two
r9-three
```

All three reference `synthetic-wordpress`. Browser evidence requires exactly one network request for `synthetic-wordpress.json`, all three roots to reach `data-cim-state="ready"`, and all three to settle initially at node A.

The learner then navigates only `r9-two` with `ArrowRight`, producing:

```text
r9-one   initial / A
r9-two   step-01 / B
r9-three initial / A
```

The learner then focuses `r9-one` and sends `End`, producing:

```text
r9-one   step-02 / C
r9-two   step-01 / B
r9-three initial / A
```

No browser request failure, console error, or page error is permitted. R9 therefore establishes shared immutable Experience data with independent Runtime, renderer, clock, command, navigation, and disposal state.
