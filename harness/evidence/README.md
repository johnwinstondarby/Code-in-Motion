# Harness Evidence and Analysis

## Purpose

This directory holds harness-side evidence processing, canonicalization rules, replay comparison, and analysis outputs.

## Owns

- Evidence collection
- Harness-owned render canonicalization
- Canonical render digests
- Replay comparison
- Assertion results
- Analysis summaries

## Does not own

- Production telemetry emission
- Renderer-specific digest logic

## Allowed dependencies

Consumes production telemetry and inspectable renderer output through documented observation surfaces.

## Prohibited dependencies

Canonicalization must remain renderer-agnostic. Normalization is limited to an explicit allowlist such as attribute order, insignificant serialization whitespace, harness-recognized generated-ID substitution, and approved ARIA bookkeeping differences.

## Verification

Conformance compares direct seek, sequential arrival, restored arrival, reverse arrival, and animation-end settlement at the same semantic boundary.
