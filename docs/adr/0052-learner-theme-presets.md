# ADR 0052: Learner Theme Presets

Status: Accepted for learner presets; author palette integration remains deferred to ADR 0048 Part C.

Date: 2026-10-13

## Context

The owner confirmed the three names, author precedence and device preference order, then requested implementation as PR #78 after PR #77. Learner preferences change presentation without changing lessons or canonical behavior.

## Decision

1. A native Theme menu contains **Localis**, **High Contrast**, **Light** (`localis`, `high-contrast`, `light`). Localis is the default when no explicit choice or device preference applies. There is no free color input.
2. Resolution order: Windows High Contrast (`forced-colors: active`), explicit learner choice, `prefers-contrast: more`, `prefers-color-scheme: light`, then Localis. Forced colors hides the menu and maps every role to browser system colors (Canvas, CanvasText, Highlight, LinkText), without disabling automatic forced-color adjustment. It retains the underlying preference for restoration afterward. Device changes are followed whenever no explicit choice exists. Notification handling samples fresh query results rather than trusting a cached query object's values.
3. Save only explicit choices to site-origin `localStorage` under `cim.learnerTheme`. Unknown IDs mean no choice. Storage getters, reads and writes may fail without faulting the Player. An explicit choice remains authoritative in page memory and synchronizes existing and newly bound sibling Players even if saving fails. Failed storage cannot promise persistence across reload. No WordPress database state or cross-tab synchronization is introduced.
4. One wrapping native label/select in each Console-Explanation control area adds one tab stop and the accessible name Theme. Construction and rollback are transactional. Disposal makes controls inert and supports retryable listener withdrawal. Shared media listeners exist only while at least one Player subscribes; preference memory survives Player remount. Legacy Git receives no theme control and keeps its light palette.
5. Complete presets live in `wordpress/assets/theme-presets.mjs`. `check:learner-theme-css` verifies that generated declarations in `cim.css` match that source. Localis matches merged PR #77, correcting the draft's different frame colors: frame/background `#171B22`, frame text `#A8B3C2`, control text `#E8ECF2`, control borders/focus `#A8B3C2`, hover/playback `#323A4A`. High Contrast and Light retain the draft's pane/risk values. Hover and separate frame/pane focus roles complete their interactive palettes.
6. WordPress Player composition sets `data-cim-theme` on the instance root and restores its previous value on teardown. CSS remains the styling authority. Every Console-Explanation root declares every internal `--cim-*` role, including the complete Localis baseline before/without a theme attribute. CSS uses no `var()` fallback or inherited ancestor palette. These properties are not a supported page-author API; arbitrary higher-specificity or `!important` overrides remain outside the contract.
7. This decision activates learner palette properties **before** ADR 0048 Part C and amends ADR 0045 Decisions 6/8 and ADR 0048 Decisions 20/21 for these roots. The internal vocabulary includes risk, frame, controls, wayfinding and focus. It introduces no v3 schema or author-color inputs. When Part C lands, a validated author palette replaces only the lesson's Localis values; High Contrast and Light remain identical across lessons. Author validation, compiler changes and author palette integration do not ship here.
8. Grammar stays fixed: Console/dim text, prose, risk labels, wayfinding and limn retain their purposes. Risk remains redundant with label text. Limn colors are reserved; actual limn behavior is deferred. Forced-color adjustment remains enabled.
9. Contrast tests use the palette source consumed by generated CSS: Console text, prose and headings meet 7:1; dim text, risk, wayfinding and controls meet 4.5:1; limn meets 3:1 against Console background and the CiM 1.5:1 text differentiation rule; control borders/focus meet 3:1 on resting/hover surfaces. Decorative pane borders are not sole control boundaries. Failing palettes do not ship.
10. No content, compiler, schema, canonical oracle, renderer DOM, Runtime navigation, registry, release-version or live installation changes. The v2 production gate remains closed. Engine identity/version checks, complete v2 semantics, site-font verification and Console background-band/limn work remain separate checkpoints.

## Verification

Headless proofs cover precedence, unknown IDs, storage/getter failure, synchronization, forced-color restoration, stale-query resampling, transactional rollback/withdrawal, complete palettes and contrast. Browser proofs exercise all palettes under hostile host rules/ancestor variables, unchanged state and renderer markup, labeling, reload, live device preferences, unavailable storage/remount, forced colors and stale controls in Chromium, Firefox and WebKit. The browser-family CI matrix runs the learner-theme proofs in each engine. Mutation guards protect these boundaries after passing baselines.

Related: ADR 0045 presentation boundary, ADR 0048 teaching-first palette/author theming, ADR 0049 Player composition.
