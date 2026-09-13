# Tests

## Purpose

This directory contains automated tests organized around component boundaries and public contracts.

## Current schema-v1 tests

- `architecture-boundaries.test.mjs` proves that documented forbidden import edges fail and that only `src/runtime/` may call `Core.setStatus(nextStatus)`.
- `schema-contract.test.mjs` proves shared schema semantics, including opaque subject state and stable `CIM-EXP-*` outcomes.

The test suite uses the Node.js built-in test runner and adds no package dependency.

## Owns

- Component tests
- Integration tests
- Conformance tests
- Regression tests
- Architecture/dependency checks
- Contract-verifier self-tests

## Does not own

- Production behavior
- Harness implementation
- Normative architecture decisions

## Allowed dependencies

Tests may import the component or repository verifier under test and approved test utilities.

## Prohibited dependencies

Tests must not normalize away contract violations merely to make an implementation pass. A test utility cannot weaken a production boundary or substitute its own meaning for a normative schema rule.

## Verification

Every feature branch declares the tests and acceptance gates required before merge.

For `feat/schema-v1`, `npm run verify` must pass the schema fixture gate, architecture boundary gate, and Node test suite before merge.
