# Code in Motion Authoring JSON Specification v1

Status: v1.0 frozen (R42). Changes to the authoring contract require a new schema identifier.
Schema identifier: `localis.cim/authoring/v1`
Implementation: `authoring/v1/validate-authoring.mjs`. Compilation: `docs/AUTHORING-TO-RUNTIME-v1.md` (A2R).

## 1. Contract principles

A Code in Motion experience is an authored sequence of beats. Each beat binds Console activity to its corresponding Explanation content. The Player owns timing, typing simulation, scrolling, focus presentation, navigation, copying, risk presentation, and accessibility behavior.

The JSON describes semantic content and relationships. It does not prescribe animation mechanics, DOM structure, CSS, or implementation-specific rendering.

Authoring documents are build-time sources. They are compiled into `localis.cim/v2` runtime documents (A2R). Runtime and WordPress never consume authoring JSON.

The v1 schema is closed. Every permitted property is defined by this specification, and an unrecognized property is a validation error. Extensions require a later schema contract.

An object that repeats a key is invalid. Duplicate keys are detected before ordinary JSON parsing, because a parser would silently discard all but one value.

## 2. Root object

```json
{
  "schema": "localis.cim/authoring/v1",
  "id": "git-repository-practice",
  "title": "Git Repository Practice",
  "description": "...",
  "subject": "git",
  "version": "1.0.0",
  "console": {},
  "presentation": {},
  "beats": []
}
```

These are the complete permitted root properties, and all are required.

- `beats` must contain at least one beat.
- `version` must be Semantic Versioning text (for example `1.0.0`). It becomes the compiled `experience_version`.
- `subject` is descriptive metadata. It does not select renderer behavior.
- `description` is the opening entry in the Explanation transcript before the first beat begins. Presenting it creates no semantic boundary.

## 3. Identifiers

Experience, beat, and output identifiers use lowercase kebab case:

```
^[a-z0-9]+(-[a-z0-9]+)*$
```

- Beat ids must be unique within an experience.
- `initial` is reserved for the runtime's pre-instruction boundary and may not be used as a beat id.
- The pattern cannot produce `--`, so authored beat ids never collide with compiler-generated runtime identifiers (`{beat-id}--sNN`, A2R §6).
- Output ids, when supplied, must be unique within the experience. They exist to establish focus relationships.

## 4. Console defaults

```json
"console": {
  "title": "git — localis/handbook",
  "prompt": "~/localis/handbook (main) $"
}
```

- `title` is optional. For the Git reference experience, the canonical lineage title is `git — localis/handbook`.
- `prompt` sets the experience-level prompt. A beat may override it.
- The experience-level prompt may be omitted only when every beat supplies its own prompt.

## 5. Presentation

```json
"presentation": {
  "layout": "console-explanation",
  "defaultPlaybackRate": 1
}
```

`layout` is required. v1 recognizes `console-explanation`, which compiles to the canonical Console renderer `console/v1`.

`defaultPlaybackRate` is optional and defaults to `1`. It must be a number from 0.5 through 2.0 inclusive.

Playback rate scales authored presentation timing: typing, output reveal, explanation reveal, dwell, and scrolling animation. Interactive controls remain immediate.

> R42 removed `explanationTitle`, `showCopy`, and `showRisk`. They are Player preferences with no runtime representation, so authoring them is now an unknown-field error.

## 6. Beat structure

```json
{ "id": "stage-hunk", "console": {}, "explanation": {} }
```

`id`, `console`, and `explanation` are required. The complete permitted set is `id`, `dwell`, `console`, `explanation`, and `risk`.

`dwell` is optional: a non-negative integer number of milliseconds. It is the post-settle dwell on the beat's final boundary, at 1.0×. When it is omitted, the compiler supplies 1600 ms. Boundaries inside a beat dwell 900 ms (A2R §11).

## 7. Beat Console

```json
"console": {
  "prompt": "...",
  "command": "git add -p -- src/HeaderFix.jsx",
  "copy": "...",
  "typing": true,
  "output": [],
  "response": "y"
}
```

- `command` and `output` are required. `prompt`, `copy`, `typing`, and `response` are optional.
- `typing` defaults to `true`.
- `prompt` overrides the experience-level prompt for that beat.
- `copy`, when present, must be a non-empty string. It is the exact value copied instead of `command`.

## 8. Output

```json
{ "id": "hunk-added", "text": "+  const scope = props.scope ?? 'col';", "tone": "added" }
```

`text` and `tone` are required; `id` is optional. Recognized tones are `normal`, `dim`, `accent`, `added`, `removed`, and `warning`.

- Tone communicates persistent semantic meaning. It must not be used merely because a line is temporarily relevant to an Explanation segment; that is the job of focus (§13).
- `normal` is the authoring default in principle, although tone remains explicit in the JSON.
- `dim` reduces visual noise for secondary material.
- `accent` remains available but should be rare.

## 9. Console text: whitespace, tabs, and line breaks

These rules apply to Console text fields: output `text`, `command`, the experience and beat `prompt`, `response`, and `copy`.

- Each is a single line. Line breaks (CR, LF, U+2028, U+2029) are prohibited, because one output entry is exactly one line with one tone.
- Tab characters are prohibited. Authors use spaces where terminal alignment matters.
- Leading and internal spaces are significant and render as authored.
- Trailing whitespace may remain in authored data but must not affect layout. The Player supplies any separator between an interactive prompt and its response; authors must not depend on trailing spaces to position a response.

## 10. Explanation

```json
"explanation": { "heading": "Stage one change at a time", "segments": [], "references": [] }
```

- `heading` and `segments` are required; `references` is optional.
- Every Explanation must contain at least one segment.
- A completed beat appears in the transcript in this order: heading, segments, risk guidance, references.

## 11. Explanation segments

```json
{ "at": "output", "text": "This hunk replaces the hard-coded scope with a prop that falls back to the old value.", "focus": ["hunk-removed", "hunk-added"] }
```

`at` and `text` are required; `focus` is optional. Recognized anchors are `command`, `output`, and `response`.

- Segments must occur in semantic order: `command`, then `output`, then `response`. Multiple segments may share an anchor.
- An `output` segment requires non-empty Console output. A `response` segment requires `console.response`.
- **Final-anchor rule.** The beat's final segment must be anchored to the beat's last Console phase: `response` when the beat has a response, otherwise `output` when output is non-empty, otherwise `command`. The final segment's runtime boundary is therefore the beat's complete, settled destination, with no settled step manufactured (A2R §3, §5).
- Each segment compiles to exactly one runtime semantic boundary. A beat may hold at most 99 segments (A2R §6).

## 12. Simulated responses

`console.response` represents an authored simulated response to an interactive Console prompt.

- A response requires preceding output. The final output entry is author-declared to represent the interactive prompt. Static validation verifies only that output exists; whether the final line really is an interactive prompt is an authoring responsibility.
- The Player appends the response using a Player-supplied separator.
- Previous, seek, and scrub restore the response state deterministically. Seeking to the waiting state shows the prompt without the response; seeking beyond it restores the response.

## 13. Focus

Output lines may carry ids so that Explanation segments can identify the evidence they describe. Rules:

- Every focus target must resolve to an output id.
- Focus is limited to output in the same beat in v1.
- Focus must not reference evidence that has not appeared yet. Consequently, a `command` segment cannot focus output.
- One segment may focus multiple targets. More than three produces a lint warning, not an error.

Focus is a semantic relationship, not an authored animation. It compiles to runtime `commentary.evidence` and corresponding renderer focus state (A2R §9).

## 14. Focus lifecycle

A segment's focus is visible while that segment is the newest revealed segment at the current semantic position.

- Focus ends when the next segment appears.
- **Focus on a beat's final segment persists until the semantic position changes.** The final segment's boundary is the settled destination, so there is no later settlement step to clear it.
- Pause freezes the current focus state.
- Navigation restores the focus that belongs to the destination boundary. A destination whose segment has no focus shows none.
- Playback rate does not alter focus semantics.
- Learner-driven historical focus may re-expose a relationship whose evidence is already visible. It must not scroll the Console to find that evidence.

## 15. References

```json
"references": [ { "label": "Git status documentation", "url": "https://git-scm.com/docs/git-status" } ]
```

- URLs must be absolute HTTPS URLs.
- Labels must describe their destination. v1 rejects these generic labels, case-insensitively: `click here`, `here`, `link`, `this link`, `this`, `more`, `read more`, `learn more`.
- References appear after the beat's Explanation is complete, on the final boundary, and remain available in the transcript history.
- Activating a reference pauses playback and opens the destination in a new tab with `noopener noreferrer`.

## 16. Navigation and scroll ownership

### 16.1 Navigation

Beats are the learner-facing coordinate (A2R §4):

- The counter shows the beat ordinal and the beat total. The rail shows one marker per beat.
- **Previous** and **Next** move by beat and land on the destination beat's final boundary.
- **Home** goes to `initial`. **End** goes to the final boundary of the final beat. **Restart** goes to `initial` and restarts playback according to the Player transport contract.
- Seek and scrub may resolve to an individual boundary. Commentary-entry activation may seek to an individual segment's boundary.
- Public deep links address beats as `#cim/{experience-id}/{beat-id}`, resolving to the beat's final boundary, or `#cim/{experience-id}/initial`.

### 16.2 Scroll ownership

Each pane, Console and Explanation, follows newly revealed content independently. The rules (A2R §16):

- **Scrolling away** from the newest content establishes learner ownership of that pane's viewport. New reveals never move a learner-owned viewport.
- **Pointer presence, keyboard focus, and an active text selection** within a pane are temporary holds. While a hold is in effect, new reveals do not move that pane, even if it is still following.
- **Following resumes only through explicit learner action:** returning to the newest content, or activating that pane's pending-content control. There is no automatic catch-up at beat boundaries.
- **Deliberate navigation** repositions semantic state and both panes, according to the navigation contracts. That covers Home, End, Restart, Previous, Next, seek, scrub, and Commentary-entry activation.
- **Pending-content labels:** while a pane is not following, new content is announced as "New output below" (Console) or "New explanation below" (Explanation).

## 17. Copy behavior

- Commands render as real, selectable text. The prompt is excluded from command copying.
- When `console.copy` is absent, Copy places the complete authored command on the clipboard. When it exists, Copy places that exact value on the clipboard, regardless of typing state.
- The confirmation must disclose the copied value. Visual truncation is allowed for long values, but the clipboard and the accessible announcement keep the complete value.

## 18. Risk

```json
"risk": { "level": "cannot-be-undone", "guidance": "Confirm the target commit in your own reflog and preserve uncommitted work before continuing." }
```

Recognized levels are `free-to-undo`, `leaves-a-trace`, and `cannot-be-undone`. Beats with no risk omit `risk`; there is no authored `none`. `level` is required and `guidance` is optional. There is no `label`; the Player derives it:

| Level | Displayed label |
|---|---|
| `free-to-undo` | FREE TO UNDO |
| `leaves-a-trace` | LEAVES A TRACE |
| `cannot-be-undone` | CANNOT BE UNDONE |

## 19. Visual semantics

| Channel | Meaning | Lifetime |
|---|---|---|
| Text tone | Semantic Console meaning | Persistent |
| Background focus band | Explanation-to-evidence relationship | Transient |
| Command gutter mark | Operation risk | Persistent in history |

Rules for the three channels:

- Tone must not provide transient focus.
- Focus must not change text tone, and must not dim unrelated Console content.
- Risk must not be encoded through output tone.
- Focus transitions take approximately 150 ms under normal motion settings and appear without transition under a reduced-motion preference.

## 20. Sparse emphasis

> If everything calls for attention, nothing receives attention.

Authors should default to `normal`. Tone is appropriate when color carries a semantic distinction in the lesson. Focus is appropriate when evidence matters only while a particular segment discusses it.

The validator emits a lint warning when more than 25 percent of a beat's non-blank output lines use `accent`, `added`, `removed`, or `warning`. Blank lines do not count toward the denominator. The warning does not invalidate an experience.

## 21. Accessibility

- Console and Explanation content must remain real text, and commands and explanatory prose must be selectable.
- Copy controls must be keyboard operable, and copy confirmation must be announced through an accessible live region.
- Focus relationships must have an assistive-technology representation equivalent to the visual relationship.
- Reference controls must remain keyboard accessible.
- A reduced-motion preference removes focus transition animation without removing focus information.

## 22. Validation contract

The validator rejects:

- malformed JSON and duplicate object keys;
- incorrect schema identifiers;
- missing required fields and unknown fields;
- empty beat collections;
- duplicate or malformed identifiers, and the reserved beat id `initial`;
- non-SemVer `version` values;
- missing Console or Explanation objects;
- empty Explanation segment collections;
- unknown anchors;
- incoherent anchor ordering, unmet anchor prerequisites, and final segments that do not reach the beat's last Console phase;
- missing or unknown output tones;
- tab characters or line breaks in Console text fields;
- `defaultPlaybackRate` values outside 0.5–2.0;
- unknown risk levels;
- malformed or generic references;
- invalid `copy` values;
- responses without preceding output;
- unresolved focus targets, cross-beat focus, and focus on future output.

Diagnostics use stable identifiers. Errors are `CIM-AUTH-<RULE>` and lint warnings are `CIM-AUTH-LINT-<RULE>`. These named rule codes are disjoint from the numeric phase codes used by the `.cim` front-end. Compiler failures use `CIM-COMP-*` (A2R §14). `DIAGNOSTICS` in `authoring/v1/validate-authoring.mjs` is the complete authoring inventory, and the fixture suite exercises every entry.

## 23. Post-v1 considerations

These are deliberately outside v1:

- cross-beat focus;
- span-level tones;
- learner-supplied responses;
- inline links in explanation prose;
- internal links that write Player state into the URL;
- a mobile-specific visual reference;
- authored Player presentation preferences (the removed `explanationTitle`, `showCopy`, and `showRisk`);
- structural sharing of compiled Console state, to bound quadratic growth with lesson length (CONSOLE-RENDERER-v1 §7).

## 24. Freeze gate

Authoring v1.0 freezes when:

- this text, the validator, the compiler, the fixtures, and the reference specimen agree;
- the reference specimen compiles and passes the three compiler proofs (compile-and-validate, determinism, and evidence correspondence);
- `check:authoring-v1`, `check:schema`, the v1 differential, and `verify` pass;
- no contract question remains unresolved.
