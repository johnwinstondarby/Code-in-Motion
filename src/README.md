# Production Runtime

## Purpose

`src/` contains production CiM code only.

## Owns

- Runtime composition
- Canonical session behavior
- Learner transport
- Commentary projection
- Accessibility implementation support
- Renderer contracts and production renderers
- Experience ingestion
- Host integration
- Runtime fault reporting
- Runtime telemetry interfaces
- Shared presentation assets

## Does not own

- Synthetic harness control logic
- Test scenarios
- Git-specific experience data

## Allowed dependencies

Dependencies must follow the component READMEs and the one-way architecture defined in `docs/`.

## Prohibited dependencies

Production modules must never import `harness/` or test-only code.

## Verification

Dependency tests and architecture review must catch lateral or reverse imports that violate a component boundary.
