# Tests

## Purpose

This directory contains automated tests organized around component boundaries and public contracts.

## Owns

- Component tests
- Integration tests
- Conformance tests
- Regression tests
- Architecture/dependency checks

## Current schema-v1 coverage

`tests/schema-contract.test.mjs` proves that the published JSON Schema is executed directly and protects the structural clauses most likely to drift, including `steps.minItems`, renderer ID shape, required commentary links, link allowlisting, reserved `initial`, non-null opaque state, duplicate IDs, and dwell constraints.

`tests/architecture-boundaries.test.mjs` includes near-miss cases rather than only obvious violations. It covers relative and package-alias imports, renderer/host/telemetry/accessibility fences, production-to-harness isolation, dependency-free shared contracts, undeclared bare imports, commented-out imports, and direct/destructured/bound/computed references to the privileged Core `setStatus` seam.

## Does not own

- Production behavior
- Harness implementation

## Allowed dependencies

Tests may import the component or verification tool under test and approved test utilities.

## Prohibited dependencies

Tests must not normalize away contract violations merely to make an implementation pass.

## Verification

Every feature branch declares the tests and acceptance gates required before merge.

For `feat/schema-v1`, `npm run verify` must pass on the supported Node matrix in GitHub Actions and on a developer checkout after `npm ci`.
