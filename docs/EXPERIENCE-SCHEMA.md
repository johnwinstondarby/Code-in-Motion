# Code in Motion Experience Schema

Status: Normative v1 contract description

Runtime schema identifier: `localis.cim/v1`

## 1. Purpose

This document defines the minimum shared experience contract consumed by the CiM runtime. The contract describes instructional structure and renderer input while keeping subject-specific state opaque to Core.

The implementation JSON Schema belongs under `schemas/` and must conform to this document.

## 2. Design Rules

The v1 experience contract follows these rules:

- one runtime schema serves generated and hand-authored ingestion paths;
- Core may inspect shared structural fields but never the contents of subject `state` or `renderer_config`;
- every experience has an explicit initial stable state;
- the reserved semantic boundary ID `initial` identifies that initial stable state;
- authored semantic step IDs are unique, stable, and may not use reserved IDs;
- commentary and links are structured data;
- experience content cannot contain executable runtime logic;
- raw HTML and JavaScript are outside the contract;
- renderer-specific animation instructions are outside the shared schema for v1;
- the selected renderer may interpret opaque state and renderer configuration;
- optional authored dwell is instructional pacing data, not renderer animation data.

## 3. Minimum Top-Level Shape

A valid v1 experience has the following conceptual shape:

```json
{
  "schema": "localis.cim/v1",
  "engine_min": "1.0.0",
  "experience_version": "1.0.0",
  "id": "synthetic-basic",
  "renderer": "synthetic/v1",
  "renderer_config": {},
  "initial_state": {},
  "steps": []
}
```

## 4. Top-Level Fields

### `schema`

Required string. For v1 the value is exactly `localis.cim/v1`.

### `engine_min`

Required semantic-version string declaring the minimum CiM engine version required to load the experience.

### `experience_version`

Required semantic-version string identifying the instructional experience independently from engine and schema versions.

### `id`

Required stable experience identifier used by host resolution and deep linking.

Recommended v1 syntax:

```text
lowercase letters, digits, and hyphens
```

Example: `git-basic-cycle`.

### `renderer`

Required renderer identifier, for example `synthetic/v1` or `git-four-place/v1`.

An unresolved renderer ID prevents normal initialization.

### `renderer_config`

Optional opaque object interpreted only by the selected renderer. Core passes it through without inspecting its contents.

### `initial_state`

Required opaque, non-null value accepted by the selected renderer.

It must contain enough subject state for the renderer to construct the `initial` stable boundary independently of prior renderer history.

Core must not inspect its internal structure.

### `steps`

Required ordered array of authored semantic steps.

The array order defines the default linear semantic timeline for v1.

At least one semantic step is required for an interactive v1 experience.

## 5. Reserved Semantic Boundary IDs

The following semantic boundary ID is reserved by the shared v1 contract:

```text
initial
```

`initial` identifies the stable boundary represented by `initial_state`.

An authored `steps[].id` equal to `initial` is invalid.

Future schema versions may add reserved IDs. A v1 validator must reject currently reserved IDs rather than silently renaming them.

## 6. Step Shape

A semantic step has the following conceptual structure:

```json
{
  "id": "step-03",
  "label": "Add",
  "marker": "ADD",
  "commentary": {
    "text": "Current file content enters the index.",
    "links": []
  },
  "state": {},
  "renderer_config": {},
  "dwell_ms": 1500
}
```

### `id`

Required stable step identifier.

The ID participates in deep links and replay evidence. Rewording a label must not require changing the step ID.

Recommended syntax follows the lowercase/digit/hyphen convention used for experience IDs.

The value `initial` is reserved and invalid for authored steps.

### `label`

Required learner-facing label naming the semantic operation or position.

### `marker`

Optional short learner-facing marker label. Absence of `marker` does not remove the step from the semantic timeline.

### `commentary`

Required commentary object for every v1 authored step.

### `state`

Required opaque, non-null value containing the complete destination state for the selected renderer at the step's stable boundary.

Core must not inspect or normalize it. Two steps may legally contain equivalent or identical state values.

### `renderer_config`

Optional opaque object specific to this step.

The selected renderer may interpret it. Core passes it through unchanged.

Step-level renderer configuration supplements experience-level configuration. Renderer-owned precedence rules must be documented by that renderer.

### `dwell_ms`

Optional non-negative integer.

`dwell_ms` specifies instructional dwell time in milliseconds after this step commits during continuous playback and before Runtime begins the following transition.

Rules:

- omission means zero authored dwell;
- direct navigation and deep-link initialization ignore dwell;
- reduced-motion mode preserves dwell;
- Runtime owns dwell scheduling through the injected CiM clock;
- renderer transition duration remains renderer-owned and is not represented by this field;
- site configuration may clamp dwell, but deterministic replay must include effective runtime configuration when clamping changes the authored value.

## 7. Commentary Shape

A commentary object has the following conceptual shape:

```json
{
  "text": "Current file content enters the index.",
  "links": [
    {
      "id": "git-index",
      "label": "index",
      "href": "/git/index/"
    }
  ]
}
```

### `text`

Required string rendered as authored text rather than raw HTML.

### `links`

Required array that may be empty.

Each link is structured separately from commentary text so destinations can be validated without accepting arbitrary markup.

Link IDs must be unique within one commentary entry.

## 8. Commentary Link Shape

The minimum v1 link shape is:

```json
{
  "id": "git-index",
  "label": "index",
  "href": "/git/index/"
}
```

`id`, `label`, and `href` are required.

`href` uses an explicit v1 allowlist. Accepted destination forms begin with:

```text
http://
https://
mailto:
/
#
```

Validators must normalize ASCII whitespace and C0 control characters for scheme analysis and reject any destination whose normalized form does not match an allowed prefix. Raw values that fail the published JSON Schema are rejected before runtime ingestion.

This rule rejects executable or unapproved schemes such as `javascript:`, `data:`, `vbscript:`, and `blob:` as well as arbitrary non-URL text.

Optional metadata may be added later without changing the rule that links remain structured data.

## 9. Opaque State Rule

The shared schema validates that `state` and `initial_state` are present and non-null. It does not define their subject-specific internal properties.

The selected renderer owns interpretation of those values.

The shared Core must not:

- inspect subject-specific keys;
- derive semantic position from state contents;
- mutate subject state;
- infer whether two semantic steps are equivalent from state equality;
- depend on Git-specific or renderer-specific field names.

Subject renderers may define additional schemas for their opaque state and configuration. Those validations occur at the renderer boundary and cannot change the shared `localis.cim/v1` structural contract.

## 10. Renderer Configuration Rule

`renderer_config` is data, not executable behavior.

The shared v1 schema does not define declarative micro-animation instructions or a generic authored transition-duration field.

A renderer may use renderer configuration for stable presentation choices or domain-specific rendering hints, but the experience file must not become a second animation engine.

## 11. Initial State Rule

`initial_state` is required even when the first semantic step immediately changes the subject.

Its canonical semantic boundary identifier is `initial`.

This provides one explicit restoration and addressing point for:

- initial mount;
- `seek("initial")`;
- `home()`;
- `restart()`;
- reverse navigation from the first semantic step;
- recovery to initial state;
- deterministic replay setup;
- deep link `#cim/{experience-id}/initial`;
- event `from_step` and `to_step` fields.

The initial boundary is separate from `steps[0]` and has no authored commentary entry or semantic marker in v1.

## 12. Observation Steps

A semantic step does not have to change subject state.

The following is valid:

```text
step-01 state digest = X
step-02 state digest = X
step-01 id != step-02 id
```

The runtime must still advance canonical semantic position, marker state, commentary, and event sequence when moving from `step-01` to `step-02`.

## 13. Content Safety

Experience data is untrusted input.

The v1 contract prohibits:

- executable JavaScript supplied by an experience;
- raw HTML as an authored-content mechanism;
- callbacks or function bodies inside experience data;
- link destinations outside the explicit v1 allowlist;
- engine-control instructions embedded in `state` or `renderer_config` and interpreted by Core.

Terminal/code content is represented as data and rendered as text nodes by the appropriate renderer.

## 14. Version Compatibility

An experience is loadable only when:

- the engine recognizes its `schema` identifier;
- the engine version satisfies `engine_min`;
- the shared structural validator succeeds;
- the renderer identifier resolves;
- any renderer-owned validation required for opaque state succeeds.

The v1 schema rejects unknown structural fields with `additionalProperties: false`. A later contract that adds fields must use a versioned schema contract rather than relying on a v1 validator to ignore them.

Failure at any gate prevents normal playback.

## 15. Validation Failures

At minimum, validation must detect:

- missing required top-level fields;
- unsupported schema identifier;
- invalid version strings;
- invalid or empty experience ID;
- unresolved renderer identifier at composition time;
- missing or null `initial_state`;
- missing, empty, or invalid `steps` array;
- duplicate step IDs;
- reserved step ID `initial`;
- missing or null required step state;
- missing or malformed commentary object;
- duplicate link IDs within one commentary entry;
- malformed commentary link;
- link destination outside the allowlist;
- non-integer or negative `dwell_ms`.

Authoring adapters should preserve source line/column information so human-facing tools can report errors against original source where possible.

## 16. Neutral Reference Fixture

The first schema fixture remains subject-neutral:

```json
{
  "schema": "localis.cim/v1",
  "engine_min": "1.0.0",
  "experience_version": "1.0.0",
  "id": "synthetic-basic",
  "renderer": "synthetic/v1",
  "initial_state": { "value": "A" },
  "steps": [
    {
      "id": "step-01",
      "label": "Change to B",
      "marker": "B",
      "commentary": { "text": "State changes to B.", "links": [] },
      "state": { "value": "B" },
      "dwell_ms": 500
    },
    {
      "id": "step-02",
      "label": "Observe B",
      "marker": "OBSERVE",
      "commentary": { "text": "The process is observed without changing state.", "links": [] },
      "state": { "value": "B" },
      "dwell_ms": 1000
    },
    {
      "id": "step-03",
      "label": "Change to C",
      "marker": "C",
      "commentary": { "text": "State changes to C.", "links": [] },
      "state": { "value": "C" }
    },
    {
      "id": "step-04",
      "label": "Change to D",
      "marker": "D",
      "commentary": { "text": "State changes to D.", "links": [] },
      "state": { "value": "D" }
    }
  ]
}
```

This fixture must be sufficient to prove shared platform behavior before Git-specific experience data exists.

## 17. Deferred from v1

The shared v1 schema does not define:

- branching or conditional step graphs;
- learner-authored state mutation;
- declarative animation timelines;
- generic authored transition duration;
- embedded scripts;
- raw HTML commentary;
- renderer-specific subject properties in the shared schema;
- network data sources inside an experience definition.
