# Code in Motion WordPress plugin

This directory contains the WordPress host and management surface for Code in Motion.

## Deployment shape

The repository root is the development plugin mount. Deterministic release packaging creates the standalone installable ZIP defined by `wordpress/RELEASE-TREE.md`.

The root plugin entry delegates to `wordpress/code-in-motion.php`. That implementation owns front-end enqueueing, shortcode registration, and canonical motion-policy constants/read semantics, and loads `wordpress/admin-console.php` for administration inventory, status, and the site motion-policy management surface.

## Admin Console

WordPress administrators with `manage_options` receive a top-level **Code in Motion** administration page at slug `code-in-motion`.

R34 Commit B adds one authenticated persistent setting to this surface: `localis_cim_motion_policy`, with exactly `system` and `reduce`. The policy can force reduced motion but cannot force motion against a learner preference. All inventory, health, release metadata, no-network, and Runtime/renderer authority boundaries remain unchanged. Commit B deliberately omits uninstall cleanup so the live lifecycle differential can provide negative-control evidence.

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

`npm run check:wordpress-packaging` enforces the external-asset rule, the R31/R32/R33 administration boundaries, the R34 exact motion-policy persistence allowance, the no-network/update rule, and the required WordPress packaging baseline.

Floor QA exercises repository-source deployment mode, Experience and renderer inventories, static health, release information, and mismatch visibility. Browser E2E exercises the installed release ZIP, confirms release-mode inventories and health, runs the production browser mount path, then deactivates and deletes the plugin and requires the CiM-attributable persistence snapshot to match the pre-install baseline.
