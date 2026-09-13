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

## Renderer hostile probe battery

`renderer-interface-hostile.test.mjs` is the cross-seam v1 hostile/near-miss battery that complements the focused unit tests for individual renderer-interface components.

Its stable probe IDs are:

- `RC-H01`: exact ten-key context and extra authority-field rejection
- `RC-H02`: nested function-capability rejection
- `RC-H03`: prototype-method and getter rejection without getter invocation
- `RC-H04`: immutable renderer inputs and independent before/after proof
- `RC-H05`: Runtime-owned abort authority
- `RC-H06`: expected cancellation distinguished from renderer failure
- `RC-H07`: stale delayed/frame work suppressed after clock revocation
- `RC-H08`: renderer callbacks receive virtual CiM time rather than source timestamps
- `RC-H09`: experience and step renderer configuration remain separate
- `RC-H10`: canonicalization normalizes only documented representation noise
- `RC-H11`: generated identifiers normalize only when explicitly declared
- `RC-H12`: versioned render evidence and fail-closed unsupported output

The battery intentionally overlaps focused tests where the overlap proves behavior across component seams. A green focused unit test does not replace the corresponding hostile probe.

Every newly added renderer-interface rule must add or extend a plausible near-miss probe in the same review set.

## Verification

The same contract suite can be applied to multiple renderer or experience implementations without subject-specific exceptions.
