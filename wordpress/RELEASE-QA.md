# Code in Motion WordPress Release QA

This file records the WordPress-specific Release QA baseline for Checkpoint #1 and the first CiM Release Candidate.

## Environment authority

WordPress Playground is a POC, reviewer-preview, exploratory-QA, and MCP-agent environment. Playground output is never an authoritative rendering or sanitizer fixture.

Docker-backed `wp-env` is the authoritative WordPress integration environment for shortcode rendering, sanitizer fixtures, compatibility testing, upgrade testing, and Release Candidate installation.

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
