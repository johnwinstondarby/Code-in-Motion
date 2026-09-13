# Transport and Semantic Timeline

## Purpose

Transport presents learner controls and maps learner intent to semantic navigation commands.

## Owns

- Play/pause controls
- Previous/next controls
- Home/end behavior
- Semantic progress rail
- Marker selection
- Scrub interaction and snap-to-step behavior
- Keyboard transport input while focus is within CiM
- Transport-local scrub preview state

## Does not own

- Canonical current-step truth
- Continuous playback policy after a command is accepted
- Renderer control
- Commentary control
- Subject state

## Allowed dependencies

May issue documented commands to `CiMInstance` and consume read-only runtime/Core projections needed to render transport state.

## Prohibited dependencies

Transport must never call a renderer or commentary component directly and must never infer semantic position from renderer output or digest equality.

During v1 scrub drag, Transport may update only its local thumb/preview presentation. It must not issue semantic seek commands until the gesture commits. Release or equivalent commit resolves the nearest semantic boundary and submits exactly one `seek(stepId)` with observational command source `scrub`. Cancelling the gesture emits no semantic seek.

## Verification

Tests must prove command mapping, accepted `no_change` boundary behavior, keyboard operation, marker selection, release-only semantic scrub, cancelled scrub, focus scope, and operation during rapid navigation without flooding the semantic event stream.
