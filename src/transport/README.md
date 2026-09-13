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

## Does not own

- Canonical current-step truth
- Renderer control
- Commentary control
- Subject state

## Allowed dependencies

May issue documented commands to `CiMInstance` and consume read-only runtime projections needed to render transport state.

## Prohibited dependencies

Transport must never call a renderer or commentary component directly and must never infer semantic position from renderer output.

## Verification

Tests must prove command mapping, boundary behavior, keyboard operation, marker selection, scrub snapping, focus scope, and operation during rapid navigation.
