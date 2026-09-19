# WordPress packaging checkpoint #1

This directory contains the smallest deployable WordPress slice for Issue #6.

## Deployment shape

For this checkpoint, install the repository directory itself beneath `wp-content/plugins/`. WordPress discovers `wordpress/code-in-motion.php` as the plugin entry while the browser module graph imports the existing production modules from the repository `src/` tree.

The release ZIP layout and Admin Console are outside this checkpoint.

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

`code-in-motion.php` enqueues `assets/bootstrap.js` and `assets/cim.css` through `wp_enqueue_script()` and `wp_enqueue_style()`. The external bootstrap loads the module entry. No executable CiM source is emitted into shortcode content or through WordPress inline-script APIs.

The module entry binds the production Experience loader, renderer resolver, browser clock factory, synthetic renderer registry, and `createWordPressLiveHost()`.

## Verification boundary

`npm run check:wordpress-packaging` enforces the external-asset rule and rejects WordPress inline-script/style APIs or literal `<script>` emission in plugin PHP.

The real WordPress rendered/sanitized output fixture required by `src/host/WORDPRESS.md` remains a separate acceptance item. It must be captured from a WordPress installation rather than authored by hand.
