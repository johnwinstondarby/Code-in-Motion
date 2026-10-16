# ADR 0057 — Load the Player only where it is used

Status: proposed for 0.2.4. Scope: WordPress asset loading only, as requested by Johann. Daisy's supplied draft used 0056; that identifier is already assigned to the separate wrap-continuation checkpoint.

## Problem

`wordpress/code-in-motion.php` hooks `localis_cim_enqueue_assets` to `wp_enqueue_scripts` with no condition (line 68), so `bootstrap.js` and `cim.css` load on every front-end page of localis.services. On a desktop, `bootstrap.js` then imports `bootstrap-module.mjs` and its whole module graph whether or not the page contains a Player. The mobile gate only stops this on phones.

Measured on 15 October 2026 against 0.2.3 in production: `/journey-of-a-token/` and `/localis-articles/` contain no `[cim]` shortcode, yet each desktop load fetched 65 Code in Motion files (113 KB encoded). Those requests add network round trips and module evaluation to pages that never use them.

## Decision

Two independent layers. Either one alone removes the module graph from pages without a Player. Together they also cover cases the other cannot see.

### Layer 1: WordPress enqueues only on pages that contain a Player

1. **Register always, enqueue conditionally.** `wp_enqueue_scripts` registers the script and style under the existing handles and arguments (`defer`, `in_footer`, same versions). Registration costs nothing on the page.
2. **Enqueue when the queried page holds the shortcode.** At priority 20 on the same hook, enqueue both handles only when `is_singular()` is true and `has_shortcode( $post->post_content, 'cim' )` finds `[cim]`. This covers the house pattern: a `[cim]` shortcode inside a block, as on page 3227.
3. **Explicit opt-in filter.** Pass that result through `apply_filters( 'localis_cim_should_enqueue', $needs, $post )`. A theme or site plugin can then force loading on a page where the shortcode is not visible in `post_content` (a template, or builder data), or suppress it.
4. **Late safety net in the shortcode.** `localis_cim_shortcode()` enqueues both handles itself before returning markup. That covers shortcodes rendered outside the main post: widgets, excerpts, archives, or Elementor shortcode widgets whose content lives in `_elementor_data`. The script is already footer-loaded and deferred, so late enqueueing still prints it. The late stylesheet prints through WordPress's late-style footer pass; the static fallback content means there is no unstyled-player flash worth guarding against.

Sketch:

```php
function localis_cim_register_assets() {
	wp_register_script( LOCALIS_CIM_SCRIPT_HANDLE, plugin_dir_url( __FILE__ ) . 'assets/bootstrap.js', array(), LOCALIS_CIM_PLUGIN_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_register_style( LOCALIS_CIM_STYLE_HANDLE, plugin_dir_url( __FILE__ ) . 'assets/cim.css', array(), LOCALIS_CIM_PLUGIN_VERSION );
}
add_action( 'wp_enqueue_scripts', 'localis_cim_register_assets', 10 );

function localis_cim_enqueue_now() {
	wp_enqueue_script( LOCALIS_CIM_SCRIPT_HANDLE );
	wp_enqueue_style( LOCALIS_CIM_STYLE_HANDLE );
}

function localis_cim_page_has_player() {
	if ( ! is_singular() ) {
		return false;
	}
	$post = get_post();
	return $post instanceof WP_Post && has_shortcode( $post->post_content, 'cim' );
}

function localis_cim_maybe_enqueue_assets() {
	$post  = is_singular() ? get_post() : null;
	$needs = (bool) apply_filters( 'localis_cim_should_enqueue', localis_cim_page_has_player(), $post );
	if ( $needs ) {
		localis_cim_enqueue_now();
	}
}
add_action( 'wp_enqueue_scripts', 'localis_cim_maybe_enqueue_assets', 20 );

// In localis_cim_shortcode(), once the identifiers validate and before returning markup:
localis_cim_enqueue_now();
```

`localis_cim_project_motion_policy_script_tag` keys on the handle, so it works unchanged.

The explicit filter is applied to the late shortcode path too, with a true default, so suppression remains effective even when an embed renders. Both paths pass the queried post (via `get_queried_object()`) rather than a secondary loop's current post. The shared enqueue helper registers handles defensively for a shortcode invoked before `wp_enqueue_scripts`.

### Layer 2: `bootstrap.js` does nothing when the page has no Player

After the existing mobile gate, and before reading `document.currentScript` or building the module URL, return when `document.querySelector('[data-cim-experience]')` finds nothing. The script is deferred, so the document is parsed by the time this runs. This protects any page where the script is enqueued anyway, for example through the filter or a cached page, and it keeps the mobile gate's order and contract exactly as tested today.

The sketch above illustrates the original proposal; the implementation uses the queried object and honors the opt-out in both paths as clarified above.

## Tests

- **Unit (`node:test`, `vm`, in the style of `wordpress-mobile-player-gate.test.mjs`).** Desktop with no roots: `bootstrap.js` never reads `currentScript` and never calls `import`. Desktop with one root: behavior is unchanged. The mobile tests pass unmodified.
- **WordPress E2E (add to `wordpress-browser-smoke.spec.mjs`).**
  - A page without `[cim]` makes zero requests under `plugins/code-in-motion/` (no `bootstrap.js`, no `cim.css`, no `.mjs`).
  - A page with `[cim]` in a block loads the Player as it does now.
  - A `[cim]` rendered from a widget, or late in the page, still loads through the shortcode safety net.
  - The `localis_cim_should_enqueue` filter can force loading on, and can suppress it.
- **Mutation guard (optional, in `check-wordpress-player-mutations.mjs`).** Reject a build where `wp_enqueue_script` for the Player handle runs unconditionally inside a `wp_enqueue_scripts` callback.
- **Release QA.** Add a short R-document (next number) recording before-and-after request counts on production.

## Acceptance on localis.services after release

- `/journey-of-a-token/`, `/localis-articles/` and the home page load zero Code in Motion files on desktop and on phones.
- `/git-repository-practice/` (page 3227) loads and plays the Player on desktop exactly as in 0.2.3, and shows the desktop notice on phones.
- No change to motion policy, theming, the admin console, lessons, engine identity or authoring formats.

## Out of scope

Bundling or code-splitting the module graph, preloading, and any change to the Player's behavior on pages that use it.
