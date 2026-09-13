# Schemas

## Purpose

This directory contains machine-readable schemas for CiM runtime contracts.

## Current v1 schema

- [`localis.cim.v1.schema.json`](localis.cim.v1.schema.json) — JSON Schema Draft 2020-12 structural contract for `localis.cim/v1`
- [`fixtures/valid/`](fixtures/valid/) — experiences that must satisfy the shared contract
- [`fixtures/invalid/`](fixtures/invalid/) — experiences that must fail with the expected stable `CIM-EXP-*` condition

`tools/check-schema-fixtures.mjs` verifies the fixture set with no external package dependency.

JSON Schema owns structural constraints such as required fields, identifier shapes, reserved `initial`, non-negative integer `dwell_ms`, renderer ID shape, and the authored-content envelope. Cross-item rules that JSON Schema does not express cleanly, especially uniqueness of `steps[].id`, are enforced by the contract verifier and remain part of the normative `localis.cim/v1` contract.

## Owns

- `localis.cim/v1` experience schema
- Structured commentary-link schema
- Renderer identifier/configuration envelope rules
- Version fields required at the runtime boundary
- Reserved shared identifiers such as `initial`
- Machine-verifiable structural safety rules for authored content

## Does not own

- Human `.cim` authoring grammar
- Subject-specific interpretation of opaque `state`
- Subject-specific interpretation of `renderer_config`
- Engine control policy
- Renderer-specific subject schemas

## Allowed dependencies

Schemas reflect normative contracts defined in `docs/`, especially `docs/EXPERIENCE-SCHEMA.md` and `docs/FAULTS.md`.

## Prohibited dependencies

The common schema must not accumulate Git-specific fields, executable behavior, raw HTML authoring paths, or declarative animation instructions in v1.

## Verification

`npm run check:schema` must prove:

- the machine-readable schema preserves the normative v1 invariants;
- valid fixtures pass;
- unsupported schema identifiers produce `CIM-EXP-001`;
- incomplete shared structure produces `CIM-EXP-002`;
- duplicate step IDs produce `CIM-EXP-003`;
- authored use of reserved `initial` produces `CIM-EXP-004`;
- invalid `dwell_ms` produces `CIM-EXP-005`;
- malformed or executable commentary links produce `CIM-EXP-006`;
- opaque subject state remains uninterpreted by the shared contract checker.
