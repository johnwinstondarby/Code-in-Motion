# Tests

## Purpose

This directory contains automated tests organized around component boundaries and public contracts.

## Owns

- Component tests
- Integration tests
- Conformance tests
- Regression tests
- Architecture/dependency checks

## Does not own

- Production behavior
- Harness implementation

## Allowed dependencies

Tests may import the component under test and approved test utilities.

## Prohibited dependencies

Tests must not normalize away contract violations merely to make an implementation pass.

## Verification

Every feature branch declares the tests and acceptance gates required before merge.
