# ADR 0056 — Console continuation indentation

Status: proposed; separate checkpoint after live 0.2.3.

The Console Player derives each line's continuation indentation from its rendered leading spaces plus two character widths. A line beginning with two authored spaces therefore wraps to four character widths, beyond its first non-space character. Authored spaces, text, lesson data and Copy values remain intact.

The Player applies a presentation-only custom property before refreshing pane scrolling. Existing renderer mutation observation refreshes the value when text or nodes change. Disposal restores each surviving line's prior property and stops further updates. The renderer and legacy player retain their existing contract and styling.

This resolves the fixed 2ch collision deferred by ADR 0055. The former expected-failure browser assertion now must pass. Additional browser geometry coverage exercises zero, two, four and eight leading spaces, renderer text replacement, transparent cue backgrounds and disposal. Unit checks cover newly rendered nodes and restoration. Mutation guards reject fixed indentation and missing cleanup.

QA: run full verification, all Player browser cases in Chromium, Firefox and WebKit, and all Player mutation guards. Preserve the 0.2.3 cue, mobile gate, engine identity and lesson formats. Release packaging, tag and live installation remain a separate reviewed step.
