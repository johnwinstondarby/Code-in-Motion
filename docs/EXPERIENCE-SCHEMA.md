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
- semantic step IDs are unique and stable;
- commentary and links are structured data;
- experience content cannot contain executable runtime logic;
- raw HTML and JavaScript are outside the contract;
- renderer-specific animation instructions are outside the shared schema for v1;
- the selected renderer may interpret opaque state and renderer configuration.

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

Required string.

For v1 the value is exactly:

```text
localis.cim/v1
```

### `engine_min`

Required semantic-version string.

Declares the minimum CiM engine version required to load the experience.

An engine that cannot satisfy this version must fail clearly before playback.

### `experience_version`

Required semantic-version string.

Identifies the version of the instructional experience independently from the engine and schema versions.

### `id`

Required stable experience identifier.

The identifier is used by host resolution and deep linking. It must remain stable across storage-location changes.

Recommended syntax for v1:

```text
lowercase letters, digits, and hyphens
```

Example:

```text
git-basic-cycle
```

### `renderer`

Required renderer identifier.

Examples:

```text
synthetic/v1
git-four-place/v1
```

Runtime resolves this identifier through the renderer registry. An unresolved renderer ID prevents normal initialization.

### `renderer_config`

Optional opaque object.

The selected renderer may inspect this object. Core passes it through without interpreting its contents.

Experience-level renderer configuration applies to the experience as a whole.

### `initial_state`

Required opaque value accepted by the selected renderer.

It must contain enough subject state for the renderer to construct the initial stable boundary independently of prior renderer history.

Core must not inspect its internal structure.

### `steps`

Required ordered array of semantic steps.

The array order defines the default linear semantic timeline for v1.

Step IDs must be unique within the experience.

At least one semantic step is required for an interactive v1 experience.

## 5. Step Shape

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
  "renderer_config": {}
}
```

### `id`

Required stable step identifier.

The ID participates in deep links and replay evidence. Rewording a label must not require changing the step ID.

Recommended syntax follows the same lowercase/digit/hyphen convention as experience IDs.

### `label`

Required learner-facing label.

The label names the semantic operation or position in the progress controls and related accessible output.

### `marker`

Optional short learner-facing marker label.

The marker is intended for compact semantic progress controls. Absence of `marker` does not remove the step from the semantic timeline.

### `commentary`

Required commentary object for v1 steps.

The object contains the instructional explanation associated with the semantic step and any structured links.

### `state`

Required opaque value.

This value is the complete destination state for the selected renderer at the step's stable boundary.

Core must not inspect or normalize it.

Two steps may legally contain equivalent or identical state values.

### `renderer_config`

Optional opaque object specific to this step.

The selected renderer may interpret this object. Core passes it through unchanged.

Step-level renderer configuration supplements experience-level configuration. The renderer owns any precedence rules between its own configuration fields, but those rules must be documented by the renderer.

## 6. Commentary Shape

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

Required string.

The value is plain authored content. It is rendered as text, not interpreted as raw HTML.

### `links`

Required array. It may be empty.

Each link is structured separately from the commentary text so the runtime and host can validate destinations without accepting arbitrary markup.

## 7. Commentary Link Shape

The minimum v1 link shape is:

```json
{
  "id": "git-index",
  "label": "index",
  "href": "/git/index/"
}
```

### `id`

Required stable link identifier within the commentary entry.

### `label`

Required visible link text or term.

### `href`

Required destination string.

The host/runtime link policy validates the URL or fragment before it is exposed to the learner. Validation must reject executable schemes.

The v1 schema may later add optional metadata such as link kind or relationship without changing the basic rule that links remain structured data.

## 8. Opaque State Rule

The shared schema validates that `state` and `initial_state` are present. It does not define their subject-specific internal properties.

The selected renderer owns interpretation of those values.

The shared Core must not:

- inspect subject-specific keys;
- derive semantic position from state contents;
- mutate subject state;
- infer whether two semantic steps are equivalent from state equality;
- depend on Git-specific or renderer-specific field names.

Subject renderers may define additional schemas for their opaque state and configuration. Those validations occur at the renderer boundary and cannot change the shared `localis.cim/v1` structural contract.

## 9. Renderer Configuration Rule

`renderer_config` is data, not executable behavior.

The shared v1 schema does not define declarative micro-animation instructions.

A renderer may use renderer configuration for stable presentation choices or domain-specific rendering hints, but the experience file must not become a second animation engine.

## 10. Initial State Rule

`initial_state` is required even when the first semantic step immediately changes the subject.

This provides one explicit restoration point for:

- initial mount;
- `home()`;
- `restart()`;
- reverse navigation from the first semantic step;
- recovery to initial state;
- deterministic replay setup.

The initial boundary is separate from `steps[0]`.

## 11. Observation Steps

A semantic step does not have to change subject state.

The following is valid:

```text
step-01 state digest = X
step-02 state digest = X
step-01 id != step-02 id
```

The runtime must still advance canonical semantic position, marker state, commentary, and event sequence when moving from `step-01` to `step-02`.

## 12. Content Safety

Experience data is untrusted input.

The v1 contract prohibits:

- executable JavaScript supplied by an experience;
- raw HTML as an authored-content mechanism;
- callbacks or function bodies inside experience data;
- `javascript:` or equivalent executable link schemes;
- engine-control instructions embedded in `state` or `renderer_config` and interpreted by Core.

Terminal/code content is represented as data and rendered as text nodes by the appropriate renderer.

## 13. Version Compatibility

An experience is loadable only when:

- the engine recognizes its `schema` identifier;
- the engine version satisfies `engine_min`;
- the shared structural validator succeeds;
- the renderer identifier resolves;
- any renderer-owned validation required for the opaque state succeeds.

Failure at any of these gates prevents normal playback.

## 14. Validation Failures

At minimum, validation must detect:

- missing required top-level fields;
- unsupported schema identifier;
- invalid version strings;
- invalid or empty experience ID;
- unresolved renderer identifier at composition time;
- missing `initial_state`;
- missing or invalid `steps` array;
- duplicate step IDs;
- missing required step state;
- malformed commentary object;
- malformed commentary link;
- disallowed link scheme.

Authoring adapters should preserve source line/column information so human-facing tools can report errors against the original `.cim` source where possible.

## 15. Neutral Reference Fixture

The first schema fixture should remain subject-neutral:

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
      "state": { "value": "B" }
    },
    {
      "id": "step-02",
      "label": "Observe B",
      "marker": "OBSERVE",
      "commentary": { "text": "The process is observed without changing state.", "links": [] },
      "state": { "value": "B" }
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

## 16. Deferred from v1

The shared v1 schema does not define:

- branching or conditional step graphs;
- learner-authored state mutation;
- declarative animation timelines;
- embedded scripts;
- raw HTML commentary;
- renderer-specific subject properties in the shared schema;
- network data sources inside an experience definition.
