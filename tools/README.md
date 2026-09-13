# Verification Tools

## Purpose

This directory contains repository-level verification used by contributors and CI. These tools validate published contracts and enforce architecture boundaries; they are not part of the CiM runtime bundle.

## Authoritative gate

`npm run verify` is the authoritative repository gate.

It composes three checks:

1. `npm run check:schema` validates fixtures against the published `localis.cim/v1` JSON Schema and applies semantic post-validation for cross-item rules.
2. `npm run check:architecture` scans production source imports and privileged-control references against the architecture fences.
3. `npm test` runs direct regression tests for schema clauses, near-miss dependency violations, link-policy normalization, privileged `setStatus` forms, and shared-contract behavior.

A green individual sub-check does not imply that the complete contract gate is green. Some invariants are intentionally layered. For example, normalized link safety is defended by the published schema, semantic validation, and direct regression tests. Contributors and CI should use `npm run verify` when deciding whether a branch satisfies the repository contracts.

## Tool boundaries

Verification dependencies may exist as development dependencies and must remain outside production `src/` imports. The published schema remains the structural authority; handwritten validation is limited to semantic rules JSON Schema does not conveniently express.

The architecture checker resolves relative imports and declared `package.json` import aliases, fails closed on undeclared production bare imports, and ignores commented-out import text.

## Production-source floor

During `feat/schema-v1`, the repository contains no production source files, so `check:architecture` correctly reports zero production files checked.

Beginning with the first branch that adds production code under `src/`, verification must add a floor assertion that fails when zero production source files are discovered. This prevents a broken walker or path-resolution regression from producing a false-green architecture check.

## Verification rule

Every new rule added to a verification tool must include a regression test for a realistic near-miss or accidental bypass, not only the direct prohibited form.
