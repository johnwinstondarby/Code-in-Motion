# ADR 0055 — Console cue polish

Status: proposed for RC#3 (0.2.3). Scope: cue polish only, as requested by Johann.

Text spans use transparent backgrounds so the whole-line cue is visible behind the text. Transparent 6px side borders provide a gutter beyond the 3px inset outline, preventing contact with the first glyph across browser engines without changing authored whitespace. Copy remains a separate control with its existing appearance and exact value. The legacy Git Player is outside this scope.

The brighter flash retains its 24% limn tint. Dim target text temporarily takes the normal Console text color during the flash, then returns to dim. A 12% quiet tint keeps dim text readable in Light as well. Browser sampling verifies at least 4.5:1 text contrast in flash and settled states for all three themes. These are transient focus cues, not category colors or an author palette.

Retain cue timing, theme palettes, neutral keyboard focus, reduced-motion handling, repeat clicks, paused operation and mobile admission. Browser geometry proofs cover transparent text and outline/glyph clearance across themes; mutation guards reject opaque text backgrounds, absent gutters and lost dim-text contrast.

The wrapped-line continuation collision is deferred and retains its expected-failure proof. This checkpoint adds no wrap binding and leaves renderer code, lessons, engine identity and authoring formats unchanged.
