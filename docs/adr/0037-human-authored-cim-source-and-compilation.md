# ADR 0037: Human-Authored .cim Source and Compilation

Status: Proposed for R29

## Context

ADR 0004 established two authoring paths for CiM:

- Localis-generated experiences derived from structured subject sources;
- human-authored experiences that remain practical to edit without direct JSON authoring.

R27 proved the generated path with the Git shared-source adapter. The human-authored path remains deliberately undefined.

CiM already has one runtime contract: `localis.cim/v1`. Runtime, Core, Host, Transport, Commentary, and renderers must not gain a second ingestion contract merely because source authors use a different file format.

The human-facing format must also support:

- multiline instructional text;
- complete opaque renderer state;
- complete opaque renderer configuration;
- deterministic compilation;
- actionable source-location diagnostics;
- inert data only.

## Decision

R29 defines `.cim` as a human-authored source format that compiles to `localis.cim/v1`.

The engine never consumes `.cim` directly.

The pipeline is:

```text
human-authored .cim
        |
        v
restricted YAML parser
        |
        v
authoring adapter + source map
        |
        v
localis.cim/v1 candidate
        |
        v
ingestExperience()
        |
        v
validated frozen Runtime input
```

The parser/compiler is an authoring-time capability. Runtime and WordPress Host remain unaware of the `.cim` grammar.

## Authoring-version marker

Every R29 source begins with:

```yaml
cim: 1
```

This version identifies the authoring grammar.

It does not replace the runtime schema identifier in compiled output.

The compiler maps:

```yaml
cim: 1
```

to:

```json
"schema": "localis.cim/v1"
```

Authoring grammar version and Runtime schema version therefore remain independently versioned.

## R29 grammar

R29 uses a restricted YAML 1.2-style data syntax.

The top-level authoring keys are:

- `cim`
- `engine_min`
- `experience_version`
- `id`
- `renderer`
- `renderer_config`
- `initial_state`
- `steps`

Except for `cim`, the fields correspond directly to the existing `localis.cim/v1` contract.

Step, commentary, link, state, and renderer-configuration shapes remain governed by the existing Runtime schema and validator.

Example:

```yaml
cim: 1
engine_min: 1.0.0
experience_version: 1.0.0
id: synthetic-basic
renderer: synthetic/v1

renderer_config: {}

initial_state:
  value: A

steps:
  - id: step-01
    label: Change to B
    marker: B
    commentary:
      text: |
        State changes to B.
      links: []
    state:
      value: B
    dwell_ms: 500

  - id: step-02
    label: Observe B
    marker: OBSERVE
    commentary:
      text: |
        State B is observed without mutation.
      links: []
    state:
      value: B
```

The grammar deliberately preserves the existing absolute-state model. Observation boundaries may contain equivalent state values.

## Restricted YAML surface

R29 accepts only YAML constructs that can be rebuilt into inert JSON data.

The following are prohibited:

- anchors;
- aliases;
- merge keys;
- explicit/custom tags;
- directives;
- multiple YAML documents;
- duplicate mapping keys;
- non-string mapping keys;
- non-finite numbers;
- implementation-specific object types;
- executable expressions;
- environment interpolation;
- file includes;
- network includes.

After parsing, the adapter rebuilds the source into a JSON-safe graph consisting only of:

- null;
- boolean;
- finite number;
- string;
- arrays;
- plain objects with string keys.

No parser-owned object reaches `ingestExperience()`.

## Source locations

The parser/compiler maintains a source-location table for authored paths.

Locations are one-based:

- line;
- column.

Where available, ranges may also include end line and end column.

The location table is authoring evidence. It is not part of `localis.cim/v1` and is not passed to Runtime.

Validation diagnostics use the most specific authored path available. If an exact runtime validation path has no direct source location, the compiler resolves the nearest authored ancestor.

## Diagnostic ownership

R29 separates authoring diagnostics from Runtime validation diagnostics.

Authoring-specific failures use:

- `CIM-AUTH-001`: malformed source syntax;
- `CIM-AUTH-002`: prohibited or non-JSON authoring construct;
- `CIM-AUTH-003`: invalid or unsupported authoring grammar/version.

Once a Runtime candidate exists, existing `CIM-EXP-*` codes remain authoritative.

The compiler enriches those existing validation errors with source location. It does not translate them into a second semantic error vocabulary.

A human-facing diagnostic contains, at minimum:

- code;
- path when available;
- one-based line;
- one-based column;
- message;
- phase: `parse`, `authoring`, or `validation`.

## Validation convergence

Compiled output must pass through the existing production ingestion path:

`ingestExperience()`

R29 does not add a second validator.

A successful compiler result suitable for generated output is therefore derived only after the same production validation and freezing rules used by JSON ingestion have succeeded.

## Determinism

The same `.cim` source, compiler version, and dependency lock must produce equivalent Runtime JSON on every supported Node version.

Generated fixture output is freshness-gated.

Known structural properties are emitted in documented Runtime order. Opaque nested state/configuration objects preserve authored mapping order; the compiler does not interpret or normalize their subject-specific contents.

## Content safety

R29 does not widen authored-content authority.

In particular:

- commentary remains text;
- terminal/code-like text remains data;
- raw HTML gains no execution path;
- JavaScript gains no execution path;
- commentary links still pass the existing link allowlist;
- opaque `state` and `renderer_config` remain opaque to Core.

A string containing markup is compiled as a string.

An authored `javascript:` link remains invalid under the existing Runtime validation contract.

## Repository placement

The R29 parser/compiler belongs to the authoring/tooling surface, outside Runtime.

The intended ownership boundary is:

```text
authoring/cim/       parser/compiler implementation
tools/               CLI/check entry points
tests/               parser/compiler and convergence tests
```

Production Runtime code under `src/` must not import the authoring parser/compiler.

## Release boundary

R29 is an authoring/tooling checkpoint.

The `.cim` parser/compiler is not added to the WordPress release tree in R29.

The CiM 0.1.1 plugin artifact is therefore expected to remain byte-identical.

If the WordPress ZIP digest moves during R29, the change must be investigated rather than accepted as incidental.

A later checkpoint may define WordPress administration or upload-time compilation of `.cim` source.

## Rejected alternatives

### JSON as the only authoring format

Rejected by ADR 0004. Multiline commentary and nested state are unnecessarily fragile for routine hand authoring.

### Runtime consumes YAML directly

Rejected because it creates a second Runtime contract and moves parser authority into engine execution.

### Full unrestricted YAML

Rejected because aliases, tags, merge semantics, and implementation-specific node behavior add unnecessary authority and diagnostic complexity.

### TOML

Rejected for R29 because deeply nested arrays of steps and arbitrary opaque state are less direct than the selected restricted YAML representation.

### Markdown with front matter

Rejected because one experience would span two structural grammars and create ambiguity between prose presentation and Runtime data.

### Custom indentation DSL

Rejected because R29 does not need to invent a parser grammar where a constrained data syntax already satisfies multiline text, nested state, and source-location requirements.

## Consequences

- Human-authored and generated experiences converge on the same Runtime contract.
- Source authors gain multiline, readable authoring without direct JSON editing.
- Runtime validation codes remain the semantic authority.
- Parse and validation failures can point back to source lines and columns.
- The engine remains independent of authoring syntax.
- R27 Git shared-source generation remains unchanged.
- WordPress release bytes remain unchanged in R29.

## Verification

R29 verification must prove:

- a valid `.cim` fixture compiles through `ingestExperience()`;
- the compiled fixture is semantically equivalent to its canonical `localis.cim/v1` reference;
- multiline commentary survives compilation exactly;
- opaque nested state and renderer configuration survive without interpretation;
- B-to-B observation steps remain distinct semantic boundaries with equivalent state;
- duplicate keys fail with source location;
- aliases, anchors, tags, merge keys, directives, and multiple documents fail closed;
- malformed syntax reports line/column;
- Runtime validation failures retain `CIM-EXP-*` identity and gain authoring line/column;
- executable-looking text remains inert text;
- disallowed link schemes remain rejected by existing validation;
- no Runtime module imports the authoring parser/compiler;
- generated fixture output is freshness-gated;
- Node 20 and Node 22 produce equivalent compiler output;
- the WordPress release ZIP remains byte-identical to the pre-R29 0.1.1 artifact.
