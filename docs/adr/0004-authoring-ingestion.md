# ADR 0004: Authoring and Experience Ingestion

Status: Accepted for CiM v1

## Context

CiM needs to support at least two authoring paths:

- Localis-generated experiences derived from structured subject sources;
- hand-authored third-party experiences that should remain practical to edit without requiring direct JSON authoring.

If those paths reach the engine through different runtime contracts, validation, versioning, determinism, and security behavior will diverge.

Site-level plugin configuration is also distinct from per-experience instructional content and must not be conflated with it.

## Decision

CiM has one runtime experience contract: `localis.cim/v1`.

All authoring paths must produce that contract and pass the same schema-validation gate before runtime initialization.

```text
Human-authored .cim -> parser -----+
                                   |
Localis subject source -> generator+--> localis.cim/v1 validation -> runtime
```

The engine never consumes `.cim` source directly and never consumes an unvalidated generator-specific representation.

The exact `.cim` syntax is deferred to a dedicated authoring specification or later ADR. The authoring format must support actionable line/column diagnostics and must remain capable of representing non-terminal renderer state.

Site-level settings and experience content remain separate:

- site/plugin configuration may define experience locations, brand/theme policy, engine-version policy, and site defaults;
- per-experience authoring defines semantic steps, commentary, links, opaque subject state, and renderer configuration for one demonstration.

Experience-authored content is untrusted input regardless of source. The runtime contract prohibits executable JavaScript and raw HTML. Authored code and terminal content render as text. Commentary links use structured allowlisted fields. Renderer configuration is data, not executable instructions.

## Consequences

- Localis can generate experiences from shared subject data without changing the engine contract.
- Third parties can use a human-oriented authoring surface without introducing a second runtime format.
- Schema validation, version checks, fault reporting, and harness fixtures operate on the same runtime representation.
- WordPress administration can provide parse/validation diagnostics without embedding runtime logic in page content.
- The reference-page schema and CiM runtime schema may remain separate generated outputs from shared subject facts.

## Rejected Alternatives

### `.cim` as a second runtime format

Rejected because engine behavior, validation, and replay would differ by ingestion path.

### Separate rolling-text config beside experience JSON

Rejected because two files would describe one demonstration and could drift independently.

### JSON as the only human authoring surface

Rejected as a v1 authoring requirement because multiline instructional and terminal content is unnecessarily fragile to hand-edit in JSON.

### Raw HTML in authored content

Rejected because authored experience content is an injection surface and must remain structured data.

## Verification

The schema and adapter tests must prove that:

- generator output and parsed `.cim` output both pass through the same `localis.cim/v1` validator;
- invalid inputs fail before runtime initialization;
- validation reports source location when the authoring adapter can provide it;
- authored terminal/code content cannot execute markup or script;
- Core does not inspect subject-specific `state` or `renderer_config` contents.
