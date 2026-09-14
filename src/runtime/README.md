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
- Retaining privileged Core mutation capability inside the Runtime composition root

The normative Core/Runtime state split is `docs/CIM-SPEC.md` §3.

## Core composition seam

`src/runtime/core-session.mjs` is private Runtime infrastructure.

`createRuntimeCoreSession(options)` constructs Core and returns one frozen composition object:

```text
session
  read
  navigation

controls
  semanticControl
  faultControl
  statusControl
```

`session` is the shareable projection. `controls` belongs only to the Runtime composition root and is never placed on a public Runtime or CiMInstance projection.

The composition root must retain the controls directly. Runtime modules must not re-export them, return them from helper APIs, pass them to peer components, or wrap their methods in callbacks or helper functions that are then handed to Transport, Commentary, Renderers, Host, Telemetry, Accessibility, or Experience code. Delegation carries the same mutation authority even when the privileged property names disappear at the eventual call site.

Non-Runtime production code is prohibited from importing `src/runtime/core-session.mjs`. `tools/check-core-authority.mjs` enforces this rule and also prohibits direct non-Runtime imports of `src/core/`.

The static authority gates verify import and identifier boundaries. They cannot prove semantic non-delegation through a renamed Runtime wrapper. `tests/core-authority.test.mjs` contains an explicit near-miss documenting that edge. The structural guarantee therefore rests on composition-root retention of `controls`; the scanners remain defense in depth.

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

Runtime does not import harness code or expose, delegate, re-export, wrap, or otherwise distribute privileged Core mutation controls beyond the Runtime composition root.

## Verification

Integration tests must prove command ordering, instance isolation, navigation cancellation, playback-intent clearing, pause/resume continuity, ordered status writes, deep-link dispatch, scrub-originated single-seek flow, clean disposal, Runtime-only Core-control retention, lifecycle command rejection, and the documented boundary of static authority analysis.
