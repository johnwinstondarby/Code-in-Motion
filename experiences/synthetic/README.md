# Synthetic Experiences

## Purpose

Synthetic experiences provide neutral deterministic data for proving CiM independently of Git or any other teaching subject.

## Owns

- Minimal state fixtures such as A, B, C, and D
- Semantic no-op/observation steps
- Deterministic state and commentary fixtures
- Neutral renderer configuration used by conformance scenarios

## Does not own

- Harness control logic
- Git terminology
- Production fault handling

## Allowed dependencies

Conforms only to the common CiM experience schema and synthetic renderer contract.

## Prohibited dependencies

Synthetic fixtures must remain understandable and valid without Git, WordPress, or Localis subject content.

## Verification

The canonical fixture includes two distinct semantic positions with identical subject state so tests prove that digest equality never substitutes for semantic position.
