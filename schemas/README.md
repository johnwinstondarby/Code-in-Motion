# Schemas

## Purpose

This directory contains machine-readable schemas for CiM runtime contracts.

## Current v1 schema

- [`localis.cim.v1.schema.json`](localis.cim.v1.schema.json) — JSON Schema Draft 2020-12 structural contract for `localis.cim/v1`
- [`fixtures/valid/`](fixtures/valid/) — experiences that must satisfy the shared contract
- [`fixtures/invalid/`](fixtures/invalid/) — experiences that must fail with the expected stable `CIM-EXP-*` condition

`tools/check-schema-fixtures.mjs` compiles the published schema with Ajv and validates every fixture against that artifact. Ajv is a development/CI-only dependency and is not imported by production code under `src/`.

JSON Schema owns structural constraints such as required fields, identifier shapes, reserved `initial`, non-null opaque state, non-negative integer `dwell_ms`, renderer ID shape, commentary structure, and the authored-link allowlist. Cross-item rules that JSON Schema does not express cleanly, especially uniqueness of `steps[].id` and link IDs within one commentary entry, are enforced by semantic post-validation.

The fixture gate requires each invalid fixture to produce exactly its intended distinct `CIM-EXP-*` code rather than passing because of unrelated extra failures.

## Owns

- `localis.cim/v1` experience schema
- Structured commentary-link schema
- Renderer identifier/configuration envelope rules
- Version fields required at the runtime boundary
- Reserved shared identifiers such as `initial`
- Machine-verifiable structural safety rules for authored content

## Does not own

- Human `.cim` authoring grammar
- Subject-specific interpretation of non-null opaque `state`
- Subject-specific interpretation of `renderer_config`
- Engine control policy
- Renderer-specific subject schemas

## Allowed dependencies

Schemas reflect normative contracts defined in `docs/`, especially `docs/EXPERIENCE-SCHEMA.md` and `docs/FAULTS.md`.

## Prohibited dependencies

The common schema must not accumulate Git-specific fields, executable behavior, raw HTML authoring paths, or declarative animation instructions in v1.

## Verification

`npm run check:schema` must prove:

- the published JSON Schema itself is compiled and exercised;
- valid fixtures pass, including the permissive optional-field surface;
- empty `steps`, malformed renderer IDs, and missing commentary links fail structurally;
- unsupported schema identifiers produce `CIM-EXP-001`;
- incomplete shared structure and null state produce `CIM-EXP-002`;
- duplicate step IDs produce `CIM-EXP-003`;
- authored use of reserved `initial` produces `CIM-EXP-004`;
- invalid `dwell_ms` produces `CIM-EXP-005`;
- malformed, obfuscated, or non-allowlisted commentary links produce `CIM-EXP-006`;
- opaque non-null subject state remains uninterpreted by the shared contract checker.
