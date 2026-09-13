# Documentation

## Purpose

This directory holds the normative architecture and public contracts for Code in Motion.

## Normative documents

- [`CIM-ARCHITECTURE.md`](CIM-ARCHITECTURE.md) — component authority, dependency direction, composition, ingestion, timing ownership, harness separation, and architecture acceptance gates
- [`CIM-SPEC.md`](CIM-SPEC.md) — canonical session semantics, commands, transitions, playback intent, dwell, scrub, renderer lifecycle, commentary, deep links, reduced motion, and fault settlement
- [`RENDERER-CONTRACT.md`](RENDERER-CONTRACT.md) — exact v1 renderer context, capability facades, timing authority, immutability, conformance surface, canonicalization, and renderer-interface acceptance tests
- [`EXPERIENCE-SCHEMA.md`](EXPERIENCE-SCHEMA.md) — `localis.cim/v1` runtime experience contract, reserved `initial` boundary, authored dwell, and neutral synthetic fixture
- [`EVENTS.md`](EVENTS.md) — `localis.cim.event/v1` semantic event envelope, ordering, event catalog, telemetry, evidence, and replay rules
- [`FAULTS.md`](FAULTS.md) — v1 fault ownership, recovery classes, error-code namespaces, restoration anchors, and fallback outcomes
- [`adr/`](adr/) — Architecture Decision Records preserving cross-component decisions and rejected alternatives

## Owns

- Platform architecture and dependency rules
- Runtime semantics
- Renderer capability and conformance contracts
- Experience schema documentation
- Event model documentation
- Fault ownership and recovery contracts
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

For v1 development, the normative documents above define shared behavior. `CIM-SPEC.md` §3 is the single normative session-model definition. `RENDERER-CONTRACT.md` is the detailed normative renderer-interface contract and must remain aligned with `CIM-SPEC.md` §10 before renderer implementation merges. Component READMEs define local ownership boundaries within those rules. ADRs explain and preserve decisions but do not silently override the corresponding normative contract.

When documents conflict, the conflict must be resolved explicitly on an architecture or contract branch before dependent implementation merges.

## Verification

Before architecture or public-contract work merges, public interfaces, ownership boundaries, fault ownership, timing semantics, semantic scrub behavior, renderer capability surfaces, and cross-module communication rules must have no unresolved decision that would force an incompatible implementation later.
