# ADR 0044: WordPress Production Surface Composition

Status: Accepted

Date: 2026-09-22

## Context

The first controlled production deployment of Code in Motion 0.1.6 on Localis exposed a verification gap between component conformance and deployed composition.

The repository independently verifies Transport playback, keyboard playback integration, buttons, semantic rail behavior, marker activation, scrub interaction, Runtime reduced-motion behavior, renderer behavior, and complete learner-path harness composition. The WordPress production surface does not automatically compose every verified component.

Production inspection established that `wordpress/assets/transport-binding.mjs` in 0.1.6 imports only:

- `src/transport/keyboard-binding.mjs`;
- `src/transport/transport-controller.mjs`.

The binding installs the timeline keyboard path for ArrowLeft, ArrowRight, Home, and End. It does not install the playback keyboard binding, Transport buttons, semantic rail, marker activation, or scrub interaction.

This distinction was material during reduced-motion verification. Both registered renderers were available and the reduced-motion policy was computed and delivered correctly, but the deployed WordPress surface exposed no learner action that could request continuous playback. Renderer `context.animate` therefore remained false in production.

R35 also established a presentation boundary for the Git renderer. The live Localis deployment showed that inheriting host-page text color made `git/v1` illegible against the dark page field. The 0.1.7 fix therefore gives the renderer an explicit light instrument-panel surface rather than relying on host-theme inheritance.

## Decision

1. WordPress production composition is a separately verified contract. Component availability, registry membership, harness coverage, and conformance coverage do not establish that a capability is reachable on the deployed WordPress surface.

2. The R35 executable production-composition gate records the exact Transport subset shipped by the WordPress binding. For the 0.1.6 entering state that subset is timeline keyboard navigation through the existing Transport controller.

3. Playback keyboard integration, Transport buttons, semantic rail, marker activation, and scrub interaction remain outside the current WordPress production composition until a later checkpoint explicitly wires them.

4. `bootstrap-module.mjs` remains the WordPress outer composition root. Transport authority continues to arrive through the root-scoped command-only Host projection. The Host does not import Transport.

5. A future checkpoint that changes the shipped Transport subset must change production composition evidence in the same branch. It may not rely solely on the component's existing unit or harness tests.

6. Once WordPress exposes a learner path that can request continuous playback, browser E2E must prove that path through the production WordPress composition. At that point the synthetic renderer is an appropriate behavioral surface for normal-motion versus reduced-motion settlement because it has a deterministic animated-settlement path.

7. Renderer registration and renderer resolution remain separate from Transport reachability. A registered renderer does not imply that every Transport mode capable of driving that renderer is reachable from WordPress.

8. `git/v1` in 0.1.7 uses a fixed host-independent light presentation surface: text `#171b22`, panel `#f4f6f8`, lane background `#ffffff`, and border/focus `#323a4a`. This is the deliberate v1 production presentation contract. WordPress 0.1.7 exposes no supported renderer-theming override or custom-property interface. A later theming checkpoint may add one, but it must define the override contract explicitly and preserve browser-level contrast evidence rather than depending on incidental host stylesheet inheritance.

## Consequences

The production surface has an explicit boundary instead of inheriting an assumption from the broader component suite.

F4 from the first Localis production verification is preserved as a known composition limitation rather than misclassified as a reduced-motion or renderer defect.

Future control work gains a clear closure rule: wire the capability into the WordPress composition, update the production-composition gate, and prove the learner-facing path in browser E2E.

The 0.1.7 Git renderer intentionally appears as a light instrument panel against the darker Localis page field. That visual separation is part of the v1 presentation choice. Theme configurability is deferred until an explicit renderer-theming contract is designed and tested.

The current decision does not add playback controls or change the production Transport behavior carried from 0.1.6 into 0.1.7.

## Verification

R35 established that:

- the WordPress Transport binding imports the exact declared Transport subset;
- ArrowRight reaches the command-only Transport path with source `transport`;
- Space is not captured by the current production binding and submits no playback command;
- disposal removes the scoped keyboard binding and restores the prior tabindex;
- existing complete learner-path and playback component tests remain green;
- WordPress Browser E2E remains green across the supported browsers;
- `git/v1` computed text and surface colors are asserted in Browser E2E so host theme inheritance cannot silently reintroduce the F1 failure.
