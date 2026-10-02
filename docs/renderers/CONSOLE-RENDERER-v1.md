# Console Renderer Contract v1 (`console/v1`)

Status: R42 normative, renderer-owned. Precedes implementation; no renderer exists yet.

## 1. Purpose and authority

`console/v1` is the canonical identifier of the subject-neutral Console renderer. The compiler selects it for `presentation.layout: "console-explanation"` (AUTHORING-TO-RUNTIME-v1 §12). `subject` never participates in that selection.

This document defines the renderer-owned meaning of `renderer_config`, `initial_state`, and step `state` for experiences that name `console/v1`. It specializes RENDERER-CONTRACT.md and does not replace any part of it.

**Authority boundary.** Core, Runtime, and the shared runtime validator treat Console state as opaque (EXPERIENCE-SCHEMA-v2 §9, §10). They never read, interpret, or validate it. This contract is enforced in exactly two places:

- the Console renderer's own validation (§6);
- compiler conformance, on the producing side (`authoring/v1`).

## 2. Renderer configuration

```text
renderer_config = { title?, prompt? }
```

| Field | Meaning |
|---|---|
| `title` | Console title-bar text (a string), for example `git — localis/handbook`. If absent, the title bar shows no title text. |
| `prompt` | Experience-level prompt: a non-empty single line. Required unless every transcript entry carries its own `prompt`. |

Both values are invariant across boundaries. The renderer defines no step-level `renderer_config` for `console/v1`; a step-level configuration object is a renderer validation failure.

## 3. State

```text
initial_state = { transcript: [], focus: [] }
state         = { transcript: [entry, ...], focus: [output-id, ...] }
```

Both keys are required. No other keys are permitted.

### 3.1 Transcript entry

| Field | Required | Meaning |
|---|---|---|
| `beat` | yes | Authored beat identifier that produced the entry. |
| `prompt` | no | The beat's prompt override: a non-empty single line. When absent, `renderer_config.prompt` applies. |
| `command` | yes | Displayed command text: a non-empty single line. |
| `copy` | yes | The exact clipboard value for the command, already resolved by the compiler (the authored `copy`, else the command): a non-empty single line. |
| `typing` | no | Present only as `false`: the command appears without typing animation. |
| `risk` | no | `free-to-undo`, `leaves-a-trace`, or `cannot-be-undone`. Drives the persistent historical gutter mark. |
| `output` | no | Present once the entry's output is revealed: a non-empty ordered array of `{ id?, text, tone }`. Absent, never empty, when there is nothing to show. |
| `awaiting_response` | no | Present only as `true`: an interactive prompt (the last output line) awaits its simulated response. |
| `response` | no | The simulated response, present once revealed: a non-empty single line. |

A *single line* contains no tab, CR, LF, U+2028, or U+2029, matching the authoring Console-text rule (AUTHORING-JSON-v1 §9).

Each output line has:
- `text`: a single line, possibly empty for a blank Console line. Leading and internal spaces are significant.
- `tone`: one of `normal`, `dim`, `accent`, `added`, `removed`, `warning`.
- `id`: optional, lowercase kebab case.

### 3.2 Invariants

1. `awaiting_response` and `response` never appear together, and both require a non-empty `output`.
2. Output `id` values are unique across the whole state.
3. Every `focus` id names an output line present in the same state's transcript.
4. `focus` is ordered and contains no duplicates.
5. State is absolute. It contains the entire visible transcript of the destination, so rendering never depends on earlier boundaries (RENDERER-CONTRACT §9).

The producing compiler guarantees these invariants. The renderer checks them (§6) and does not trust them.

## 4. Presentation obligations

1. **Real text.** Commands, output, and responses render as selectable DOM text, never as images or canvas (RENDERER-CONTRACT §10).
2. **Three visual channels.** Each channel carries exactly one meaning:
   - **Tone** colors text persistently.
   - **Focus** draws a transient background band behind the focused lines. It never changes text color and never dims other lines.
   - **Risk** draws a gutter mark on each command line that has `risk`, persistently in history.

   The title-bar badge shows the label derived from the `risk` of the **last transcript entry**, or no badge when that entry has none. Labels are derived from levels: `FREE TO UNDO`, `LEAVES A TRACE`, `CANNOT BE UNDONE`.
3. **Response separator.** The renderer supplies the separator between the interactive prompt line and the response. Authored trailing whitespace has no layout effect.
4. **Copy affordance.** Each command line renders an inert copy control carrying the entry's `copy` value as data. The renderer performs no clipboard write and no announcement. A Player-level handler outside the renderer owns both (R41 F8; Player clipboard/viewport authority contract).
5. **Timed presentation.** Typing, output reveal, and response entry run only on the transition-scoped clock facade (RENDERER-CONTRACT §6). The Player's playback rate dilates that clock (AUTHORING-TO-RUNTIME-v1 §11). Under reduced motion, and on non-animated arrival, the renderer settles directly to the destination.
6. **Viewport.** Scroll following, learner ownership, and holds are Player behavior (AUTHORING-TO-RUNTIME-v1 §16). The renderer exposes its scroll container but does not own scroll policy.
7. **Cursor and ready line.** These are derived presentation, not state. Every rendered state contains exactly one cursor. Its position is a pure function of the transcript's last entry `L`:

   | State | Ready line | Cursor |
   |---|---|---|
   | Transcript empty | yes, with `renderer_config.prompt` (omitted if absent) | in the ready line |
   | `L` has `output` and is not `awaiting_response`, or `L` has `response` | yes, with `L`'s effective prompt | in the ready line |
   | `L.awaiting_response` | no | after the interactive prompt line's text |
   | `L` has no `output` | no | after `L`'s command, which is pending execution |

   The ready line follows the last transcript entry. The cursor is an empty, `aria-hidden` element; blinking is a stylesheet concern, disabled under reduced motion. When the last entry has `risk`, the title bar carries the same level as `data-risk`, alongside the derived badge.

   - **Ready-line prompt (V3).** The ready line uses the last entry's effective prompt, because the next command's prompt is not knowable from state.
   - **Command-only beats (V2).** State cannot distinguish a pending command from a completed command that produces no output, so a completed command-only beat settles with the cursor after its command and no ready line. This is a documented v1 limitation; see §7.
   - **Single-color prompt (V1).** The prompt renders as one text run. Coloring prompt components would require either subject-specific parsing or a structured prompt; see §7.

## 5. Settlement equivalence

For any one destination state, every arrival path in RENDERER-CONTRACT §9 settles to canonically equivalent output. This holds whether the state is reached by playing through a beat's intermediate boundaries or by seeking directly to its final boundary.

## 6. Renderer-owned validation

Before its first render, the renderer validates `renderer_config` and every state it receives against §§2–3, including every §3.2 invariant. Any violation is a renderer validation failure (EXPERIENCE-SCHEMA-v2 §14, loadability condition 6). It is reported through the renderer fault path, never repaired.

## 7. Versioning and post-v1 considerations

Any change to §§2–3 requires a new renderer identifier (for example `console/v2`). Changes confined to §4 may retain `console/v1` when renderer-owned state semantics are unchanged. If such a refinement changes canonical output, the canonical evidence MUST be regenerated as a reviewed change and its supersession recorded in evidence lineage.

**Post-v1 presentation (visual-DOM audit).** Two items are deferred:
- **V1, structured prompts:** prompt components such as path, branch, and symbol, so the original multi-color prompt can be reproduced without subject-specific parsing.
- **V2, explicit completion:** a completion signal, so completed command-only beats can render a ready line.

Each changes §3 and therefore requires a new renderer identifier.

**Post-v1 scaling (R42-C5).** Absolute state repeats the accumulated transcript at every boundary, so document size grows quadratically with lesson length. The 18-boundary reference specimen compiles to 92 KB from a 13.5 KB source. Any structural-sharing representation is out of scope for v1. It would require a new renderer identifier and an explicit compiler change.
