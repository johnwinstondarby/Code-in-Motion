# Experience Data

## Purpose

This directory contains runtime experience definitions that conform to the current CiM experience schema.

## Owns

- Experience metadata
- Ordered semantic steps
- Labels and markers
- Commentary and structured links
- Opaque subject state
- Opaque renderer configuration

## Does not own

- Executable engine logic
- Runtime JavaScript
- Renderer implementation
- Site-wide plugin configuration

## Allowed dependencies

Experience payloads conform to machine-readable schemas under `schemas/`.

## Prohibited dependencies

Experience data must not contain executable page content or require core to interpret subject-specific state.

## Verification

Every runtime experience passes schema validation before the engine receives it.
