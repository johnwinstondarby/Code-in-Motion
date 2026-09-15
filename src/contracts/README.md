# Shared Contracts

## Purpose

`src/contracts/` holds dependency-free shared values and interface vocabulary that multiple production components may consume without importing one another.

This directory exists to preserve component fences. Shared status names, reserved boundary identifiers, result/reason values, event vocabulary, and stable error-code constants belong here when more than one component needs them.

## Owns

- Shared value constants and enums
- Reserved semantic identifiers such as `initial`
- Stable command result and reason vocabulary
- Shared event/fault identifiers that require one canonical spelling
- Dependency-free interface value shapes where a common representation is required

`events.mjs` carries the v1 event schema identifier, event result vocabulary, component names, command-source names, and the stable event-name catalog defined by `docs/EVENTS.md`. It contains names only; event sequencing and publication remain Runtime behavior.

## Does not own

- Canonical session state
- Runtime orchestration
- Component behavior
- DOM or presentation logic
- Renderer state interpretation
- Validation policy that belongs to the experience/schema boundary

## Allowed dependencies

Shared contracts may depend only on other files within `src/contracts/` and language/runtime primitives that do not introduce a production component dependency.

Production components may import shared contracts.

## Prohibited dependencies

`src/contracts/` must not import Core, Runtime, Transport, Commentary, Renderers, Host, Telemetry, Accessibility, Experience, Harness, or subject implementations.

Shared contracts cannot become a backchannel for component behavior or mutable runtime state.

## Verification

The architecture boundary checker enforces that contracts cannot import another production component while components such as Transport may import contracts without weakening their Core fence.
