# ADR 0054: Player CLI identity and command copying

Status: Proposed for review. Implements Issue #4; protected workflows must pass on the candidate head.

Date: 2026-10-13

## Decision

The Console Player owns CLI identity and clipboard interaction. Core, Runtime, and the Console renderer retain their existing authority and output contract.

Optional `presentation.command_window.cli` contains separate `kind` and `label` fields. Kinds are `powershell`, `windows-cli`, and `bash`; the visible label is a non-empty single line of authored text. The same field is accepted in authoring presentation metadata and copied deterministically into v2 presentation metadata. Unknown fields and unsupported kinds are rejected. Omitting it keeps older data valid and produces no badge. Legacy Git Players receive neither badge nor clipboard binding. The Git reference lesson explicitly identifies Bash; this is authored identity, not detection or an inference from prompt text.

The Player displays the real, selectable label in large text at the upper-right of the Console pane, outside the replaceable renderer viewport. Kind selects blue, red, or green respectively. Each learner preset defines accessible variants in the existing palette source; Windows forced colors uses system colors. Labels never select colors. All three badge colors meet a 4.5:1 contrast floor against each preset's Console background.

The renderer's existing inert Copy controls become visible under the Console Player. A delegated Player listener writes exactly their `data-copy` value using the native Clipboard API on explicit activation. It does not prepend prompts, read opaque state, issue semantic commands, intercept copy shortcuts, or attach selection/drag handlers. Renderer replacement preserves delegation. An authored copy override remains exact, including during typing, as required by AUTHORING-JSON-v1 §17.

A polite atomic status region discloses the complete copied value after a successful write. Missing Clipboard API, synchronous failure, and rejected permission provide manual native-selection guidance and the command value. There is no clipboard write fallback that commandeers the learner's selection. Removed Players withdraw the listener; asynchronous results are ignored after disposal, and older requests cannot overwrite newer status. A sibling Player remains independent.

Native text selection, Ctrl+C/Cmd+C, and context-menu copying keep browser/OS ownership. Commands, output, responses, Explanation, CLI label and copy announcements remain real DOM text. Copy-button labels themselves are excluded from text selection, so selecting commands does not append the button label.

## Verification

Headless checks cover authored/runtime validation, separate kind and label, optional metadata, deterministic compilation, immutable projection, exact clipboard value, rejection/missing API, stale completion ordering and disposal. Browser cases prove three-kind/three-theme colors, badge placement, real clipboard-to-text-field copying, an authored override, renderer replacement, native drag selection, unprevented copy/context-menu events, navigation invariance and sibling isolation. Native Clipboard API permissions/readback are proved in Chromium; Firefox and WebKit prove native selection/copy events and the denied-write path without substituting clipboard success. Protected WordPress source and installed ZIP tests exercise the actual Bash badge and clipboard control.

Engine capability version advances to 1.0.1 for the new CLI metadata and clipboard behavior. Compiler 1.0.1 emits `engine_min: 1.0.1` for lessons with CLI metadata; absent metadata keeps the existing 0.2.0 floor. Defensive compilation options cannot underdeclare the CLI minimum. Existing v1/v2 minima remain satisfied. This prevents the plugin release version from standing in for feature compatibility and avoids asking an older validator to accept a field it does not recognize.

This checkpoint does not change plugin version 0.1.11, lesson navigation, canonical Console renderer output, or live installation. RC#2 and the wording pass remain separate checkpoints. Optional metadata is additive; older v2 documents stay valid.
