# Code in Motion Experience Schema v2

Status: R42 normative candidate

Runtime schema identifier: `localis.cim/v2`

## 1. Purpose

`localis.cim/v2` is the additive runtime contract required by `AUTHORING-TO-RUNTIME-v1.md`. It preserves the v1 opaque-state boundary while adding learner-facing presentation metadata and beat grouping for compiler-generated semantic boundaries.

`localis.cim/v1` remains a valid legacy runtime contract for existing experiences. v2 does not reinterpret v1 documents.

## 2. Authority boundary

Core may inspect structural position and grouping metadata. Core must not inspect subject-specific `state` or `renderer_config`.

The selected renderer owns opaque state. Presentation metadata describes the experience; it does not contain executable behavior.

## 3. Top-level shape

```json
{
  "schema": "localis.cim/v2",
  "engine_min": "0.2.0",
  "experience_version": "1.0.0",
  "id": "git-repository-practice",
  "renderer": "console/v1",
  "renderer_config": {},
  "presentation": {
    "title": "Git Repository Practice",
    "description": "Eight commands take one change through a Git repository workflow.",
    "subject": "git",
    "beat_count": 8,
    "default_playback_rate": 1.0
  },
  "initial_state": {},
  "steps": []
}
```

## 4. Additions relative to v1

v2 adds three shared structural concepts:

1. required experience-level `presentation` metadata;
2. required `beat` grouping metadata on every step;
3. optional structured commentary semantics: `anchor`, `evidence`, and `risk` (§9).

All v1 fields otherwise retain their established meaning unless this document says otherwise.

## 5. Presentation metadata

`presentation` is required and closed.

Required fields:

- `title`: non-empty learner-facing experience title;
- `description`: non-empty opening Explanation text;
- `subject`: non-empty descriptive metadata with no recognized-value set;
- `beat_count`: positive integer count of authored learner-facing beats;
- `default_playback_rate`: number in the inclusive range 0.5 through 2.0.

Console title, effective default prompt, and other renderer-invariant settings belong in experience-level `renderer_config`, not repeated step state.

## 6. Step identifiers

v2 accepts ordinary canonical step IDs and compiler-owned segment IDs.

Compiler-owned IDs have exactly this form:

```text
{canonical-beat-id}--sNN
```

where `NN` is two decimal digits. The authoring compiler uses ordinals `01` through `99`; `00` is structurally recognizable but is semantically invalid and must be rejected by the runtime validator.

The reserved ID `initial` remains invalid in `steps`.

Existing v1 canonical IDs remain structurally valid in v2 so the schema does not make compilation the only possible v2 producer. A compiler-generated v2 experience, however, must use the compiler-owned form for generated segment boundaries.

## 7. Beat grouping

Every v2 step contains a required closed `beat` object:

```json
{
  "id": "stage-hunk",
  "ordinal": 2,
  "heading": "Stage one hunk",
  "segment_ordinal": 3,
  "segment_count": 4,
  "final": false
}
```

Fields:

- `id`: authored beat ID;
- `ordinal`: one-based learner-facing beat ordinal;
- `heading`: authored beat heading;
- `segment_ordinal`: one-based position of this boundary inside the beat, maximum 99;
- `segment_count`: total generated boundaries for the beat, maximum 99;
- `final`: true only on the beat's final generated boundary.

For compiler-generated experiences, runtime semantic validation must enforce:

- beat ordinals begin at 1 and form one contiguous sequence through `presentation.beat_count`;
- all steps for one beat are contiguous;
- one beat ID maps to exactly one ordinal and heading;
- segment ordinals begin at 1 and form a contiguous sequence through `segment_count`;
- every step in a beat reports the same `segment_count`;
- exactly one step per beat has `final: true`;
- the final step has `segment_ordinal === segment_count`;
- `presentation.beat_count` equals the number of distinct beats;
- compiler-generated step ID suffix `NN` equals `segment_ordinal` and may not be `00`.

## 8. Labels and markers

`label` remains required. For authoring-v1 compiled experiences, the compiler writes the authored beat heading into every generated step's `label`.

`marker` remains optional. Beat-oriented Player transport must derive its primary rail from beat grouping rather than interpreting one marker per generated segment.

## 9. Commentary and references

The v2 commentary object is closed. It retains the v1 `text` and `links` fields and adds three optional fields:

```json
{
  "text": "This hunk replaces the hard-coded scope with a prop that falls back to the old value.",
  "anchor": "output",
  "evidence": ["hunk-removed", "hunk-added"],
  "risk": { "level": "free-to-undo", "guidance": "git restore --staged src/HeaderFix.jsx removes the hunk from the index again." },
  "links": [{ "id": "ref-01", "label": "Git add documentation", "href": "https://git-scm.com/docs/git-add" }]
}
```

### `anchor`

Optional. One of `command`, `output`, or `response`: the Console phase the entry explains. For authoring-v1 compiled experiences it equals the authored segment's `at` value. Within one beat, anchors must not decrease (`command` → `output` → `response`).

### `evidence`

Optional. A non-empty array of unique canonical identifiers naming the Console evidence the entry discusses. For authoring-v1 compiled experiences it equals the authored segment's `focus` array.

`evidence` requires an `anchor`, and a `command`-anchored entry cannot carry evidence, because no output has appeared at that position.

`evidence` describes a relationship; it does not instruct the renderer. The renderer-owned focus representation needed to draw the boundary lives independently in opaque step `state`.

**Authority boundary.** Runtime validation checks the shape of `evidence` only. It never inspects opaque step `state` to resolve evidence identifiers, so a well-formed `evidence` array validates whether or not matching identifiers exist in state. Correspondence between `commentary.evidence` and renderer state is a compiler-conformance obligation, proved by compiler tests or by renderer-owned validation (§10), never by Core or the shared validator.

### `risk`

Optional. Present only on a beat's final boundary (`beat.final: true`) when the beat carries risk.

- `level` is required: `free-to-undo`, `leaves-a-trace`, or `cannot-be-undone`. These are the authoring vocabulary's three levels; there are no runtime-only levels. Beats without risk omit `risk`.
- `guidance` is optional, non-empty text.
- No `label` field exists. The Player derives the visible label from `level`.

Risk presentation state required by the Console (badge and gutter marks) remains opaque renderer state; `commentary.risk` is the Explanation-side semantic record.

### Links and order

For authoring-v1 compiled experiences, references attach to the final boundary as links with deterministic IDs `ref-01` through `ref-99` in authored order. Link IDs remain unique within one commentary entry.

A completed beat presents its final entry in the order: entry text, then `risk`, then `links`.

### Diagnostics

- `CIM-EXP-013`: malformed or unknown `anchor`; malformed, empty, or duplicate `evidence`; evidence without an anchor or on a `command` anchor; anchor regression within a beat.
- `CIM-EXP-014`: malformed `risk`, unknown risk level, any `risk.label`, empty guidance, or risk on a non-final boundary.

A v1 document that carries any of these fields fails as `CIM-EXP-002`, because the v1 commentary object stays closed.

## 10. State and initial state

`state` and `initial_state` remain opaque, required, and non-null.

For the Console renderer, `initial_state` represents an empty transcript with no command, output, response, focus, or risk state. Renderer-invariant title and prompt configuration belong in `renderer_config`.

Every generated step state is absolute. It contains the complete Console destination required to render that semantic boundary without replaying earlier steps.

## 11. Dwell

`dwell_ms` retains the v1 meaning.

For authoring-v1 compilation:

- non-final segment boundaries receive 900 ms;
- the final boundary receives authored beat `dwell` when present;
- otherwise the final boundary receives 1600 ms.

Playback-rate scaling is Runtime clock behavior and does not alter the stored `dwell_ms` value.

## 12. Navigation coordinate

Runtime continues to own canonical step position. v2 additionally supplies enough grouping data for Player and Transport to expose beats as the learner-facing coordinate.

For authoring-v1 compiled experiences:

- Previous and Next resolve to the destination beat's final boundary;
- the visible counter is beat ordinal / `presentation.beat_count`;
- the primary rail has one marker per beat;
- Commentary entry navigation may seek to an individual segment boundary;
- public beat deep links resolve to the final boundary for that beat.

## 13. Deep-link compatibility

Host resolution must support both forms:

- v2 beat ID: resolve to the final boundary of that beat;
- legacy step ID: resolve directly to that step.

`initial` continues to resolve to the initial boundary.

Existing v1 experiences retain direct step-ID behavior unchanged.

## 14. Validation

The JSON Schema enforces structural shape. Runtime semantic validation additionally enforces cross-step invariants that JSON Schema cannot express cleanly, including beat continuity, segment continuity, final-boundary uniqueness, grouping consistency, generated-ID/segment agreement, `beat_count` agreement, anchor order within a beat, and risk only on final boundaries.

The runtime diagnostic namespace remains `CIM-EXP-*`.

A v2 experience is loadable only when:

1. the engine recognizes `localis.cim/v2`;
2. `engine_min` is satisfied: the running engine's version is at least `engine_min`, which names the minimum compatible engine capability level independent of package/release identity. This is checked at the experience-loading boundary before Runtime receives the document (AUTHORING-TO-RUNTIME-v1 §7);
3. structural validation succeeds;
4. runtime semantic validation succeeds;
5. renderer resolution succeeds;
6. renderer-owned validation succeeds when required.

## 15. Compatibility rule

The v2 implementation must add support without changing the meaning of `localis.cim/v1`.

Existing v1 fixtures, experiences, replay evidence, and production release behavior remain valid during the migration. Code that accepts both versions must branch on the explicit `schema` identifier rather than infer version from the presence of new fields.

## 16. R42 schema acceptance

The v2 schema derivation is accepted when:

- the published JSON Schema and runtime validator agree;
- all existing v1 validation fixtures continue to produce their established results;
- positive v2 fixtures cover one-segment and multi-segment beats;
- negative v2 fixtures cover malformed generated IDs, `00`, grouping inconsistency, duplicate/final errors, non-contiguous ordinals, beat-count mismatch, and every `CIM-EXP-013`/`CIM-EXP-014` rule;
- runtime validation of `commentary.evidence` is proven not to inspect opaque state;
- the 18-boundary Git reference specimen validates;
- Runtime ingestion accepts and deep-freezes validated v2 without interpreting `presentation`, `beat`, `state`, or `renderer_config`;
- production WordPress registration rejects `localis.cim/v2` assets until the beat-aware Player, Transport, Commentary, and deep-link consumers land; lifting that gate is a reviewed change to `check:wordpress-experience-registry`;
- deterministic replay can address every generated semantic boundary;
- beat-oriented Host/Transport behavior can be implemented from shared grouping metadata alone.
