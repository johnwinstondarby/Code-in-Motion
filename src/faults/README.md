# Runtime Fault Management

## Purpose

This component defines shared fault taxonomy and diagnostic structure while preserving recovery ownership in the component that owns the failed operation.

## Owns

- Stable CiM error-code namespaces
- Common error evidence shape
- Recovery-outcome vocabulary
- Learner-safe versus diagnostic detail separation

## Does not own

- Centralized recovery control for every module
- Harness fault injection
- Renderer-specific repair logic

## Allowed dependencies

Production components may emit standardized fault records through this contract.

## Prohibited dependencies

The fault layer must not become a global controller that reaches into component internals to perform recovery.

## Verification

The fault matrix maps each defined fault to an owner, recovery class, last stable state, expected diagnostic evidence, and learner-facing outcome.
