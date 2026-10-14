# Authoring v2

Schema: `localis.cim/authoring/v2`. Frozen upon PR #80 merge (ADR 0054); any later contract change requires another identifier. ADR 0048 Part B reserves authoring/v3 for limn.

v2 retains v1's lesson and beat semantics and adds only optional `presentation.command_window.cli`, with independent `kind` and single-line `label`. Recognized kinds are powershell, windows-cli and bash; all badges use secondary Console text, never category or risk colors.

Compiler 1.0.1 emits runtime v2. CLI-bearing lessons require engine 1.0.1; without CLI metadata, the existing 0.2.0 minimum remains. Frozen authoring/v1, its compiler, its fixtures and its specs are unchanged and remain supported by the version-dispatching CLI.

Normative references: [Authoring JSON v2](../../docs/AUTHORING-JSON-v2.md), [Compilation v2](../../docs/AUTHORING-TO-RUNTIME-v2.md). Renderer-state and evidence conformance reuse the existing v1 checks; this version changes no Console renderer output.
