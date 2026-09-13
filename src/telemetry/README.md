# Telemetry, Evidence, Replay, and Analysis Interfaces

## Purpose

This component defines the ordered observation stream used for runtime diagnosis and harness evidence.

## Owns

- Event envelope
- Per-instance sequence ordering
- Virtual/semantic timing fields
- Component and operation identifiers
- Correlation and transition identifiers
- Result and recovery evidence
- Runtime observation interfaces

## Does not own

- Production command flow
- Animation-frame transport
- Harness replay control

## Allowed dependencies

Production components emit observational records through the telemetry interface. Subscribers may consume them without participating in control.

## Prohibited dependencies

Telemetry events must not serve as the normal command channel. Frame-level animation ticks remain outside the semantic event stream.

## Verification

Tests prove ordering, instance isolation, stable event shape, correlation across transitions and faults, and sufficient evidence for independent replay comparison.
