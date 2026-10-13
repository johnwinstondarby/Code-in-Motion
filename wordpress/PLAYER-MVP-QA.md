# WordPress Player MVP candidate

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

`tests/e2e/wordpress-player-mvp.spec.mjs` serves a test-only composition outside the release registry and exercises the actual Host, Runtime, Console renderer, Commentary stack, Transport binding, and stylesheet. Its five browser cases cover:

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

All 15 mutations must be detected. The protected Browser E2E workflow runs this mutation gate.

## Release boundary

This is a candidate, not a deployed release or a new designation of the historical RC#1 artifact. Its exact head must pass Verify CiM contracts, WordPress Floor QA, WordPress Browser E2E, and WordPress Playground PR Preview before release admission.

The Git data used by the browser fixture is test-only and is not admitted to production. Beat-aware consumers, v2 Commentary anchor/evidence/risk semantics, independent Console viewport follow and pane holds, engine compatibility/registration, and operational copy remain later checkpoints under the accepted v2 gate. ADR 0048 Parts B and C remain deferred.
