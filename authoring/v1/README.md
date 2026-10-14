# Authoring v1 Compiler (`localis.cim/authoring/v1` → `localis.cim/v2`)

This directory owns the lesson-level JSON authoring path defined by `docs/AUTHORING-TO-RUNTIME-v1.md` (A2R). It sits beside the one-to-one `.cim` path (`authoring/cim`, ADR 0037). Runtime and WordPress never consume authoring JSON; they consume the compiled `localis.cim/v2` output.

## Modules

| File | Responsibility |
|---|---|
| `validate-authoring.mjs` | Authoring validation, `CIM-AUTH-*` errors and `CIM-AUTH-LINT-*` warnings. Rejects duplicate keys before ordinary parsing. Implements docs/AUTHORING-JSON-v1.md. |
| `compile-authoring.mjs` | Pure, deterministic, fail-closed compiler (`compileAuthoringSource`). `CIM-COMP-*` diagnostics. No subject-specific logic. |
| `console-state-conformance.mjs` | Producer-side conformance of compiled output to CONSOLE-RENDERER-v1 §§2–3. |
| `evidence-conformance.mjs` | The bidirectional check that `commentary.evidence` corresponds to Console focus state. The runtime validator deliberately cannot perform this check. |
| `fixtures/` | Validator fixtures with one violated rule per invalid fixture, plus `manifest.json`. Regenerate with `npm run generate:authoring-v1-fixtures`. |

Commands:
- `npm run compile:authoring` regenerates every registered compiled output and its provenance.
- `npm run check:authoring-v1` (part of `verify`) proves the fixture suite, diagnostic coverage, byte-current outputs, and evidence correspondence.

## Compilation constants

| Constant | Value | Source |
|---|---|---|
| Intra-beat boundary dwell | 900 ms | A2R §11 |
| Final boundary dwell when `dwell` is absent | 1600 ms | A2R §11 |
| Maximum segments per beat | 99 | A2R §6 |
| Renderer for `console-explanation` | `console/v1` (canonical) | A2R §12; CONSOLE-RENDERER-v1 |
| `engine_min` | `0.2.0` | A2R §7: minimum compatible engine, independent of release identity |

## Console state format

Compiled Console state follows the normative renderer-owned contract in `docs/renderers/CONSOLE-RENDERER-v1.md`. `console-state-conformance.mjs` checks every compiled document against that contract on the producer side, as part of `check:authoring-v1`. Core and the shared runtime validator never read Console state.
