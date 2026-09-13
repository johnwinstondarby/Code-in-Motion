# Schemas

## Purpose

This directory contains machine-readable schemas for CiM runtime contracts.

## Owns

- `localis.cim/v1` experience schema
- Structured commentary-link schema
- Renderer identifier/configuration envelope rules
- Version fields required at the runtime boundary

## Does not own

- Human `.cim` authoring grammar
- Subject-specific interpretation of opaque `state`
- Engine control policy

## Allowed dependencies

Schemas reflect normative contracts defined in `docs/`.

## Prohibited dependencies

The common schema must not accumulate Git-specific fields or declarative animation instructions in v1.

## Verification

Valid and invalid fixtures exercise every required field, compatibility rule, duplicate-identifier constraint, and structured link rule.
