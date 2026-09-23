# ADR 0045: WordPress Presentation and Theme Boundary

Status: Accepted

Date: 2026-09-23

## Context

Code in Motion 0.1.8 establishes a fixed light instrument-panel presentation for the WordPress Git renderer. R37 verified the deployed production composition, including learner playback through Space, normal-motion settlement, and effective reduced-motion settlement.

R38 must define who owns the instrument-panel presentation before any further visual work proceeds.

The product requirement is that the instrument panel is fixed in presentation while its contents remain dynamic and interactive. The learner may manipulate the action through controls presented inside the panel, but the panel appearance is governed by Code in Motion rather than by the surrounding WordPress theme or by user-selected styling.

A future release may deliberately expose visual configuration. R38 should preserve that option without creating an accidental public theming API in the current release.

## Decision

1. `wordpress/assets/cim.css` is the sole supported presentation authority for the Code in Motion WordPress instrument panel.

2. Fixed presentation means that Code in Motion exposes no supported user, page-builder, WordPress-theme, or site-wide CSS theming interface for the instrument panel in R38.

3. CiM-owned presentation includes renderer foreground and surface colors, lane surfaces, structural borders, focus indication, control presentation, spacing, panel padding, grid behavior, responsive collapse, radii, and other visual rules explicitly defined by `cim.css`.

4. The panel contents remain dynamic and interactive. Playback controls and other learner-facing controls may change state and may manipulate the action while remaining visually governed by the fixed `cim.css` presentation contract.

5. Host typography may be inherited only where R38 explicitly classifies typography as inherited. All other CiM-owned properties must be declared by `cim.css` rather than relying on incidental host inheritance.

6. R38 introduces no public CSS custom properties, theme settings, user theme controls, or documented external selectors for changing the instrument-panel appearance.

7. R38 records an internal semantic presentation vocabulary to make a future configurable path easier without exposing it as an API. The vocabulary includes at least:

   - panel foreground;
   - panel surface;
   - lane surface;
   - structural border;
   - focus indicator;
   - control foreground;
   - control surface;
   - spacing units;
   - radii.

   These are architectural concepts, not public CSS token names.

8. Current release CSS values remain ordinary CiM-owned declarations. R38 does not introduce inheritable `--cim-*` custom properties merely as private implementation details because their presence would create a practical external override seam before that seam is governed.

9. A future governed release may promote a selected subset of the internal semantic vocabulary to a documented theme interface. Such a change must define scope, fallback values, inheritance, compatibility, isolation, and browser evidence at the time the interface is introduced.

10. Ordinary host-theme inheritance and realistic global theme rules must not silently determine CiM-owned presentation. Browser evidence must exercise dark surrounding surfaces and hostile host foreground/background declarations.

11. Arbitrary external CSS with sufficient specificity or `!important` remains outside the supported contract. Literal isolation from all page CSS would require a stronger containment mechanism such as Shadow DOM and is a separate architectural decision.

12. Presentation authority is independent from Runtime, Host, Transport, renderer-state, playback-timing, and reduced-motion authority. R38 presentation work must preserve those contracts.

## Consequences

The current WordPress instrument panel has one supported presentation source: `cim.css`.

The surrounding WordPress theme may provide page context, but it does not gain a supported mechanism for recoloring or restructuring the CiM instrument panel.

Learner-facing controls can remain interactive and stateful without making the presentation configurable.

The internal semantic vocabulary reduces future migration cost. If configurable theming is later approved, selected concepts can be promoted deliberately instead of reverse-engineering scattered literal declarations.

The absence of `--cim-*` custom properties in R38 is deliberate. It preserves a clean boundary between internal presentation organization and public configuration.

Shadow DOM or another stronger style-isolation mechanism is not introduced by R38.

## Verification

R38 verification must demonstrate that:

- the approved default computed presentation is supplied by `cim.css`;
- dark host context does not alter CiM-owned colors or surfaces;
- realistic hostile host foreground/background rules do not silently alter CiM-owned presentation;
- responsive layout remains correct above and below the approved breakpoint and at narrow mobile width;
- focus indication remains visible and CiM-owned;
- learner playback and keyboard behavior remain green;
- normal-motion and reduced-motion behavior remain green;
- multiple CiM invocations remain isolated;
- any visible playback controls included in the WordPress panel use the fixed CiM presentation authority;
- no public theming custom-property surface is introduced.

Future work that exposes visual configuration must amend or supersede this ADR and add explicit configuration and isolation evidence.
