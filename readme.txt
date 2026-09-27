=== Code in Motion ===
Tags: interactive, experience, runtime
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.9
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

WordPress host, runtime bindings, and controls for Code in Motion experiences.

== Description ==

Code in Motion supplies the WordPress host, runtime bindings, transport controls, and release packaging required to mount CiM experiences from WordPress content.

Version 0.1.9 adds the fixed WordPress instrument-panel presentation and learner-facing transport controls while preserving production playback, keyboard, and reduced-motion behavior.

== Installation ==

1. Install the Code in Motion release ZIP through the WordPress Plugins screen or WP-CLI.
2. Activate Code in Motion.
3. Add the shortcode shown for the required Experience in the Code in Motion Admin Console to WordPress content.
4. Publish or update the content and confirm that the Code in Motion panel appears.

The Code in Motion Admin Console reports the active deployment mode, bootstrap-module presence, Experience registry, renderer inventory, version consistency, Experience deployment status, and the supported shortcode for each registered Experience.

== Frequently Asked Questions ==

= The shortcode shows fallback text instead of the Code in Motion panel. What should I check? =

Open the Code in Motion Admin Console in WordPress and check these items:

1. Under Static health, confirm that Deployment mode is Release, Active module root is Present, Bootstrap module is Present, Experience registry is Available, Renderer inventory is Available, and Plugin version consistency is Consistent.
2. Under Experience inventory, find the Experience used by the shortcode and confirm that its Deployment status is Present (release). Confirm that the shortcode on the page matches the shortcode shown in the inventory.
3. Under Renderer inventory, confirm that the renderer required by the Experience is Registered.

If any of these checks fail, preserve the fallback text and report the failed status together with the Code in Motion version through the project support channel.

== Support ==

Report defects and release issues at https://github.com/johnwinstondarby/Code-in-Motion/issues.

== Changelog ==

= 0.1.9 =
* Adds the fixed WordPress instrument-panel presentation and learner-facing Start, Previous, Play/Pause, Next, and End controls.
* Preserves production playback, keyboard focus, responsive layout, and reduced-motion behavior through the WordPress composition.

= 0.1.8 =
* Composes learner-facing Space play/pause into the exact WordPress production Transport binding.
* Adds browser-level normal-motion versus reduced-motion behavioral proof through the production playback path.

= 0.1.7 =
* Adds host-independent Git renderer presentation with production browser contrast verification.
* Records and gates the exact WordPress Transport composition exposed by the production binding.

= 0.1.6 =
* Adds site reduced-motion policy administration with System preference and Force reduced motion values.
* Establishes the first persistent WordPress host configuration under the R34 lifecycle differential.

= 0.1.5 =
* Adds state-free lifecycle residue verification across install, activation, deactivation, and uninstall.
* Adds canonical release metadata to the read-only WordPress Admin Console.

= 0.1.4 =
* Adds centralized WordPress renderer registration and generated renderer inventory data.

= 0.1.3 =
* Adds the read-only Code in Motion Admin Console and registry-backed Experience deployment status.

= 0.1.2 =
* Adds the canonical Experience deployment registry, generated browser projection, and registry-driven release staging.

= 0.1.1 =
* Adds the Git Basic Cycle experience, shared page-3227 projection, and #cim deep-link entry/navigation.

= 0.1.0 =
* Initial WordPress release with deterministic packaging, upgrade-safe versioned assets, and the synthetic diagnostic Experience.
