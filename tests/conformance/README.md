# Conformance Tests

## Purpose

Conformance tests determine whether an implementation satisfies CiM's published platform contracts.

## Owns

- Renderer conformance
- Experience-schema conformance
- Event-envelope conformance
- Accessibility gates that apply platform-wide
- Dependency-boundary checks

## Does not own

- Subject correctness beyond the public contract

## Allowed dependencies

Uses harness-owned observation and canonicalization where required.

## Prohibited dependencies

A component under test cannot define the rule by which its own conformance is judged.

## Verification

The same contract suite can be applied to multiple renderer or experience implementations without subject-specific exceptions.
