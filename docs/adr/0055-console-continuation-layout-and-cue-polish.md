# ADR 0055 — Console continuation layout and cue polish

Status: proposed for RC#3 (0.2.3).

The Player must distinguish a soft-wrapped continuation from a new authored line while preserving all authored spaces and copy text. Fixed 2ch hanging indentation collides with output lines beginning with two spaces. The Player now derives a per-line continuation indent from rendered leading spaces plus 2ch. Console text is single-line and excludes tabs under CONSOLE-RENDERER-v1; no tab expansion rule is needed.

The existing renderer-change observer refreshes layout before pane follow geometry. A small disposable Player binding projects only a presentation custom property and restores its previous value when disposed. Renderer source, canonical output, authoring schemas, lesson bytes and engine identity do not change. This resolves the known collision recorded in ADR 0050; its former expected-failure browser proof now must pass.

Text spans use transparent backgrounds so the line cue is visible behind them. Transparent 6px side borders provide a gutter beyond the 3px inset outline, preventing contact with the first glyph without changing authored whitespace. Copy remains a separate control with its existing appearance and exact value. The legacy Git Player is outside this scope.

Retain all three theme palettes, keyboard focus, reduced-motion handling, cue timing and mobile admission. Browser geometry proofs cover multiple indents and all themes; mutation guards reject opaque text backgrounds, absent gutters, fixed continuation indentation and missed disposal cleanup.

The brighter flash retains its 24% limn tint. Dim target text temporarily takes the normal Console text color during the flash, then returns to dim. A 12% quiet tint keeps dim text readable in Light as well. Browser sampling verifies at least 4.5:1 text contrast in the flash and settled band for all three themes. These are transient focus cues, not category colors or an author palette.
