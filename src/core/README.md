# Engine Core

## Purpose

Core owns the canonical semantic session model used by a CiM instance.

## Owns

- Current committed semantic position
- Pending target position
- Playback/session status
- Transition identity and normalized progress
- Reveal-frontier state required by the runtime model
- Validation of semantic navigation requests against the loaded experience

## Does not own

- Subject-specific state interpretation
- Renderer presentation
- Commentary presentation
- Host behavior
- Telemetry storage

## Allowed dependencies

May depend on stable experience interfaces and abstract clock/scheduler contracts defined by the architecture.

## Prohibited dependencies

Core must not inspect inside opaque experience `state` or `renderer_config`. Core must not know Git terminology or renderer DOM structure.

## Verification

The synthetic fixture must prove deterministic seek, next, previous, restart, semantic no-op steps, pause/resume state, and stable commit behavior independently of Git.
