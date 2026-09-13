# Engine Core

## Purpose

Core owns and mutates the canonical semantic session state used by a CiM instance.

## Owns

- Current committed semantic boundary, including reserved `initial`
- Pending semantic target position
- Canonical playback/session status
- Reveal-frontier state required by the semantic model
- Canonical fault state required by session semantics
- Validation of semantic navigation requests against the loaded experience
- Canonical semantic commit after Runtime confirms stable renderer settlement

The normative session model is defined in `docs/CIM-SPEC.md` §3.

`status` is stored canonically by Core. Runtime is the only production component authorized to request an activity-status change through the documented `Core.setStatus(nextStatus)` interface. Core does not derive `playing`, `transitioning`, or `paused` from Runtime-owned operational fields.

## Does not own

- Runtime transition identity or normalized animation progress
- Continuous playback intent
- Dwell scheduling
- Abort/cancellation mechanics
- Subject-specific state interpretation
- Renderer presentation
- Commentary presentation
- Host behavior
- Telemetry storage

## Allowed dependencies

May depend on stable validated-experience interfaces and semantic contracts defined by the architecture.

## Prohibited dependencies

Core must not inspect inside opaque experience `state` or `renderer_config`. Core must not know Git terminology, renderer DOM structure, transport internals, commentary internals, or harness implementation.

## Verification

The synthetic fixture must prove deterministic seek, next, previous, restart, reserved-initial behavior, semantic no-op steps, boundary `no_change` behavior, reveal-frontier rules, documented status writes, and stable commit behavior independently of Git.
