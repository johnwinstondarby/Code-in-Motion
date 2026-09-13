# Documentation

## Purpose

This directory holds the normative architecture and public contracts for Code in Motion.

## Normative documents

- [`CIM-ARCHITECTURE.md`](CIM-ARCHITECTURE.md) — component authority, dependency direction, composition, ingestion, harness separation, and architecture acceptance gates
- [`CIM-SPEC.md`](CIM-SPEC.md) — canonical session semantics, commands, transitions, renderer lifecycle, commentary, deep links, reduced motion, and fault settlement
- [`EXPERIENCE-SCHEMA.md`](EXPERIENCE-SCHEMA.md) — `localis.cim/v1` runtime experience contract and neutral synthetic fixture
- [`EVENTS.md`](EVENTS.md) — `localis.cim.event/v1` semantic event envelope, ordering, event catalog, telemetry, evidence, and replay rules
- [`adr/`](adr/) — Architecture Decision Records that preserve cross-component decisions and rejected alternatives

## Owns

- Platform architecture and dependency rules
- Runtime semantics
- Experience schema documentation
- Event model documentation
- Architecture Decision Records (ADRs)
- Acceptance gates that affect more than one component

## Does not own

- Production runtime implementation
- Subject-specific renderer behavior
- Test fixtures or synthetic scenarios

## Allowed dependencies

Documentation may describe every CiM component and contract.

## Prohibited dependencies

Normative architecture must not depend on Git-specific behavior for its correctness.

## Contract precedence

For v1 development, the normative documents above define shared behavior. Component READMEs define local ownership boundaries within those rules. ADRs explain and preserve decisions but do not silently override the corresponding normative contract.

When documents conflict, the conflict must be resolved explicitly on an architecture branch before dependent implementation merges.

## Verification

Before architecture work merges, public interfaces, ownership boundaries, fault ownership, timing semantics, and cross-module communication rules must have no unresolved decision that would force an incompatible implementation later.
