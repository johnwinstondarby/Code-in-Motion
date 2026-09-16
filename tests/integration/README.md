# Integration Tests

## Purpose

Integration tests prove that production components cooperate through their documented interfaces.

## Owns

- Runtime composition tests
- Transport-to-runtime command tests
- Runtime-to-renderer coordination
- Commentary synchronization
- Host initialization/fallback interaction
- Multi-instance behavior
- Complete learner-path composition across Runtime, Transport, and Commentary

## Does not own

- Synthetic fault generation logic
- Subject-specific unit tests
- Production composition authority

## Allowed dependencies

May instantiate multiple production components and stable fixtures through their documented public seams.

## Prohibited dependencies

Integration tests must not rely on private cross-module state access that production code is forbidden to use. Expected outcomes must remain independent from the production policy function under test.

## Complete learner path

`complete-learner-path.test.mjs` executes the deterministic scenario documented in `harness/scenarios/complete-learner-path.md`.

The scenario covers initialization, Transport navigation, marker provenance, scrub preview and release-only commit, monotonic reveal history, Commentary-local selection, fixed-provenance Commentary navigation, same-boundary no-change behavior, Restart reconciliation, playback pause/resume, and terminal disposal.

The test composes existing narrow production surfaces. It does not introduce a cross-component production controller.

## Verification

Tests exercise public seams and confirm ordering, provenance, isolation, cleanup, stable no-change behavior, and terminal lifecycle behavior.
