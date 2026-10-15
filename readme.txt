=== Code in Motion ===
Tags: interactive, experience, runtime
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.2.3
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

WordPress host, runtime bindings, and controls for Code in Motion experiences.

== Description ==

Code in Motion supplies the WordPress host, runtime bindings, transport controls, and release packaging required to mount CiM experiences from WordPress content.

Version 0.2.0 adds the complete Console-Explanation Player, learner themes, native command copying and the compatible v2 Git lesson. Engine compatibility is checked before Player construction; older Git Players remain unchanged.

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

= 0.2.3 =
* Show the whole-line emphasis band behind Console text and keep its inset outline clear of the first character.
* Preserve engine 1.0.1, frozen lesson formats, renderer canonical output, learner themes and mobile blocking.
* Known follow-ups: wrap continuation collision; authored phrase-level limn (authoring/v3), author palettes, optional Match device, and authenticated hosting access for scripted rollback.

= 0.2.2 =
* Show in Console lights up the whole command, related output lines or response line after scrolling. Repeat clicks restart the 1.2-second cue even while playback is paused.
* Use theme-aware limn color, steady emphasis for reduced motion, and a quiet focus band afterward. Reserve limn color for learner emphasis instead of keyboard focus.
* Preserve mobile blocking, lesson formats, engine 1.0.1 and renderer canonical output. Authored phrase-level limn remains deferred.
* Known items: wrap continuation collision; authored limn (authoring/v3); author palettes; optional Match device; scripted rollback needs hosting access.

= 0.2.1 =
* Do not load any interactive Player on screens up to 767 CSS pixels or touch-only devices, including landscape phones and iPads. Show a wider-window notice before fetching Player modules or lesson data.
* Preserve desktop and laptop Player behavior, all learner themes, command Copy and engine localis.cim/engine@1.0.1.
* Known items: wrap continuation collision; authored limn deferred (authoring/v3); white shared by keyboard focus and limn; site fonts still require confirmation.

= 0.2.0 =
* Add the Console-Explanation Player with beat navigation, independent pane following, learner themes, authored CLI labels and native command copying.
* Admit the compatible v2 Git Repository Practice lesson under engine 1.0.1 checks. Preserve older Git Players.
* Remove related-line count wording while retaining phase labels, risk guidance and evidence highlighting.
* Preserve frozen authoring/v1; CLI metadata uses authoring/v2, frozen at PR #80 merge. Limn is reserved for authoring/v3.
* Known items: wrap continuation collision; authored limn deferred; white shared by keyboard focus and limn; Copy-button sizing requires live phone verification.

= 0.1.11 =
* Add Console-Explanation Player composition, Commentary, mode-dependent Restart, and atomic presentation admission.
* Add fixed teaching-first pane presentation while retaining legacy composition and the closed v2 experience gate.

= 0.1.10 =
* Assigns a distinct release identity to the RC#1 candidate following release reproducibility hardening.
* Carries the 0.1.9 product scope forward without additional product changes.

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

== Upgrade Notice ==

= 0.2.3 =
Console emphasis is easier to read. No lesson or page edits are required. Keep the exact 0.2.2 ZIP for rollback and clear hosting caches after replacement. Mobile blocking is unchanged.

= 0.2.2 =
Show in Console now emphasizes the whole matching line or lines. No lesson or page edits are required. Retain the reviewed 0.2.1 ZIP for rollback and clear WordPress.com caches after replacement. Mobile blocking is unchanged.

= 0.2.1 =
Upgrade from 0.2.0 or 0.1.10. Retain the exact 0.2.0 ZIP and current page 3227 capture for rollback; keep the 0.1.10 hosting backup as fallback. Mobile shows a wider-window notice. Confirm fonts on desktop.

= 0.2.0 =
Upgrade from live 0.1.10 using the reviewed RC#2 ZIP. Capture page 3227 and retain the 0.1.10 rollback ZIP before installation. The shortcode change to git-repository-practice is a separate cutover. Check site fonts and Copy controls on desktop and a phone after installation.
