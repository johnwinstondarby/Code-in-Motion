# Console Renderer

Renderer ID: `console/v1`

Status: under construction (R42). Slices 1–2 are complete: renderer-owned validation and stable absolute rendering. Every arrival settles directly; timed presentation is slice 3. The renderer is **not registered** in `wordpress/assets/renderer-registry.mjs`, so no experience can resolve `console/v1` yet.

## Contract

`docs/renderers/CONSOLE-RENDERER-v1.md` is normative. This renderer implements the subject-neutral Console: real-text transcript, tone, focus, and risk channels, and inert copy affordances. Core, Runtime, and the shared runtime validator treat its state as opaque.

## Modules

| File | Responsibility |
|---|---|
| `renderer.mjs` | `createConsoleRenderer()`: the `{ mount, render, dispose }` lifecycle. Validates first, then settles the destination's stable DOM as a pure function of the destination state and `rendererConfig`. Badge and labels are derived from risk levels, copy controls are inert, and focus is a `data-focused` mark that never alters tone. |
| `validate-console-input.mjs` | §6 renderer-owned validation of `rendererConfig`, `stepRendererConfig`, and each destination state against §§2–3. Dependency-free. A violation produces `ConsoleRendererInputError`, which Runtime reports as `CIM-RND-004`. |

## Enforcement agreement

The contract has two enforcement points, and `tests/console-renderer-validation.test.mjs` proves they agree:
- this renderer-side validator;
- the producer-side compiler checker, `authoring/v1/console-state-conformance.mjs`.

## Stable output structure

```text
section[data-cim-renderer=console/v1][data-step]
  header[data-role=titlebar][data-risk]?             data-risk mirrors the badge (D3)
    span[data-role=title]
    span[data-role=risk-badge][data-risk]?          only when the last entry has a risk
  div[data-role=transcript]
    div[data-role=entry][data-beat][data-typing=false]?
      div[data-role=command-line]
        span[data-role=risk-mark][data-risk]?
        span[data-role=prompt]
        span[data-role=prompt-separator]
        span[data-role=command]
        span[data-role=cursor][aria-hidden=true]?       only when this command is pending (D1)
        button[data-role=copy][type=button][data-copy][aria-label]
      div[data-role=output-line][data-tone][data-output-id]?[data-focused=true]?[data-awaiting-response=true]?
        span[data-role=output-text]
        span[data-role=cursor][aria-hidden=true]?       only on an awaiting interactive prompt (D1)
        span[data-role=response-separator] + span[data-role=response]   only on a revealed response line
    div[data-role=ready-line]?                          when the last command is complete, or at initial (D2)
      span[data-role=prompt] + span[data-role=prompt-separator]   omitted only without any prompt
      span[data-role=cursor][aria-hidden=true]
```

Exactly one cursor exists per state, positioned by CONSOLE-RENDERER-v1 §4.7. Canonical evidence for this structure is committed under `harness/evidence/console-v1/` and gated by `check:console-render-evidence`. Its `lineage` records each approved supersession: the current oracle supersedes the slice-2 evidence (`b8403bb7…`, protected at `d208800`) via the D1–D3 refinement. Any change to stable output must regenerate that evidence (`npm run evidence:console`) as a reviewed change.

## Planned slices

1. Renderer-owned validation (done).
2. Stable absolute rendering: the DOM for each destination, settlement equivalence, and canonicalization evidence (done).
3. Timed transitions on the clock facade: typing, output reveal, response entry, and the reduced-motion path.
4. Registration, and the beat-aware consumers required before the v2 registration gate opens.
