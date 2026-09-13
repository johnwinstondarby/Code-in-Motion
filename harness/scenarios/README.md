# Harness Scenarios

## Purpose

Scenarios define deterministic command sequences, injected conditions, and independent expected outcomes.

## Owns

- Scenario identifiers
- Initial conditions
- Command sequences
- Fault-injection instructions
- Expected semantic positions
- Expected state/render equivalence assertions
- Expected telemetry assertions

## Does not own

- Production implementation logic
- Runtime recovery code

## Allowed dependencies

Scenarios reference public production commands, synthetic experiences, and harness-owned injection seams.

## Prohibited dependencies

Expected outcomes must not be computed by calling the same production function whose behavior is under test.

## Verification

Baseline scenarios cover forward movement, reverse, direct seek, pause/resume mid-transition, navigation cancellation, semantic no-op steps, stale callbacks, renderer failure, reduced motion, deep links, multi-instance isolation, and replay.
