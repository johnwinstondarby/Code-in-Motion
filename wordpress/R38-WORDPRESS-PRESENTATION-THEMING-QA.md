# R38 WordPress Presentation and Theming QA

Status: In progress

Date opened: 2026-09-23

Branch: `r38/wordpress-presentation-theming`

Base: `52a532b1960d522c97a8f4cca319655cf37a60ba`

## Purpose

R38 defines and verifies the WordPress presentation boundary for Code in Motion after the 0.1.8 production playback path has been validated on Localis.

R37 closed the production-only F4 reachability item. R38 therefore evaluates the real learner-facing 0.1.8 surface rather than an incomplete production composition.

The checkpoint has three linked outputs:

1. a documented ownership contract for CiM presentation versus host-theme presentation;
2. a fixed instrument-panel implementation governed by `cim.css`;
3. browser evidence that the fixed panel, its interactive controls, and existing behavior remain correct in real host contexts.

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

ADR 0044 records the current 0.1.8 presentation as a fixed light Git instrument panel with these owned values:

- text: `#171b22`;
- panel background: `#f4f6f8`;
- lane background: `#ffffff`;
- border/focus: `#323a4a`.

The current CSS also owns Git panel padding, lane layout, lane spacing, borders, focus outline, reflog separation, and the single-column breakpoint at `720px`.

No supported renderer-theming override or custom-property API exists in 0.1.8.

## R38 presentation decision

R38 selects the fixed instrument-panel model.

Fixed means:

- `wordpress/assets/cim.css` is the sole supported presentation authority for the WordPress instrument panel;
- the user cannot select or modify the panel theme through a supported CiM setting;
- WordPress themes, page builders, and site-wide CSS receive no supported theming interface for the panel;
- CiM-owned visual properties do not depend on incidental host inheritance;
- interactive content and learner controls may change state and manipulate the action while remaining visually governed by `cim.css`.

ADR 0045, `WordPress Presentation and Theme Boundary`, records this decision.

## Presentation ownership

R38 classifies the following as CiM-owned and governed by `cim.css`:

- renderer foreground color;
- renderer surface color;
- lane surface color;
- structural border color;
- focus indication;
- playback-control presentation;
- spacing and panel padding;
- lane grid and responsive collapse;
- border radii;
- visual state treatment explicitly emitted by CiM;
- fallback presentation where CiM supplies the fallback element.

Typography inheritance must be explicit. If renderer typography is permitted to inherit from the host, that is a documented exception rather than accidental coupling.

Host page layout may surround the `.cim` invocation. It does not become presentation authority for CiM-owned internals.

## Interactive panel content

Fixed presentation does not mean static content.

The instrument panel may contain dynamic renderer content and learner-facing playback controls. Those controls may manipulate the action and reflect Transport or Runtime-derived state while retaining fixed CiM-owned styling.

R38 therefore includes the presentation and WordPress composition needed for visible playback controls that belong inside the instrument panel.

The exact control behavior must reuse existing Transport authority and binding contracts rather than creating parallel playback logic.

R38 does not expand into:

- semantic rail;
- marker activation;
- scrub interaction;
- Commentary UI;
- a new renderer;
- a new experience format;
- an update channel.

Those remain separate composition or product-surface decisions.

## Future theming seam

R38 deliberately preserves a future path to configurable presentation without exposing that path now.

The internal semantic presentation vocabulary includes at least:

- panel foreground;
- panel surface;
- lane surface;
- structural border;
- focus indicator;
- control foreground;
- control surface;
- spacing units;
- radii.

These are architectural concepts only. They are not public CSS token names.

R38 does not introduce inheritable `--cim-*` custom properties. A future governed release may promote a selected subset of the semantic vocabulary to a documented public interface with explicit scope, fallback values, inheritance, isolation, compatibility, and evidence.

Current literal values should remain centralized and semantically consistent so such a future migration is mechanical rather than archaeological.

## CSS authority boundary

Ordinary host-theme inheritance and realistic global theme rules must not silently determine CiM-owned presentation.

R38 browser evidence must include hostile surrounding declarations sufficient to expose accidental inheritance or weak selector assumptions.

Arbitrary external CSS with sufficient specificity or `!important` is outside the supported contract. Literal immunity from all page CSS would require a stronger containment mechanism such as Shadow DOM and is outside R38.

## Decision record

ADR 0045 is Accepted before implementation freeze.

ADR 0045 records:

- `cim.css` as the sole supported presentation authority;
- the meaning of fixed presentation;
- the relationship between fixed presentation and interactive controls;
- CiM-owned versus explicitly inherited properties;
- the absence of a public theming interface;
- the internal semantic presentation vocabulary;
- the reserved future theming path;
- the supported CSS authority boundary;
- verification requirements for future presentation changes.

ADR 0044 remains the historical record for the 0.1.8 fixed-light production surface.

## Implementation boundaries

R38 may modify presentation-layer source, WordPress control composition, and tests required to prove the approved panel contract.

Expected implementation areas include:

- `wordpress/assets/cim.css`;
- WordPress Transport/control presentation composition;
- Browser E2E assertions for computed presentation and visible controls;
- presentation-specific documentation;
- ADR 0045;
- release metadata when source changes require a new candidate version.

R38 does not change Runtime authority, Host authority, Transport authority, experience state semantics, renderer state semantics, playback timing, or reduced-motion policy.

Any visible controls added to the panel must submit through existing Transport authority.

## Default visual compatibility

Unless R38 explicitly records an approved visual change, the Git renderer default presentation preserves the 0.1.8 computed colors:

- renderer text `rgb(23, 27, 34)`;
- renderer background `rgb(244, 246, 248)`;
- lane text `rgb(23, 27, 34)`;
- lane background `rgb(255, 255, 255)`;
- border/focus derived from `#323a4a`.

Control colors and states introduced by R38 must be CiM-owned and documented as part of the fixed panel presentation.

Any deliberate default change must be called out as a presentation change rather than hidden inside implementation cleanup.

## Responsive contract

R38 preserves or explicitly replaces the existing responsive rule with evidence.

The entering behavior is:

- above `720px`, the Git lane region uses four columns when available;
- at `720px` and below, the lane region uses one column.

Verification must cover at least one width on each side of the breakpoint and a narrow mobile width.

Panel controls must remain usable at narrow width, and renderer content may not become unreachable because of horizontal clipping introduced by R38.

## Focus and keyboard presentation

R38 must preserve visible learner focus indication and must not interfere with the production keyboard subset established by R36:

- ArrowLeft;
- ArrowRight;
- Home;
- End;
- Space play/pause.

Visible panel controls must have browser-verifiable focus presentation and must preserve protected native interaction behavior.

Presentation changes may alter focus styling only when the replacement remains explicit and browser-verifiable.

## Host-context verification

Browser evidence must exercise the CiM surface under materially different host contexts rather than only the neutral test harness.

At minimum verify:

1. the default CiM presentation with no host override;
2. a dark surrounding host surface;
3. hostile host foreground/background declarations that would reveal accidental inheritance;
4. visible control presentation and focus state;
5. Localis production integration or a faithful page-level reproduction of its surrounding theme context.

Because R38 exposes no supported theming interface, host rules are verification adversaries rather than supported override cases.

## Behavioral non-regression

Presentation evidence does not replace behavior evidence.

The exact R38 implementation head must keep green:

- core `npm test` contract suite;
- WordPress production-composition assertions;
- Git production Browser E2E navigation;
- WordPress Space playback Browser E2E;
- any added visible playback-control Browser E2E;
- normal-motion and reduced-motion playback evidence;
- detached-root lifecycle and instance-isolation coverage;
- WordPress Floor QA;
- WordPress Browser E2E across the protected matrix;
- WordPress Playground PR Preview;
- Verify CiM contracts on the protected Node versions.

## Accessibility evidence

R38 records computed foreground/background pairs for renderer-owned surfaces, controls, and focus indication.

If any default color pair changes, the checkpoint must calculate and record resulting contrast rather than relying on visual inspection alone.

The browser evidence must confirm that focus indication remains distinguishable without requiring animation and that visible controls expose appropriate native or explicit accessible names and states.

## Production review

Before candidate freeze, inspect the verified R38 presentation on the Localis Git Repository Practice surface or an equivalent staging/preview path using the real WordPress composition.

The review records:

- desktop integration;
- narrow/mobile integration;
- surrounding Localis context interaction;
- focus presentation;
- visible playback-control presentation;
- playback state changes;
- any host CSS collision found and its disposition.

The review is presentation evidence, not a substitute for automated Browser E2E.

## Release identity

The definition commit does not change release identity.

R38 is expected to change release-staged source bytes through presentation and visible-control work. Candidate freeze therefore aligns plugin/package/readme/release metadata to the next release identity, expected to be `0.1.9`, and regenerates the normal release identity evidence.

The version change occurs at candidate freeze rather than at the architectural decision commit.

## Interim R38 evidence

ADR 0045 commit:

`9ea3b5d6602bf221491f308185ffe32bb249aab5`

Initial fixed-panel/control implementation head:

`c1b37b1262e33926c4e9dea3572151a6e38a1b38`

Contract-fixture correction:

`c65b6b7411da10fe430b97de006143a29fc6d044`

At `c65b6b7411da10fe430b97de006143a29fc6d044`, the protected gates were green:

- Verify CiM contracts run `35932503432`: PASS, 714/714 tests;
- WordPress Floor QA run `35932503401`: PASS;
- WordPress Playground PR Preview run `35932503397`: PASS;
- WordPress Browser E2E run `35932503393`: PASS, including Chromium, Firefox, WebKit, WordPress 6.5.10 through 7.1.1, PHP 7.4 and 8.5, ZIP install, upgrade, synthetic mount, lifecycle differential, and aggregate CiM / Browser E2E.

R38 presentation-browser evidence commit:

`885b4510e180e1f0ae6e54a0f94ff7b8de227a7c`

That browser evidence adds direct assertions for:

- a dark surrounding host surface;
- hostile host foreground, background, border, radius, typography, alignment, and text-transform declarations;
- preserved CiM renderer, lane, control-surface, and button presentation;
- six accessible native controls with the expected labels;
- visible `#323a4a` focus outline;
- learner Next control behavior;
- Play to Pause and Pause to Play state reflection;
- four-column layout at 721 px;
- one-column layout at 720 px;
- one-column mobile layout at 360 px;
- no horizontal overflow of the CiM root or control surface at 360 px.

The exact-head protected gates for `885b4510e180e1f0ae6e54a0f94ff7b8de227a7c` are pending and must replace the interim `c65b6b...` gate set before candidate freeze.

## Acceptance criteria

R38 closes only when all applicable items below are satisfied:

- ADR 0045 is Accepted;
- `cim.css` is recorded as the sole supported presentation authority;
- no public theming custom-property or user-theme surface is introduced;
- the internal semantic presentation vocabulary is recorded for future evolution;
- no-override default presentation is browser-verified;
- realistic hostile host styling cannot silently determine CiM-owned properties;
- responsive behavior is browser-verified on both sides of the breakpoint and at mobile width;
- focus presentation is browser-verified;
- visible playback controls, if composed in R38, use existing Transport authority and fixed CiM styling;
- production keyboard and playback behavior remain green;
- normal-motion and reduced-motion behavior remain green;
- invocation isolation remains green;
- Localis integration has been visually reviewed after `ready`;
- exact implementation-head protected gates are green;
- candidate versioning and release evidence are regenerated under the standard release procedure;
- semantic rail, marker, scrub, Commentary, and update-channel scope remain outside R38.

## RC relationship

R38 is the presentation checkpoint identified after R37 production validation.

Closing R38 removes the known deferred visual-contract decision from the narrow RC #1 path and gives the WordPress instrument panel its intended visible learner-control presentation.

It does not, by itself, decide whether semantic rail, marker/scrub interaction, CLI identity work, or WordPress Admin/update/community tooling are required for the eventual V1 RC.

## Closure record

To be completed with:

- ADR 0045 commit;
- implementation commit(s);
- exact default computed-style evidence;
- host-context evidence;
- responsive evidence;
- focus evidence;
- visible playback-control evidence;
- behavioral non-regression evidence;
- Localis review result;
- candidate/release identity;
- exact-head protected workflow run IDs;
- final R38 disposition.
