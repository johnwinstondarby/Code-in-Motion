# Documentation

## Purpose

This directory holds the normative architecture and public contracts for Code in Motion.

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

## Verification

Before architecture work merges, public interfaces, ownership boundaries, fault ownership, timing semantics, and cross-module communication rules must have no unresolved decision that would force an incompatible implementation later.
