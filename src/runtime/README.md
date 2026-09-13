# Runtime / CiMInstance

## Purpose

Runtime creates one isolated CiM instance and coordinates commands across production components.

## Owns

- `CiMInstance` lifecycle
- Instance identity and composition
- Command sequencing
- Cross-component orchestration
- Continuous playback intent
- Transition correlation, normalized progress, cancellation, and abort coordination
- Dwell scheduling
- Multi-instance isolation
- Initial deep-link dispatch
- Renderer settlement sequencing
- Requesting canonical semantic commit from Core after stable settlement
- Retaining privileged Core mutation capability

The normative Core/Runtime state split is `docs/CIM-SPEC.md` §3.

## Core composition seam

`src/runtime/core-session.mjs` is private Runtime infrastructure.

`createRuntimeCoreSession(options)` constructs Core and returns a frozen projection with exactly:

```text
read
navigation
```

The mutation capabilities remain inside Runtime:

```text
semanticControl
faultControl
statusControl
```

`acquireRuntimeCoreControls(session)` grants those controls once. A second acquisition fails. The projection itself never exposes a mutation capability.

Non-Runtime production code is prohibited from importing `src/runtime/core-session.mjs`. `tools/check-core-authority.mjs` enforces this rule and also prohibits direct non-Runtime imports of `src/core/`.

Runtime determines activity-status changes from Runtime-owned operational facts and requests canonical changes through the retained Core controls. Shared vocabulary from `src/contracts/` grants no mutation authority.

## Does not own

- Canonical semantic commit authority
- Canonical session-state storage
- Subject-state interpretation
- Renderer internals
- Commentary DOM internals
- Harness behavior

## Allowed dependencies

Runtime may call documented Core interfaces, import `src/contracts/`, and use transport integration points, commentary, renderer interfaces, accessibility helpers, experience loading, telemetry, and fault services.

## Prohibited dependencies

Runtime does not import harness code or expose privileged Core mutation controls to Transport, Commentary, Renderers, Host, Telemetry, Accessibility, or Experience modules.

## Verification

Integration tests must prove command ordering, instance isolation, navigation cancellation, playback-intent clearing, pause/resume continuity, ordered status writes, deep-link dispatch, scrub-originated single-seek flow, clean disposal, Runtime-only Core-control retention, and lifecycle command rejection.
