# ADR 0048: Teaching-First Console Presentation and Authored Limn Emphasis

Status: Accepted. Part A lands with the visual stylesheet (roadmap step 11, before RC#2). Parts B and C are implemented after RC#2.

Date: 2026-10-03

## Context

Code in Motion is a teaching tool first and a terminal simulation second. Real shells color everything they can: prompts, branch names, file states, diff lines. That serves an expert scanning for status, but it trains a learner's eye on decoration. CiM should do the opposite: everything plain by default, with emphasis reserved for the one piece of a command or its output that the lesson is about.

The approved mock-ups (v0.2, v0.3) inherited terminal coloring from the original GIF: a multi-color prompt, and amber, red, and green output lines. Decision V1 (CONSOLE-RENDERER-v1 §4.7) already reduced the prompt to one color. This ADR completes the move.

ADR 0045 makes `wordpress/assets/cim.css` the sole presentation authority and forbids any public theming interface. It explicitly reserves a governed configuration path for future work (ADR 0045 Decision 9). This ADR's relationship to ADR 0045 is set out in Decision 21.

Authoring JSON v1 §20 already says "if everything calls for attention, nothing receives attention." Emphasis today is line-level only: output tones and the focus relationship. Neither can mark a word *inside* a command, such as `--hard` in `git reset --hard HEAD~1`. That word is usually the lesson.

## Decision

### Part A: Teaching-first presentation (stylesheet; no contract change)

1. **Principle.** The Console and Explanation never imitate shell coloring. Color and motion are reserved for teaching information: the authored emphasis (Part B), focus, and risk.
2. **Backgrounds.** Both the Console pane and the Explanation pane use a black background, `#000000`.
3. **Console text.** The prompt, commands, output, and responses use one light blue, `#7CB7FF` (10.07:1 on black, AAA). The prompt has no separate color. Pure blue `#0000FF` is excluded: at 2.44:1 it fails WCAG.
4. **De-emphasis.** Lines authored with tone `dim` render in a muted blue, `#6F93C2` (6.63:1, AA). Quieting secondary material is consistent with the principle.
4a. **Output tones render plain blue.** `accent`, `added`, `removed`, and `warning` keep their semantic values in authored and compiled data, but carry no permanent hue: they render in console blue (`#7CB7FF`). Focus, limn, and risk are the only visual emphasis.
4b. **Tone must be redundant with text.** Because no hue will carry a tone's meaning, every line with a non-normal tone must state that meaning in its own text (such as a diff `+` or `-`, or `modified:`) or under its section header line (such as `Untracked files:`). Under that rule, removing hue removes no information for any user, including screen-reader users. `console/v1` output lines carry `data-tone` but no accessible label, so this redundancy is what makes plain blue safe. An experience that cannot satisfy it requires an accessible tone representation in renderer DOM. That is a CONSOLE-RENDERER §4 refinement, adopted through reviewed evidence regeneration with lineage (§7), not by CSS.
5. **Explanation prose.** Off-white `#E6E9EF` (17.27:1, AAA), with secondary text in `#A9B1BD` (9.71:1, AAA). Blue for what the machine shows and off-white for what it means keeps the panes distinct without decorative color.
6. **Risk remains colored.** Risk is teaching information, not simulation. The badge and gutter marks keep their color, all AAA on black:

   | Level | Color | Contrast |
   |---|---|---|
   | FREE TO UNDO | `#7BD88F` | 12.06:1 |
   | LEAVES A TRACE | `#F2B35B` | 11.37:1 |
   | CANNOT BE UNDONE | `#FF7A7A` | 8.32:1 |

7. **Canonical evidence.** Part A is CSS only, keyed to existing attributes (`data-role`, `data-tone`, `data-risk`, `data-focused`). For experiences satisfying Decision 4b, which includes the Git specimen, it changes no renderer DOM, so the protected `console/v1` digests do not move.

### Part B: Authored limn emphasis (Authoring v2, `console/v2`)

8. **What a limn is.** A limn is a brief white outline (`#FFFFFF`) around an authored word or phrase, which then fades back to plain text. Its behavior (outline, fade, residual, and timing) is a single Player-owned style applied identically everywhere; only its color is configurable (Part C, `theme.console.limn`). Authors identify only *what* to limn, never how it looks.

9. **Schema.** A new authoring version, `localis.cim/authoring/v2`, adds one optional field to Explanation segments:

   ```json
   {
     "at": "command",
     "text": "reset --hard moves main back one commit and overwrites both the index and the working tree.",
     "limn": [{ "target": "command", "phrase": "--hard" }]
   }
   ```

   Each limn entry has three fields:

   | Field | Required | Meaning |
   |---|---|---|
   | `target` | yes | `"command"` for the beat's command, or the `id` of an output line in the same beat |
   | `phrase` | yes | The exact text to limn: a non-empty, single-line, case-sensitive substring of the target |
   | `occurrence` | only if the phrase occurs more than once in the target | Which occurrence to limn, numbered from 1 |

   The limn belongs to the segment because the segment supplies its timing: it fires when the Explanation begins discussing the phrase.

10. **Validation** (new `CIM-AUTH-*` diagnostics):

    | Diagnostic | Error when |
    |---|---|
    | `CIM-AUTH-LIMN-TARGET` | `target` is neither `"command"` nor an output id in the same beat |
    | `CIM-AUTH-LIMN-PHRASE-ABSENT` | the phrase does not occur in the target |
    | `CIM-AUTH-LIMN-AMBIGUOUS` | the phrase occurs more than once and `occurrence` is missing (never guessed) |
    | `CIM-AUTH-LIMN-OCCURRENCE` | `occurrence` is out of range |
    | `CIM-AUTH-LIMN-FUTURE` | an output target is limned from a `command` segment, before that output has appeared |
    | `CIM-AUTH-LIMN-OVERLAP` | two limns on the same target within one beat resolve to overlapping or nested ranges, or one segment limns the same range twice. Adjacent ranges are allowed. |
    | `CIM-AUTH-LINT-LIMN-BREADTH` (warning) | a segment has more than two limns |

    The existing rules for tabs, line breaks, and duplicate keys apply unchanged.

    **Why overlap is checked across the beat.** `<mark>` elements persist in stable output after their segment passes, so overlap is checked across every limn on the same target in the beat, not only within one segment. Crossing or nested marks have no unambiguous DOM construction, and the compiler fails closed rather than choosing one. A *later* segment that limns exactly the same range as an earlier one does not create a second mark. It re-activates the existing mark, which the compiler records explicitly as one mark owned by both segments. Within a single segment, a duplicate range is an error, never silently deduplicated.

11. **Compilation.** The compiler resolves each phrase to exact character offsets in the target text, so the renderer never searches strings. It emits them into Console state, failing closed on anything it cannot resolve. Authors keep writing phrases; offsets are a compiler output.

12. **Renderer contract.** The limn adds state to CONSOLE-RENDERER §3, so under its §7 rule it requires a new renderer identifier, `console/v2`. In stable output, each limned phrase is wrapped in a `<mark data-limn>` element. `<mark>` is the correct semantic element for relevant or highlighted text, and it preserves that relevance in the markup. Most screen readers, however, do not announce `<mark>` in their default configuration, so the markup alone does not satisfy Authoring §21. Any audible announcement of a limn is a separately specified accessibility behavior, verified in Part B; it is not assumed from `<mark>`. The outline, fade, and residual are renderer presentation layered on that markup.

13. **Lifecycle and timing.** A limn goes through four phases:
    1. **Full outline** when its segment is revealed.
    2. **Fade** over a renderer-owned standard of **1,200 presentation ms**.
    3. **Subtle residual mark** while its segment remains the active segment.
    4. **Clear** when the active segment advances.

    - **Re-exposure.** Hovering or keyboard-focusing that segment in the Explanation re-exposes the full limn. This is learner-driven historical emphasis (Authoring §14), and it never scrolls the Console.
    - **Clock.** The fade runs on the presentation scheduler (ADR 0047 Decision 3): pause freezes it, and playback rate scales it.
    - **Reduced motion.** The outline appears without animation and gives way to the residual at the same presentation time.
    - **Settled output.** The residual-or-clear state is a pure function of the destination boundary. A boundary's own segment's limns carry `data-limn-active`; earlier segments' limns do not. The fade is animation path only, and settled output never depends on where the fade had reached.
    - **No authored timing.** Authors never control limn duration. A future change to the 1,200 ms standard is a renderer-owned presentation constant.

14. **Versioning.**
    - Authoring v1 remains valid, and the compiler accepts both v1 and v2 sources.
    - `console/v1` remains the renderer for v1 experiences, and its oracle stays protected.
    - Part B alone changes no runtime schema, because Console state is opaque to Core. Part C does: the compiled palette needs a home in a closed runtime `presentation` object, which requires a new runtime schema version, `localis.cim/v3` (Decision 19).
    - Authoring v1 sources continue to compile to `localis.cim/v2`, byte-identically to today. Authoring v2 sources compile to `localis.cim/v3`.
    - `console/v2` receives its own canonical evidence file, beginning with a recompiled Git specimen.

### Part C: Configurable palette (Authoring v2, `localis.cim/v3`)

15. **Authoring shape.** Authoring v2 adds an optional `presentation.theme`, owned per experience:

    ```json
    "presentation": {
      "layout": "console-explanation",
      "theme": {
        "console":     { "background": "#000000", "text": "#7CB7FF", "muted": "#6F93C2", "limn": "#FFFFFF" },
        "explanation": { "background": "#000000", "text": "#E6E9EF", "muted": "#A9B1BD" }
      }
    }
    ```

    - Every color field is optional, and authoring is sparse: `"theme": { "console": { "text": "#90C5FF" } }` overrides one value and keeps every other default.
    - An absent `theme` resolves to the ADR 0048 palette in full.
    - The `theme`, `console`, and `explanation` objects are closed; unknown keys fail as `CIM-AUTH-UNKNOWN-FIELD`.

16. **Themes change color, never grammar.** The theme may set only the seven colors above. The grammar is fixed: machine text in the Console, prose in the Explanation, a muted variant of each, consequence colors for risk, and temporal limn emphasis. An author cannot:
    - color commands, prompts, or output independently of each other;
    - color an individual Explanation segment;
    - change risk colors;
    - change limn duration, lifecycle, or behavior.

    The palette is configurable; decorative terminal coloring stays closed.

17. **Risk colors are fixed.** `#7BD88F`, `#F2B35B`, and `#FF7A7A` carry stable consequence semantics across every CiM experience and are not author-configurable. Because an author may change the Console background, compilation verifies them against it (Decision 18).

18. **Validation.** All checks run at compile time and fail closed.

    | Check | Requirement | Diagnostic |
    |---|---|---|
    | Format | `#RRGGBB`, case-insensitive on input; the compiler emits uppercase | `CIM-AUTH-THEME-HEX` |
    | Console `text` and `muted` against Console `background` | ≥ 4.5:1 (WCAG AA) | `CIM-AUTH-THEME-CONTRAST` |
    | Explanation `text` and `muted` against Explanation `background` | ≥ 4.5:1 (WCAG AA) | `CIM-AUTH-THEME-CONTRAST` |
    | `limn` against Console `background` | ≥ 3:1 (WCAG non-text contrast) | `CIM-AUTH-THEME-CONTRAST` |
    | Each fixed risk color against Console `background` | ≥ 4.5:1 | `CIM-AUTH-THEME-CONTRAST` |
    | `limn` against Console `text` | ≥ 1.5:1 | `CIM-AUTH-THEME-CONTRAST` |

    - **The last row is a CiM rule, not a WCAG criterion.** WCAG defines no limn-versus-text pairing, so this is an internal differentiation threshold. It prevents an outline nearly indistinguishable from the text it surrounds. The default white limn against `#7CB7FF` measures 2.08:1.
    - **Diagnostics are actionable.** Each `CIM-AUTH-THEME-CONTRAST` names the failing pair and the measured ratio.
    - **Arithmetic.** Contrast uses the WCAG 2.x relative-luminance formula. Thresholds compare unrounded ratios.

19. **Compiled output is complete.** The compiler resolves every theme to the full seven-color palette, with defaults filled in, and emits it as `presentation.theme` in `localis.cim/v3`. Field order is fixed and colors are uppercase, so equal palettes compile byte-identically.
    - Authoring v2 always compiles to `localis.cim/v3` with a complete palette, whether or not a theme was authored.
    - Runtime and Player therefore consume one frozen, complete object and implement no per-field fallback. Replay has one canonical presentation configuration.
    - `localis.cim/v3` is `localis.cim/v2` plus a required, closed `presentation.theme`.
    - Runtime validation checks completeness, the hex format, and the Decision 18 thresholds again at ingestion. Even a hand-assembled v3 document cannot carry an unreadable palette into production.

20. **Application is Player-level and per instance.** The Host applies the resolved palette as CSS custom properties on that instance's Player container, never on `:root` or any other shared ancestor. Two CiM instances on one page can therefore carry different palettes without interfering:

    | Property | Source |
    |---|---|
    | `--cim-console-background` | `theme.console.background` |
    | `--cim-console-text` | `theme.console.text` |
    | `--cim-console-muted` | `theme.console.muted` |
    | `--cim-limn` | `theme.console.limn` |
    | `--cim-explanation-background` | `theme.explanation.background` |
    | `--cim-explanation-text` | `theme.explanation.text` |
    | `--cim-explanation-muted` | `theme.explanation.muted` |

    - The Console and Explanation stylesheets consume these variables. Risk colors remain fixed in the stylesheet.
    - Renderer DOM never contains palette values, so canonical evidence is theme-independent, for `console/v1` and `console/v2` alike.
    - A `localis.cim/v1` or `localis.cim/v2` document carries no theme. The Host still declares all seven properties on that instance's container, with the ADR 0048 palette values, selected as a whole by document version.
    - `cim.css` never relies on `var()` fallback values or on inheritance from outside the container to obtain palette colors. Every instance container declares all seven properties itself, so a `--cim-*` value declared on `:root`, `body`, or any page ancestor can never reach a CiM instance.

### Relationship to ADR 0045

21. **Part A stays within ADR 0045. Part C amends ADR 0045's custom-property implementation boundary for all CiM instances, and exposes configurable palette authoring only through `localis.cim/v3`.**

    **Part A stays inside ADR 0045's fixed-presentation model.** It changes only the values `cim.css` declares (backgrounds, text, muted, and risk colors). `cim.css` remains the sole presentation authority (0045 Decision 1), and Part A introduces no theme interface. Part A uses ordinary literal declarations and introduces **no** `--cim-*` custom properties, preserving ADR 0045 Decision 8 until Part C governs that seam.

    **Part C amends ADR 0045 in two distinct scopes.** It activates the path ADR 0045 Decision 9 reserved, and does not overturn ADR 0045.
    - **For all instances, ADR 0045 Decision 8 is superseded once Part C lands.** Every instance container (v1, v2, and v3) receives the seven Host-owned `--cim-*` properties (Decision 20). They are an implementation mechanism, not a public API: set only by the Host, and only on an instance container.
    - **For `localis.cim/v3` only, ADR 0045 Decision 9's governed configuration path is activated.** The supported theming interface is the validated Experience JSON (`presentation.theme`, Decisions 15–19), and v3 instances receive their compiler-validated palette.
    - **Legacy v1 and v2 documents remain non-configurable.** They receive the fixed ADR 0048 palette through the same seven Host-owned instance properties, and gain no author theme surface.

    **Boundaries ADR 0045 established that Part C preserves:**
    - **Arbitrary page CSS is still not a supported theming API.** ADR 0045 Decisions 2 and 11 are unchanged: CSS with sufficient specificity or `!important` remains outside the contract, and no documented external selectors are introduced.
    - **`cim.css` still owns the styling rules.** The Host supplies validated palette *values* to those rules on the instance container. The Host gains no other presentation authority (0045 Decision 12), and the renderer and Transport boundaries (0045 Decisions 13 and 14) are unchanged.
    - **Only the Console and Explanation colors become configurable.** In ADR 0045's internal vocabulary (Decision 7), that is panel foreground and surface. Structural borders, focus indication, control foreground and surface, lane surfaces, spacing, and radii remain fixed CiM-owned declarations.

    **How Part C meets ADR 0045 Decision 9's six requirements:**

    | Requirement | Part C answer |
    |---|---|
    | Scope | Seven colors (Decision 15), Console and Explanation only. Risk colors and all other presentation stay fixed (Decisions 16 and 17). |
    | Fallback values | No CSS fallback. The compiler emits a complete palette (Decision 19), and legacy documents receive the ADR 0048 palette declared explicitly (Decision 20). |
    | Inheritance | None from outside. Every instance container declares all seven properties itself, so page-level `--cim-*` declarations cannot reach an instance (Decision 20). |
    | Compatibility | v1 and v2 documents retain the fixed ADR 0048 palette and gain no author theme surface; they receive it through the same seven Host-owned properties. `console/v1` evidence is unchanged, because renderer DOM never carries palette values. |
    | Isolation | Per-instance containers and multi-instance proof (Decision 20, Verification). |
    | Browser evidence | ADR 0045's dark-host and hostile-host checks, extended to themed instances and to hostile `--cim-*` declarations (Verification). |

## Resolved questions (peer review)

1. **Output tones:** plain blue, with semantic values retained in data and the redundancy rule (Decisions 4a and 4b).
2. **Residual mark:** yes, but only while the limn's segment is active. It clears when the segment advances, and hover re-exposes the full limn (Decision 13). An indefinite residual would accumulate over a lesson until emphasis again competed with itself.
3. **Duration:** 1,200 presentation ms as the initial standard, renderer-owned with no authoring control (Decision 13).

4. **Configurable palette (Part C):** settled as Decisions 15–20. In summary:
   - per-experience authoring under `presentation.theme`, with fixed risk colors;
   - Player-level, instance-scoped application;
   - a complete compiled palette;
   - a new runtime schema version rather than widening the closed v2 contract;
   - compile-time contrast validation, including the internal 1.5:1 limn differentiation threshold.

## Remaining open item

- **Audible limn announcement.** The mechanism is specified and verified in the Part B implementation (Decision 12) with real screen readers. This ADR deliberately chooses no mechanism, `aria-live` included, before that testing, because unsolicited announcements can add noise rather than guidance.

## Consequences

- Part A brings the shipped look in line with the teaching-first principle before RC#2, with no contract change and no oracle movement.
- Part B gives authors one simple, validated setting for the most important pedagogical act: pointing at the word that matters.
- Part C makes the palette configurable per experience without reopening decorative coloring, and without letting any author publish an illegible combination. It introduces `localis.cim/v3`, a deliberate, versioned widening of the runtime contract rather than an in-place change to closed v2. It supersedes ADR 0045 Decision 8 for all instances, through seven Host-owned instance properties, and activates ADR 0045 Decision 9's governed configuration path for v3 only (Decision 21). The theming interface is governed JSON, legacy documents stay non-configurable, and `cim.css` remains the sole styling authority.
- Mock-ups v0.2 and v0.3 no longer represent the target palette. They remain valid for layout and interaction.

## Verification

**Part A:**
- The stylesheet uses only the colors in Decisions 2–6, and every pairing meets its stated WCAG level.
- Every registered experience satisfies Decision 4b. For the Git specimen, the four non-normal-tone lines are recorded with their textual markers: `modified:` and `Untracked files:` (warning), and diff `-` and `+` (removed, added).
- The `console/v1` canonical evidence is byte-identical before and after the stylesheet lands.

**Part B:**
- Each validation rule has a single-violation fixture producing exactly its diagnostic. The overlap fixtures cover a crossing range, a nested range, and an identical range within one segment (each an error), an adjacent range (valid), and an identical range re-activated by a later segment (valid, one mark).
- Compiled offsets select exactly the authored phrase, for both command and output targets.
- The limn appears at its segment's boundary and fades over 1,200 presentation ms. It freezes under pause and scales under 0.5× and 2×. The residual holds while the segment is active and clears when the segment advances. Hover re-exposes the full limn without Console scrolling. Under reduced motion there is no animation.
- All `console/v2` arrival paths converge to its canonical evidence.
- Each limned phrase is wrapped in `<mark data-limn>`. The separately specified audible announcement is verified with assistive technology rather than assumed from the markup.
- v1 sources still compile to byte-identical `console/v1` output.

**Part C:**
- **Validation.** Each Decision 18 row has a failing fixture producing `CIM-AUTH-THEME-CONTRAST` and naming its pair, including a custom background on which a fixed risk color drops below 4.5:1, and a limn that passes 3:1 against the background but falls below 1.5:1 against the text. Malformed values produce `CIM-AUTH-THEME-HEX`, and unknown theme keys produce `CIM-AUTH-UNKNOWN-FIELD`.
- **Completeness and determinism.**
  - A sparse theme compiles to the complete palette with defaults filled in.
  - An absent theme compiles to exactly the ADR 0048 palette.
  - Mixed-case input compiles to uppercase, and equal palettes compile byte-identically.
  - Authoring v1 sources still compile byte-identically to `localis.cim/v2`.
- **Runtime validation.** A v3 document with a missing color, a malformed color, or a below-threshold pair is rejected at ingestion.
- **Multi-instance isolation.** Two Players mounted on one page with different valid themes:
  - each container carries exactly its own resolved custom properties;
  - nothing is written to `:root` or any shared ancestor;
  - both renderers converge on identical canonical evidence for the same destination, proving palette independence of renderer output.
- **Legacy documents.** v1 and v2 documents render with the ADR 0048 palette, declared explicitly on each instance container.
- **ADR 0045 traceability (browser evidence).**
  - ADR 0045's verification items remain green for default and themed instances alike: dark host context, realistic hostile host foreground and background rules, focus indication, responsive layout, and multiple-invocation isolation.
  - **Hostile `--cim-*` declarations.** A page declaring every `--cim-*` property on `:root`, `body`, and an ancestor of the Player alters no CiM instance. Computed Console and Explanation colors equal each instance's compiled (or legacy default) palette, and this holds for v1, v2, and v3 instances.
  - **Custom-property scope.** ADR 0045's item "no public theming custom-property surface is introduced" is replaced, for v1, v2, and v3 instances alike, by a narrower check. The only `--cim-*` declarations in the composed page are exactly seven per instance container, all made by the Host:
    - v1 and v2 instances use the fixed ADR 0048 palette;
    - v3 instances use the validated `presentation.theme`;
    - no documented page-CSS theming selector exists.
