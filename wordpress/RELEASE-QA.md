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

## R8 browser E2E split

R8 is intentionally split into two evidence gates rather than introducing a test-only browser authority surface.

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

The current WordPress page Host exposes only `mount()` and `dispose()`. It does not expose a learner/browser navigation authority surface. R8b therefore remains open until a production transport/control surface exists.

A test-only global, direct Runtime import, or alternate Host composition does not qualify as R8b evidence.
