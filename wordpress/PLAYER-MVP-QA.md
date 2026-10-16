# WordPress Player MVP candidate

## RC#2: 0.2.0 candidate

Johann approved removing the visible related-line count. Explanation still retains its evidence ID relationship and Show in Console focuses those exact output lines. Command/Output/Response phase labels and risk guidance remain. Browser assertions reject both the old label element and related-output/response wording; a mutation guard proves accidental reinstatement fails.

RC#2 keeps engine 1.0.1, advances plugin metadata to 0.2.0, and pins the upgrade origin to the RC#1 0.1.10 release commit rather than intervening 0.1.11 development heads. Protected CI installs the exact checksummed 0.2.0 ZIP, tests warm-cache upgrading, and rehearses plugin/page rollback in under 60 seconds. Live capture and delivery evidence are recorded separately; no live installation, shortcode change, merge or tag is included.

## Issue #4: CLI identity and Console copy (ADR 0054)

Engine capability identity is now `localis.cim/engine@1.0.1`; the registered CLI-bearing lesson requires 1.0.1. Compiler 1.0.1 enforces this feature floor without rewriting the minima of older lessons. The plugin release remains 0.1.11 until RC#2.

The Console Player presents authored CLI identity in the upper-right of the pane and supplies clipboard behavior for existing renderer Copy buttons. Every CLI kind uses secondary Console text in every learner preset; red and green remain risk colors. The label supplies the CLI identity. The registered lesson explicitly names Bash. Missing CLI metadata remains compatible, and legacy Git Players are unchanged. Copy writes the exact authored `data-copy` value and announces that complete value only on success. Clipboard failure gives native-selection guidance. It never seeks, intercepts native copy events, rewrites selection, or inspects renderer state; pending announcements and stale controls are revoked at disposal.

Headless tests exercise authoring/runtime validation, deterministic metadata and immutable content, exact writes, denial/unavailable API, pending completion order and cleanup. Player browser cases cover all kinds under all themes, native drag selection, Ctrl+C, unprevented Cmd+C keyboard/context-menu events, authored override, real clipboard paste into a text field, renderer replacement, and sibling isolation. Chromium proves native clipboard read/write permissions; Firefox and WebKit cover native copy events and clipboard failure. Source and installed ZIP WordPress proofs assert the real Bash badge and actual Copy control. The known wrap collision remains an expected failure. Live installation and RC#2 remain pending.

Frozen authoring/v1 is byte-identical to its pre-PR state. CLI metadata is accepted only under authoring/v2, which freezes upon PR #80 merge; limn is reserved for authoring/v3. A scrolling regression proves that Copy buttons do not peek out below the pinned title.

## Engine identity and v2 admission checkpoint (ADR 0053)

The explicit engine capability identity is `localis.cim/engine@1.0.0`, independent of plugin 0.1.11. Browser loading and deployment registration share admission checks; incompatible minima fail with CIM-EXP-015 before renderer/clock/Runtime construction. v2 is admitted only through the complete Console Player; other v2 renderer modes fail CIM-EXP-016. The canonical Git reference lesson is now registered. The Player carries and presents every phase/evidence/risk field, with risk guidance between prose and links, immutable ID relationships, unchanged renderer-owned focus and no opaque-state inspection. Source-bootstrap proofs and protected source/ZIP WordPress proofs cover actual admission, healthy legacy siblings and version fallback. This supersedes the historical closed-gate notes below. Live installation remains pending.

## Learner themes checkpoint (PR #78, ADR 0052)

Console-Explanation Players offer Localis, High Contrast and Light through one native Theme select. Complete root-scoped palette declarations are generated from tested preset values; Localis preserves PR #77. Choice is shared across sibling Players and saved when storage permits. Explicit memory wins even on storage failure. Device contrast/light settings apply and update only without explicit choice. Forced colors hides the menu and retains the underlying preference. Binding/disposal and media-listener cleanup are transactional/retryable. Headless and browser proofs check contrast, hostile ancestors, canonical/renderer invariance, synchronization, reload, device changes, storage failure, remount and stale controls. Author palette integration remains deferred to Part C and will affect only Localis. Engine identity, the closed v2 gate, release version and live installation are unchanged.

Cross-engine hardening supplies a complete browser-system palette under forced colors and reads fresh media values on notification. The selected-browser CI matrix exercises the learner-theme browser cases. Browser emulation can leave old MediaQueryList values stale or omit contrast notifications. Contrast-change cases confirm the native emulated preference, then dispatch a change event on the actual registered native query objects; they do not replace query values or production code. Headless tests independently cover isolated notifications and stale-query resampling. Color-scheme and forced-colors changes remain native browser-emulation proofs. This is a test-emulation limitation, not a promise of production polling for silent changes.

This checkpoint implements ADR 0049 and ADR 0048 Part A as the Player foundation for plugin 0.1.11. It follows the ADR-only merge `23fedb735dde81419f7efee49307599a634f71e4` after all four protected workflows passed on the accepted ADR head.

## Scope

- WordPress selects Console-Explanation only from the fixed `console/v1` mapping; other renderers keep legacy composition.
- Host mounting initializes Runtime and exposes frozen command, observation, and instructional content capabilities. WordPress admits presentation with `present(root)` after required bindings complete.
- Player content excludes renderer state/configuration and validates canonical boundary alignment.
- One Player contains Console output, persistent Explanation title/description, existing Commentary reveal/navigation/follow, and existing Transport.
- Restart appears only in Console-Explanation mode. Legacy visible controls remain Start, Previous, Play/Pause, Next, End.
- Live renderer, Player, and controls are structurally withheld before admission. Construction failure in either mode returns to fallback.
- Disposal synchronously revokes Player content alongside the existing ports, removes presentation bindings/DOM, and wins presentation races.
- Fixed pane colors implement ADR 0048 Part A; no theme variables or renderer oracle changes are introduced.
- `console/v1` is registered inertly. The production experience registry remains unchanged and rejects v2.
- Copy controls are withheld until the later Player-owned copy checkpoint supplies their behavior.

## Executable evidence

`npm run verify` includes the new Host proofs and existing production fences, legacy Transport tests, instance-isolation tests, content freshness, and protected Console renderer evidence.

`tests/e2e/wordpress-player-mvp.spec.mjs` serves a test-only composition outside the release registry and exercises the actual Host, Runtime, Console renderer, Commentary stack, Transport binding, and stylesheet. Its original five browser cases cover:

1. Pre-ready withholding, frame-sampled admission, two panes, metadata, no initial authored Commentary, hostile host colors, and Restart visibility.
2. Revealed prefix, high-water history on backward navigation, Commentary seek provenance, protected native links, selectable text, Restart, fixed risk color, and two-instance isolation.
3. Failed admission returning to fallback with Player and Transport removed.
4. Presentation teardown, stale-listener withdrawal, synchronous capability withdrawal, disposal winning admission, and sibling preservation.
5. Narrow stacked layout without horizontal page overflow.

The protected Browser E2E workflow runs these checks alongside existing real WordPress shortcode/bootstrap, legacy learner-path, fault, and detach proofs. Local standalone browser evidence does not replace that workflow's installed-ZIP and WordPress matrix evidence.

## Guarded mutations

`node tools/check-wordpress-player-mutations.mjs --work-directory=<scratch-directory>` first proves an unmodified baseline, then runs each mutation in a copied sandbox with dependencies linked read-only by convention. It never changes the candidate checkout. Per-mutation logs record the failed protected assertion.

| Broken behavior | Protected evidence |
|---|---|
| Remove the mode mapping or route Console to legacy | Browser atomic-readiness/two-pane case |
| Expose Restart in legacy | Existing legacy Transport composition suite |
| Hide Restart in Console-Explanation | Browser atomic-readiness case |
| Remove Commentary provenance adapter | Browser reveal/navigation case |
| Skip Commentary disposal | Browser root-teardown/stale-button case |
| Leave partial Player active | Browser admission-failure case |
| Project ready during mount | Host admission suite |
| Admit a disposed root | Host disposal-race suite |
| Retain Player content during disposal | Host synchronous-withdrawal suite |
| Shift Commentary boundary IDs | Host content-alignment suite |
| Remove renderer, Player, or Transport withholding | Browser pre-ready/frame-sampling case |
| Open v2 production registration | Existing experience-registry gate suite |

All 15 original mutations, 16 viewport/hold mutations, and seven beat-consumer mutations must be detected. The protected Browser E2E workflow runs this mutation gate.

## Known issue: authored indent and wrapped continuation can coincide

The wrapping fix merged in PR #74 preserves authored whitespace and gives continuation rows a fixed 2ch indent from the line box. It does not measure that indent relative to the first non-space character. The Git restore guidance line begins with two authored spaces, so its continuation can align with the first row's visible text and resemble a separate authored line. Deeper fixed indentation would move the collision rather than eliminate it for arbitrary authored indentation.

This is recorded for the next Console renderer review and does not block independent pane follow/holds. The options to review are a subtle continuation cue that does not depend on columns, or renderer markup separating leading whitespace so continuation indentation can be relative to the text start. The latter changes renderer DOM and requires reviewed oracle regeneration with lineage; no oracle change is authorized by recording this issue.

The browser case `known issue: continuation must begin beyond authored indentation` is an expected failure measuring continuation position against the first non-space character of the real Git guidance line. It pins the unresolved requirement without turning the protected suite red. An eventual implementation that satisfies it must remove the expected-failure annotation.

For the subsequent viewport checkpoint, temporary pointer/focus/selection holds pause automatic movement without suspending follow mode. Learner scrolling away establishes viewport ownership and suspends following until explicit resume. ADRs 0029 and 0030 must state this distinction.

## Release boundary

This is a candidate, not a deployed release or a new designation of the historical RC#1 artifact. Its exact head must pass Verify CiM contracts, WordPress Floor QA, WordPress Browser E2E, and WordPress Playground PR Preview before release admission.

The Git data used by the browser fixture is test-only and is not admitted to production. Independent pane follow/holds and beat consumers are covered by the checkpoints below. v2 Commentary anchor/evidence/risk semantics, engine compatibility/registration, and operational copy remain later checkpoints under the accepted v2 gate. ADR 0048 Parts B and C remain deferred.

## Independent pane follow and holds checkpoint

ADR 0050 amends Commentary follow/scroll contracts. A stable Player-owned Console viewport survives renderer replacement. Console presentation text changes, including partial typing/output, drive its independent follow policy. Explanation follows the canonical revealed Commentary prefix. Native pointer presence, pane focus, and non-collapsed selection intersecting a pane are overlapping temporary holds. They pause movement; only scrolling away suspends following. Deliberate return to the bottom or that pane's pending button explicitly resumes. The labels are New output below and New explanation below.

Deliberate navigation may reposition both views without silently resetting learner follow ownership. Holds do not block an explicitly requested navigation. Immediate scrolling, one-pixel bottom tolerance, unchanged renderer DOM/evidence, and the closed production v2 registry remain protected.

The six new browser cases prove actual renderer replacement, newest content in both panes, every hold reason in both panes, overlapping holds, independent scroll ownership, pending labels, button/manual resume, sibling isolation, offscreen-link focus without ownership, and stale-listener withdrawal. Headless policy/geometry tests protect validation, contraction, acknowledgement, successful movement, and explicit repositioning. Pane hold listeners and the renderer observer are disposed with the Player; listener installation rollback and retryable teardown are separately exercised.

## Review follow-up

PR #76 review adds an opaque black sticky-title surface including its lower gap, with a geometry/hit-testing browser proof. Selection isolation and pre-existing pointer presence now have dedicated browser and headless proofs plus mutation guards. The protected browser suite has 15 normal cases and the existing expected wrap-collision failure; the mutation runner catches 31 guarded breakages.

Master Visuals v3 corrects the WordPress transport status: 0.1.11 ships Start, Previous, Play/Pause, Next, End, and Restart in Console-Explanation mode; the timeline, Playback Rate slider, and beat progress remain targets. The Part A color follow-up must replace the discussed Console line's white outline with a background band and review keyboard focus-ring treatment against the grammar, including a forced-colors fallback. These changes remain outside the pane-follow PR. Pointer-rest behavior should be checked on page 3227 during live installation.

## Beat consumers checkpoint (ADR 0051)

Authored headings group segment Explanation entries. Progress follows the current committed beat, including backward movement below the reveal frontier. One native marker per beat seeks the captured final boundary with marker provenance. Manual Previous/Next use beat-final destinations; continuous playback and Commentary selection still visit individual segments. Incoming public v2 beat links select final boundaries before admission; generated segment links are rejected. Legacy step links and navigation remain unchanged.

Five added browser cases cover headings/progress/reset, button and keyboard navigation, captured marker targets, internal Commentary selection, incoming beat links, v1 fallback, sibling isolation, and teardown. Four headless binding cases protect validation before DOM changes, construction rollback, retryable listener withdrawal, and synchronous/asynchronous failures. The complete browser suite now has 20 normal cases plus the known expected wrap failure.

Production v2 registration remains closed. Engine compatibility, complete anchor/evidence/risk semantics, copy, timeline scrubbing, rate controls, color/limn work, and wrapping collision remain deferred. Pane follow and holds have shipped through ADR 0050; beat consumers are implemented here rather than deferred. No release-version change or live installation is part of this checkpoint.

Seven additional mutation guards break manual beat navigation, final-boundary deep-link mapping, committed-beat progress, marker destination, immutable marker targeting, and listener withdrawal. All 38 guarded breakages must be caught after a passing baseline.

PR #77 review decision: Next finishes an incomplete beat, then advances after completion. Core matrix and Runtime/browser proofs cover both presses; the additional mutation guard catches skipping an unfinished beat.

Implemented session #8 styling checkpoint on INSPIRE: Console stays #000000. Explanation adopts Localis near-black #171B22, prose #A8B3C2, bright title headings #E8ECF2, IBM Plex Sans 500 prose, Catamaran 700 headings, mono controls, #323A4A borders and 8px corners. Teal #5AC4C8 beat kickers serve wayfinding and mark the current entry border. Font fallbacks remain available; the plugin does not load fonts. Existing browser proofs now check these computed styles under hostile host styling. The screenshot from the standalone browser fixture uses system fallbacks; installed Localis fonts and pointer-rest behavior still need live verification. Navigation, renderer evidence, production v2 registration and release version are unchanged. The broader background-band/limn and focus-ring grammar checkpoint remains pending.

The next session #8 pass gives only the Console-Explanation Player's ready outer frame and Transport the dark palette. Structural `:has(> [data-cim-player="console-explanation"])` selectors scope this CSS without adding Host or renderer attributes. Legacy Git retains its light presentation. Transport uses IBM Plex Mono fallbacks, bright labels, 8px corners, near-black resting controls and #323A4A hover/playback surfaces. Teal marks the current beat border; neutral #A8B3C2 outlines keyboard focus, with system Highlight in forced colors. Browser evidence covers Play/Pause, hover, focus, forced colors and a neighboring legacy instance. The suite now has 21 ordinary cases plus the declared expected wrap failure. Explanation `strong` text retains weight 700. Plugin font loading, live installation and the Console background-band/limn checkpoint remain pending.


## 0.2.5 GA candidate acceptance

Scope: Johann's approved punch list only. Git-in-Motion stays Bash-only, with no PowerShell variants or notes. Keep the 0.2.4 authored lesson, pane geometry, transport placement, Start/End/Restart/Previous, seeks, markers, deep links and Show behavior.

ADR 0058 stops v2 Play at every beat's final segment. Check all eight boundaries with normal and reduced motion, Play available and progress unchanged while waiting, automatic segment progression within beats, resuming with Play and Next, and existing incomplete-beat Next completion. Headless and browser coverage must both pass.

Force Console overflow and check each risk badge's right edge against the scroller content edge in every theme and risk state. Check themed thin scrollbars, Copy absent while typing and present when complete with its authored value, Copy beside the end of wrapped commands, final-prompt alignment and capped deep indentation. Run full verification, all three Player browsers, mutation guards including new badge/pacing guards, installed-ZIP and upgrade/rollback checks on the exact candidate head. Hold merge/tag/install for Daisy. After installation repeat the approved live list, mobile notice, fonts and zero CiM assets on pages without a Player.

Approved scope exception: preserve unchanged Explanation text and link-label nodes during refresh. This prevents Firefox from clearing a learner selection and releasing its scroll hold. Both full-suite Firefox regressions and a destructive-refresh mutation guard cover it. No navigation or lesson-content change.
