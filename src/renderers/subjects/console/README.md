# Console Renderer

Renderer ID: `console/v1`

Status: under construction (R42). This directory currently contains only renderer-owned validation. It has no renderer factory and is not registered in `wordpress/assets/renderer-registry.mjs`, so no experience can resolve `console/v1` yet.

## Contract

`docs/renderers/CONSOLE-RENDERER-v1.md` is normative. This renderer implements the subject-neutral Console: real-text transcript, tone, focus, and risk channels, and inert copy affordances. Core, Runtime, and the shared runtime validator treat its state as opaque.

## Modules

| File | Responsibility |
|---|---|
| `validate-console-input.mjs` | §6 renderer-owned validation of `rendererConfig`, `stepRendererConfig`, and each destination state against §§2–3. Dependency-free. A violation produces `ConsoleRendererInputError`, which Runtime reports as `CIM-RND-004`. |

## Enforcement agreement

The contract has two enforcement points, and `tests/console-renderer-validation.test.mjs` proves they agree:
- this renderer-side validator;
- the producer-side compiler checker, `authoring/v1/console-state-conformance.mjs`.

## Planned slices

1. Renderer-owned validation (this slice).
2. Stable absolute rendering: the DOM for each destination, settlement equivalence, and canonicalization evidence.
3. Timed transitions on the clock facade: typing, output reveal, response entry, and the reduced-motion path.
4. Registration, and the beat-aware consumers required before the v2 registration gate opens.
