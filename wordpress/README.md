# Code in Motion WordPress plugin

This directory contains the WordPress host and management surface for Code in Motion.

## Deployment shape

The repository root is the development plugin mount. Deterministic release packaging creates the standalone installable ZIP defined by `wordpress/RELEASE-TREE.md`.

The root plugin entry delegates to `wordpress/code-in-motion.php`. That implementation owns front-end enqueueing and shortcode registration and loads `wordpress/admin-console.php` for the read-only administration inventory/status surface.

## Admin Console

WordPress administrators with `manage_options` receive a top-level **Code in Motion** administration page at slug `code-in-motion`.

R31 keeps this surface read-only. It reports plugin/environment identity and the canonical R30 registry-backed Experience deployment inventory. It does not store settings, mutate the registry, validate Runtime semantics, install renderers, compile `.cim` source, or expose management REST/AJAX actions.

## Shortcode

```text
[cim experience="synthetic-wordpress"]
```

Optional explicit instance identity:

```text
[cim experience="synthetic-wordpress" instance="example-one"]
```

Enclosed content is retained as static fallback content:

```text
[cim experience="synthetic-wordpress"]Static fallback content.[/cim]
```

The shortcode emits one canonical `.cim[data-cim-experience]` invocation root, an optional `data-cim-instance` on that root, a descendant `data-cim-renderer-root`, and sanitized fallback content.

## Asset path

`code-in-motion.php` enqueues `assets/bootstrap.js` and `assets/cim.css` through `wp_enqueue_script()` and `wp_enqueue_style()`. The external bootstrap loads the module entry. No executable CiM source is emitted into shortcode or Admin Console content or through WordPress inline-script APIs.

## Verification boundary

`npm run check:wordpress-packaging` enforces the external-asset rule, the R31 administration boundary, and the required WordPress packaging baseline.

Floor QA exercises the repository-mounted administration inventory. Browser E2E exercises the installed release ZIP and confirms registered Experience deployment status from the version-bearing release tree.
