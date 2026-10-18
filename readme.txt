=== Code in Motion ===
Tags: interactive, experience, runtime
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Teach code with learner-controlled Console and Explanation lessons, beat navigation, Copy and companion lesson packs.

== Description ==

Code in Motion helps teachers put learner-controlled coding demonstrations on their WordPress sites. The Console displays authored commands and output; the running Explanation connects each beat to its meaning. Play pauses for reading at every completed beat. Learners can navigate, copy commands and select Light, High Contrast or the optional Localis palette. Commands are displayed, never executed.

A three-beat Python starter and the existing Git lessons are included. Teachers create additional lessons with the standalone v1.0 authoring tool and install generated companion lesson-pack plugins, without forking or rebuilding CiM. Lesson data passes schema, engine and identity checks before the Player opens. Phones show a desktop-required notice.

Install and authoring guides are included in the ZIP and at https://github.com/johnwinstondarby/Code-in-Motion/tree/main/docs. Source and GPLv3 fork instructions are at https://github.com/johnwinstondarby/Code-in-Motion. Fork maintainers support their own distributions.

== Installation ==

1. Install the Code in Motion release ZIP through the WordPress Plugins screen or WP-CLI.
2. Activate Code in Motion.
3. Open Code in Motion in the WordPress sidebar. Under Included lessons (bundled lessons) or Pack lessons (your lessons), copy the lesson shortcode into a page’s Shortcode block. Wait for Ready before using a pack lesson.
4. Preview the draft page on a desktop or laptop, check the Player, then publish or update it.

The Code in Motion Admin Console reports the active deployment mode, bootstrap-module presence, Experience registry, renderer inventory, version consistency, Experience deployment status, and the supported shortcode for each registered Experience.

== Frequently Asked Questions ==

= The shortcode shows fallback text instead of the Code in Motion panel. What should I check? =

Open the Code in Motion Admin Console in WordPress and check these items:

1. Expand Support information (Tab to its summary, then Enter or Space). Under Static health, confirm that Deployment mode is Release, Active module root is Present, Bootstrap module is Present, Experience registry is Available, Renderer inventory is Available, and Plugin version consistency is Consistent.
2. Under Included lessons, find the Experience used by the shortcode and confirm that its Deployment status is Present (release). Confirm that the shortcode on the page matches the shortcode shown in the inventory.
3. Under Renderer inventory, confirm that the renderer required by the Experience is Registered.

If any of these checks fail, preserve the fallback text and report the failed status together with the Code in Motion version through the project support channel.

= Where is the editable JSON template, and how do I put my lesson on a page? =

Download the separate cim-authoring-1.0.1.zip release asset. Its top-level README points to the authoring guide. The template is experiences/starter/python-first-steps.authoring.json inside that ZIP; run node tools/cim-author.mjs init my-lesson.json to make your editable copy. Use Node.js 22 or later on your computer.

Edit your copy's lesson ID, title, commands, outputs and explanations, then preview, validate and pack it using the included guide. Install the resulting lesson-pack ZIP through WordPress Plugins and activate it alongside CiM. Open Code in Motion, find Pack lessons, wait for Ready, and copy its shortcode to a page's Shortcode block. Preview and publish. Do not upload source JSON to the Media Library or edit generated PHP.

= Is Lesson packs a separate menu? =

No. Code in Motion opens one Admin page. Start here, Included lessons, Lesson packs and Pack lessons come first. Support information is collapsed by default and contains Static health, Host configuration, Renderer inventory, System and Release information. Expand it to inspect health checks or save the motion-policy setting. Experience means lesson. The Admin page checks installations and lists shortcodes; lesson editing happens on your computer.

== Support ==

Report defects and release issues at https://github.com/johnwinstondarby/Code-in-Motion/issues.

== Changelog ==

= 1.0.1 =
* Put included lessons and lesson packs first in the Admin Console, with teacher guide links.
* Group technical checks and the unchanged motion-policy form under keyboard-accessible, initially collapsed Support information.
* Simplify the public README and move developer architecture and conventions to CONTRIBUTING.md.

= 1.0.0 =
* Package the first public release with install and authoring guides and a non-Git Python starter.
* Compile authored v2 JSON with the standalone tool and install companion lesson packs without rebuilding CiM.
* Keep schema/engine validation and bounded loading for untrusted lesson JSON; reject conflicting IDs and unsafe file locations.
* Default new lessons to Light while preserving legacy lessons, identifiers, frozen formats and learner choices.

= 0.2.6 =
* Match each reading-pane scrollbar track to its own background in every learner theme.
* Guard the two approved Before copying sentences in all three lesson copies; lesson content and frozen formats are unchanged.

= 0.2.5 =
* Pause v2 playback after each complete beat; press Play to continue. Manual Next still completes an unfinished beat before advancing.
* Protect all risk badges from scrollbars and theme both reading-pane scrollbars.
* Show Copy only after command typing completes, reserve its space, align the final prompt and cap continuation indentation.
* Keep Git-in-Motion Bash-only, add the two approved Before copying reminders, and use the approved fixed reading-pane height.
* Preserve Explanation selections and native Resume-button clicks during unchanged text refreshes, including Firefox and WebKit.
* Preserve engine 1.0.1, frozen authoring formats, legacy continuous playback, mobile notice and scoped asset loading.
* Deferred: per-phrase limn, author palettes, Match device and SSH. Verify site fonts again after installation.

= 0.2.4 =
* Wrap Console continuations beyond authored indentation while preserving text, Copy values and whole-line emphasis.
* Load CiM assets only on pages that use it; keep template/builder shortcode fallback and explicit site opt-in/out. Empty pages import no Player modules.
* Preserve engine 1.0.1, frozen authoring formats, learner themes, legacy Player and mobile notice.
* Deferred: per-phrase limn (authoring/v3), author palettes, Match device and authenticated hosting access for scripted rollback.

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

= 1.0.0 =
Retain exact 0.2.6 for rollback, back up the site, replace only CiM and clear hosting caches. Companion lesson-pack plugins survive upgrade, rollback and CiM uninstall. CiM 0.2.6 cannot display packs; restore v1.0 to use them again. No page edits or schema migrations are required.

= 0.2.6 =
Fixes the Explanation scrollbar track and guards existing copying reminders. No page edits are required. Retain the exact 0.2.5 ZIP for rollback and clear hosting caches after replacement.

= 0.2.5 =
V2 playback pauses after each beat for reading. Continue with Play or navigate with Next. Desktop layout and Copy refinements; no page-content changes. Roll back through wp-admin with the exact 0.2.4 ZIP and clear hosting caches.

= 0.2.4 =
Fixes wrapped-line indentation and removes CiM requests from pages without lessons. No page edits are required. Keep the exact reviewed 0.2.3 ZIP for rollback and clear hosting caches after replacement. Verify zero CiM requests on /journey-of-a-token/ and desktop Player/mobile notice on page 3227.

= 0.2.3 =
Console emphasis is easier to read. No lesson or page edits are required. Keep the exact 0.2.2 ZIP for rollback and clear hosting caches after replacement. Mobile blocking is unchanged.

= 0.2.2 =
Show in Console now emphasizes the whole matching line or lines. No lesson or page edits are required. Retain the reviewed 0.2.1 ZIP for rollback and clear WordPress.com caches after replacement. Mobile blocking is unchanged.

= 0.2.1 =
Upgrade from 0.2.0 or 0.1.10. Retain the exact 0.2.0 ZIP and current page 3227 capture for rollback; keep the 0.1.10 hosting backup as fallback. Mobile shows a wider-window notice. Confirm fonts on desktop.

= 0.2.0 =
Upgrade from live 0.1.10 using the reviewed RC#2 ZIP. Capture page 3227 and retain the 0.1.10 rollback ZIP before installation. The shortcode change to git-repository-practice is a separate cutover. Check site fonts and Copy controls on desktop and a phone after installation.
