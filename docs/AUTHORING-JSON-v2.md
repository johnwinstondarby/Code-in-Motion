# Code in Motion Authoring JSON Specification v2

Status: Frozen upon PR #80 merge (ADR 0054). Every later authoring-contract change requires a new identifier.
Schema identifier: `localis.cim/authoring/v2`.
Implementation: `authoring/v2/validate-authoring.mjs`.

The frozen [Authoring JSON v1 specification](AUTHORING-JSON-v1.md) remains unchanged. All its numbered clauses, closed-field rules, diagnostics and lesson semantics apply to v2, with exactly the amendments below. Existing v1 documents remain supported by the original validator and compiler.

## Version and CLI metadata amendments

The required root schema identifier is `localis.cim/authoring/v2`. The only added field is optional `presentation.command_window`. It is a closed object with required `cli`, itself a closed object with required `kind` and `label`:

```json
"command_window": { "cli": { "kind": "bash", "label": "Bash" } }
```

Recognized kinds are `powershell`, `windows-cli` and `bash`. Bash includes authored Bash presentation on macOS/Linux. The label is a non-empty single line, independent of kind. Tabs and line breaks are prohibited. Unknown fields and unknown kinds are errors. Omitting the field supplies no badge.

Every kind uses the secondary Console text color in Localis, High Contrast and Light. Neither kind nor label selects a category color. Red and green remain risk colors; Windows forced colors uses system colors. The badge remains real selectable text in the upper-right of the Console pane. CLI identity is authored, never inferred from prompt text or the learner's OS.

CLI metadata is not permitted by frozen authoring/v1. ADR 0048 Part B's limn field is reserved for authoring/v3 and is not permitted by v1 or v2. Each identifier is frozen once and remains unchanged thereafter.

Compilation follows [Authoring-to-Runtime v2](AUTHORING-TO-RUNTIME-v2.md). Runtime remains `localis.cim/v2`; CLI-bearing lessons require engine 1.0.1. Copy and risk behavior retain the inherited v1 clauses and ADR 0054's Player-owned implementation.
