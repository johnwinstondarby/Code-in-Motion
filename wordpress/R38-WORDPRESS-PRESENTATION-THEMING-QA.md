# R38 WordPress Presentation and Theming QA

Status: In progress

Date opened: 2026-09-23

Branch: `r38/wordpress-presentation-theming`

Base: `52a532b1960d522c97a8f4cca319655cf37a60ba`

## Purpose

R38 defines and verifies the WordPress presentation boundary for Code in Motion after the 0.1.8 production playback path has been validated on Localis.

R37 closed the production-only F4 reachability item. R38 therefore evaluates the real learner-facing 0.1.8 surface rather than an incomplete production composition.

The checkpoint has two linked outputs:

1. a documented ownership contract for CiM presentation versus host-theme presentation;
2. an implementation and browser evidence matching that contract.

R38 must decide whether the fixed light instrument-panel presentation remains the supported contract or whether CiM introduces a narrow, explicit theming interface. The decision is recorded before candidate freeze.

## Entering state

Protected `main` points to:

`52a532b1960d522c97a8f4cca319655cf37a60ba`

The merge tree is:

`9c9410a91308b62c15b52888baeba15509ff37d8`

Production Localis runs the exact published Code in Motion 0.1.8 artifact and R37 records:

- installed 0.1.8 live tree equals the expected artifact-derived live manifest;
- existing `git-basic-cycle` reaches `ready` and remains navigable;
- learner Space reaches the continuous-playback path;
- normal motion uses deterministic animation-frame settlement;
- effective reduced motion reaches the same stable result without CiM animation frames;
- F4 disposition: CLOSED.

ADR 0044 records the current 0.1.8 presentation contract as a fixed light Git instrument panel with these owned values:

- text: `#171b22`;
- panel background: `#f4f6f8`;
- lane background: `#ffffff`;
- border/focus: `#323a4a`.

The current CSS also owns Git panel padding, lane layout, lane spacing, borders, focus outline, reflog separation, and the single-column breakpoint at `720px`.

No supported renderer-theming override or custom-property API exists in 0.1.8.

## Presentation ownership decision

R38 must explicitly classify each presentation family as CiM-owned, host-inherited, or configurable through a supported CiM interface.

At minimum the decision covers:

- renderer foreground color;
- renderer surface color;
- lane surface color;
- border color;
- focus indication;
- spacing and panel padding;
- lane grid and responsive collapse;
- border radii;
- renderer typography inheritance;
- fallback presentation before `ready`;
- dark host pages and other host-theme color contexts.

The contract must prevent accidental theme coupling. Host CSS may surround the CiM root, but a CiM-owned visual property cannot depend on incidental inheritance, selector order, or a theme-specific variable whose presence CiM does not control.

## Theming decision alternatives

R38 evaluates two permissible contracts.

### A. Fixed instrument panel

CiM retains a fixed production presentation for renderer-owned colors and visual boundaries.

Under this contract:

- the 0.1.8 light instrument-panel values remain explicit CiM-owned values;
- host themes cannot recolor renderer-owned surfaces through ordinary inheritance;
- no public theming API is promised;
- future presentation changes require a governed CiM release.

### B. Scoped CiM theme interface

CiM exposes a deliberately small set of CSS custom properties scoped at the `.cim` invocation root or a documented descendant boundary.

Under this contract:

- each supported token has a CiM-owned fallback value;
- absent overrides reproduce the approved default presentation;
- host themes gain no implicit control over undocumented internals;
- override scope is per CiM invocation unless a documented site-wide rule is deliberately applied by the host;
- token names, fallback values, inheritance behavior, and unsupported properties are documented;
- renderer semantics and transport behavior remain independent from presentation tokens.

R38 may choose either alternative. A partial or accidental hybrid is not acceptable.

## Decision record

R38 creates ADR 0045, `WordPress Presentation and Theme Boundary`, before candidate freeze.

ADR 0045 records:

- the selected ownership model;
- the reason for selecting it;
- the supported public presentation surface, if any;
- default values;
- inheritance rules;
- compatibility expectations;
- what remains deliberately unsupported;
- the evidence required for future presentation changes.

ADR 0044 remains the historical record for the 0.1.8 fixed-light production surface.

## Implementation boundaries

R38 may modify presentation-layer source and the tests required to prove it.

Expected implementation areas include:

- `wordpress/assets/cim.css`;
- Browser E2E assertions for computed presentation;
- presentation-specific documentation;
- ADR 0045;
- release metadata only when source changes require a new candidate version.

R38 does not change Runtime authority, Host authority, Transport authority, experience state semantics, renderer state semantics, playback timing, or reduced-motion policy.

R38 does not add:

- Transport buttons;
- semantic rail;
- marker activation;
- scrub interaction;
- Commentary UI;
- a new renderer;
- a new experience format;
- an update channel.

Those remain separate composition or product-surface decisions.

## Default visual compatibility

Unless ADR 0045 explicitly approves a changed default, the no-override presentation must preserve the 0.1.8 Git renderer computed colors:

- renderer text `rgb(23, 27, 34)`;
- renderer background `rgb(244, 246, 248)`;
- lane text `rgb(23, 27, 34)`;
- lane background `rgb(255, 255, 255)`;
- border/focus derived from `#323a4a`.

Any deliberate default change must be called out as a presentation change rather than hidden inside the theming mechanism.

## Responsive contract

R38 preserves or explicitly replaces the existing responsive rule with evidence.

The entering behavior is:

- above `720px`, the Git lane region uses four columns when available;
- at `720px` and below, the lane region uses one column.

Verification must cover at least one width on each side of the breakpoint and a narrow mobile width.

No renderer content may become unreachable because of horizontal clipping introduced by R38.

## Focus and keyboard presentation

R38 must preserve a visible learner focus indication for Git lane focus and must not interfere with the production keyboard subset established by R36:

- ArrowLeft;
- ArrowRight;
- Home;
- End;
- Space play/pause.

Presentation changes may alter focus styling only when the replacement remains explicit and browser-verifiable.

Protected native interaction targets must retain native behavior.

## Host-context verification

Browser evidence must exercise the CiM surface under materially different host contexts rather than only the neutral test harness.

At minimum verify:

1. the default CiM presentation with no host override;
2. a dark surrounding host surface;
3. hostile host foreground/background declarations that would reveal accidental inheritance;
4. Localis production integration or a faithful page-level reproduction of its surrounding theme context.

If R38 selects a scoped theming interface, add:

5. one explicit supported override case;
6. one partial override case proving unspecified tokens retain CiM defaults;
7. invocation isolation proving an override on one `.cim` root does not restyle another root.

## Behavioral non-regression

Presentation evidence does not replace behavior evidence.

The exact R38 implementation head must keep green:

- core `npm test` contract suite;
- WordPress production-composition assertions;
- Git production Browser E2E navigation;
- WordPress Space playback Browser E2E;
- normal-motion and reduced-motion playback evidence;
- detached-root lifecycle and instance-isolation coverage;
- WordPress Floor QA;
- WordPress Browser E2E across the protected matrix;
- WordPress Playground PR Preview;
- Verify CiM contracts on the protected Node versions.

## Accessibility evidence

R38 records computed foreground/background pairs for renderer-owned surfaces and focus indication.

If any default or supported override changes a color pair, the checkpoint must calculate and record the resulting contrast rather than relying on visual inspection alone.

The browser evidence must also confirm that focus indication remains distinguishable without requiring animation.

## Production review

Before candidate freeze, inspect the verified R38 presentation on the Localis Git Repository Practice surface or an equivalent staging/preview path using the real WordPress composition.

The review records:

- desktop integration;
- narrow/mobile integration;
- surrounding Localis light/dark context interaction where applicable;
- focus presentation;
- playback state changes;
- any host CSS collision found and its disposition.

The review is presentation evidence, not a substitute for automated Browser E2E.

## Release identity

The definition commit does not change release identity.

If R38 changes release-staged source bytes, candidate freeze aligns the plugin/package/readme/release metadata to the next release identity, expected to be `0.1.9`, and regenerates the normal release identity evidence.

If R38 concludes with documentation only and no release-staged source change, it does not create a synthetic version bump merely for the checkpoint number.

## Acceptance criteria

R38 closes only when all applicable items below are satisfied:

- presentation ownership is explicit rather than incidental;
- ADR 0045 is Accepted;
- the selected fixed or configurable theming contract is implemented exactly;
- no-override default presentation is browser-verified;
- hostile host styling cannot silently alter CiM-owned properties;
- responsive behavior is browser-verified on both sides of the breakpoint and at mobile width;
- focus presentation is browser-verified;
- production keyboard and playback behavior remain green;
- normal-motion and reduced-motion behavior remain green;
- invocation isolation remains green;
- Localis integration has been visually reviewed after `ready`;
- exact implementation-head protected gates are green;
- if release bytes change, candidate versioning and release evidence are regenerated under the standard release procedure;
- no learner-control scope from outside R38 is pulled into the checkpoint.

## RC relationship

R38 is the presentation/theming checkpoint identified after R37 production validation.

Closing R38 removes the known deferred visual-contract decision from the narrow RC #1 path. It does not, by itself, decide whether broader learner controls, CLI identity work, or WordPress Admin/update/community tooling are required for the eventual V1 RC.

## Closure record

To be completed with:

- selected presentation ownership model;
- ADR 0045 commit;
- implementation commit(s);
- exact default computed-style evidence;
- host-context evidence;
- responsive evidence;
- focus evidence;
- any supported theming override evidence;
- behavioral non-regression evidence;
- Localis review result;
- candidate/release identity if source bytes changed;
- exact-head protected workflow run IDs;
- final R38 disposition.
