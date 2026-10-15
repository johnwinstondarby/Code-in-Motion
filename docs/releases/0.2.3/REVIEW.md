# RC#3 — 0.2.3 Console readability

Candidate only: hold merge, tag and live installation for Daisy review. Live remains 0.2.2.

The whole-line cue now paints behind text spans, with transparent five-pixel side gutters separating the first glyph from the inset outline. The settled band uses a quiet 12% tint; dim text temporarily uses the normal Console text color during the brighter flash to preserve at least 4.5:1 contrast in all three themes. The existing limn colors, 480 ms hold, 1.2-second total cue, repeat behavior, quiet settling and reduced-motion policy remain.

Wrapped continuations start two character cells beyond the rendered line's authored leading spaces. Player-only layout reads rendered text and projects a CSS custom property; it never changes that text, copy payloads, lessons, engine state or renderer source/canonical output. Layout refreshes before pane following after renderer changes and restores prior styles on disposal. The previously expected-failure collision case is now required to pass.

Plugin version 0.2.3; engine localis.cim/engine@1.0.1. Frozen authoring/v1 and v2 and the legacy Git Player remain unchanged. Browser proofs cover multiple authored indents, text transparency, outline/glyph clearance, repeat and reduced-motion cues. Cross-engine CI includes the continuation proofs.

Build the exact ZIP twice with pinned Node 22.23.2, compare checksums, and run installed-ZIP and upgrade proofs against it. Upgrade origins are 0.1.10, 0.2.0, 0.2.1 and current live 0.2.2; each rollback installs the exact reviewed 0.2.2 ZIP (a0db35a6...) and restores the captured page. Keep the refreshed page 3227 capture (including mobile Shell layout), and older hosting backup as secondary fallback. Re-check live page before any later cutover. Hosting cache clearing is outside CI rollback timing.

Known deferred work: per-phrase authoring/v3 limn, author palettes, optional Match device, and hosting authentication for scripted rollback. Site fonts already verified live. Mobile remains gated, including iPads. No live page or plugin changes are included in this candidate work.
