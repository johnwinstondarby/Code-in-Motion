# ADR 0002: Control Versus Observation

Status: Accepted for CiM v1

## Context

CiM needs deterministic command sequencing and a common observable event stream. Using the same event mechanism for both control and observation would make fast scrub, replay, fault recovery, and ordering harder to reason about.

The platform also needs to prevent lateral dependencies such as transport calling a renderer or commentary moving transport directly.

## Decision

Control uses direct, documented interfaces. Observation uses the ordered semantic event stream.

Commands terminate at `CiMInstance`, which authorizes and sequences cross-component work.

Examples of control operations include:

```text
play()
pause()
next()
previous()
seek(stepId)
restart()
home()
end()
```

Presentation modules may request these operations through the runtime interface, but they do not call one another.

The semantic event stream reports accepted or rejected commands, transition lifecycle, stable settlement, faults, recovery outcomes, and other externally useful observations.

The harness and telemetry systems are subscribers. They never participate in production control flow.

Frame-level animation ticks and renderer-internal progress callbacks do not belong in the normal semantic event stream.

## Consequences

- Command order is governed by one runtime authority.
- Event consumers cannot accidentally change application behavior.
- Replay records commands as inputs and compares emitted evidence as outputs.
- Telemetry can be disabled or replaced without changing runtime semantics.
- Subject renderers remain independent from transport and commentary implementations.
- Fast navigation has one sequencing path rather than an event fan-out race.

## Rejected Alternatives

### Event-driven control for all module communication

Rejected because asynchronous event consumption can create ambiguous ordering and hidden control paths during rapid navigation.

### Direct peer-to-peer control

Rejected because calls such as transport-to-renderer or renderer-to-commentary create lateral coupling and bypass canonical runtime authority.

### Harness-mediated control

Rejected because production behavior must remain identical with or without the harness attached.

## Verification

Architecture and implementation reviews must confirm:

- transport issues commands only through the runtime interface;
- commentary navigation issues commands only through the runtime interface;
- renderers do not issue semantic navigation commands;
- telemetry and harness subscribers cannot mutate production state;
- semantic events preserve a monotonic per-instance sequence;
- replay reissues recorded commands instead of feeding telemetry back into runtime control.
