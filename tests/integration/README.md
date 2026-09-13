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

## Does not own

- Synthetic fault generation logic
- Subject-specific unit tests

## Allowed dependencies

May instantiate multiple production components and stable fixtures.

## Prohibited dependencies

Integration tests must not rely on private cross-module state access that production code is forbidden to use.

## Verification

Tests exercise public seams and confirm ordering, isolation, cleanup, and stable failure behavior.
