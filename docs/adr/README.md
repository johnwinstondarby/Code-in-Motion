# Architecture Decision Records

## Purpose

ADRs preserve decisions that constrain multiple CiM components or future implementations.

## Owns

- Decision context
- Chosen rule
- Consequences and rejected alternatives
- Supersession history

## Does not own

- Routine implementation notes
- Feature-specific TODO lists

## Allowed dependencies

ADRs may reference normative files under `docs/` and affected component READMEs.

## Prohibited dependencies

An ADR must not silently redefine a public contract without updating the corresponding normative specification.

## Verification

Each ADR is numbered, dated, and linked from the specification or component boundary it affects.
