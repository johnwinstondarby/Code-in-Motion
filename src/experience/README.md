# Experience Loading and Validation

## Purpose

This component resolves an experience ID, validates the runtime payload, and supplies a version-compatible experience to CiM.

## Owns

- Experience ID resolution
- Schema compatibility checks
- Engine-minimum checks
- Runtime validation boundary
- Rejection of invalid or incomplete experience payloads

## Does not own

- Human authoring syntax
- Subject state interpretation
- Renderer behavior
- Host page presentation

## Allowed dependencies

May depend on `schemas/` artifacts and documented runtime data interfaces.

## Prohibited dependencies

No authoring path may bypass validation. This component must not inspect opaque subject `state` beyond schema-level presence/type rules defined by the runtime contract.

## Verification

Tests cover invalid schema, duplicate step IDs, missing required state, unsupported versions, malformed structured links, and deterministic error reporting.
