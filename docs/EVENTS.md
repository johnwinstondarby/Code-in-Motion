# Code in Motion (CiM) Event Model

Status: Normative v1 event contract

## 1. Purpose

CiM uses one ordered semantic event model for runtime diagnostics, harness evidence, replay comparison, and analysis.

Events are observational. They do not participate in production control flow.

Commands enter through direct runtime interfaces. Events report what the runtime accepted, attempted, settled, rejected, or recovered.

## 2. Event Envelope

Every semantic event must provide the following common fields:

```json
{
  "schema": "localis.cim.event/v1",
  "instance_id": "cim-17",
  "sequence": 17,
  "timestamp_ms": 2840,
  "component": "runtime",
  "event": "step.changed",
  "result": "success"
}
```

### `schema`

Required string.

For v1:

```text
localis.cim.event/v1
```

### `instance_id`

Required string.

Identifies the mounted CiM instance that emitted or owns the event.

### `sequence`

Required positive integer.

Sequence numbers are monotonic and unique within one instance event stream.

Ordering is determined by `sequence`, not by timestamp.

### `timestamp_ms`

Required non-negative number.

Represents elapsed time from the instance/runtime evidence epoch using the injected CiM clock where semantic timing is involved.

Wall-clock UTC may be added by a telemetry sink as external metadata, but it does not define semantic ordering or replay timing.

### `component`

Required string naming the component that owns the reported operation.

Initial v1 component names include:

```text
host
runtime
core
transport
commentary
renderer
accessibility
experience
telemetry
```

Subject renderers may additionally include a stable renderer identifier in `details`.

### `event`

Required stable event name.

Event names use dotted lower-case identifiers such as:

```text
command.accepted
transition.started
step.changed
renderer.error
```

### `result`

Required stable result string.

Initial shared values are:

```text
success
rejected
cancelled
failed
recovered
no_change
```

Specific events may restrict the applicable subset.

## 3. Optional Correlation Fields

Events include the following fields when applicable:

```json
{
  "command_id": "cmd-42",
  "transition_id": "txn-19",
  "from_step": "step-02",
  "to_step": "step-03",
  "step_id": "step-03",
  "error_code": "CIM-RND-004",
  "recovered": true,
  "details": {}
}
```

### `command_id`

Correlates events caused by one accepted learner, host, or replay command.

### `transition_id`

Correlates events belonging to one semantic destination transition.

A cancelled transition ID cannot later commit a step.

### `from_step`

The committed source step before an operation. The initial boundary may be represented as `null`.

### `to_step`

The requested destination step. The initial boundary may be represented as `null`.

### `step_id`

The semantic step primarily associated with the event when a from/to pair is unnecessary.

### `error_code`

Stable production error code for fault events.

### `recovered`

Boolean recovery outcome where a fault event reports recovery directly.

### `details`

Structured event-specific diagnostic data.

`details` must not become an alternate control or state channel. Consumers cannot depend on undocumented private keys for platform correctness.

## 4. Run Metadata

Harness and replay systems may associate the event stream with run-level metadata such as:

```json
{
  "run_id": "cim-test-00042",
  "scenario": "transport-basic-01",
  "seed": 12345,
  "engine_version": "1.0.0",
  "experience_id": "synthetic-basic",
  "experience_version": "1.0.0"
}
```

Run metadata may live beside the event stream rather than being repeated in every event.

A sink may repeat `run_id` in event records for convenience, but runtime correctness cannot depend on that field.

## 5. Event Ordering Rules

The following rules are normative:

1. Each instance owns one monotonic semantic `sequence` counter.
2. `sequence` determines total order within the instance.
3. Timestamps may be equal for multiple deterministic events.
4. A transition cannot settle before it starts.
5. A cancelled transition cannot emit a later successful settlement for the same transition ID.
6. `step.changed` occurs only after stable destination settlement succeeds.
7. A rejected command cannot emit a successful transition for that command ID.
8. Recovery events follow the fault that triggered them.
9. Disposal is terminal for the instance event stream except for sink-side archival metadata.

## 6. Command Events

### `command.received`

Optional diagnostic event recording that runtime received a command request.

This event does not imply acceptance.

Suggested fields:

```text
command_id
details.command
step_id or details.requested_step
```

### `command.accepted`

Reports that runtime accepted a command for execution.

### `command.rejected`

Reports that runtime rejected a command without changing canonical semantic state.

Suggested `details.reason` values may include:

```text
unknown_step
at_start
at_end
faulted
disposed
invalid_state
```

Result codes must remain stable once published.

## 7. Playback Events

### `playback.started`

Continuous playback intent begins from a stable boundary.

### `playback.paused`

Learner-controlled time is paused.

If emitted during an in-flight transition, include `transition_id` and current normalized progress in `details.transition_progress`.

### `playback.resumed`

A paused in-flight transition resumes.

### `playback.stopped`

Continuous playback intent ends because of explicit stop-equivalent behavior, restart, final-step settlement, or fault. The reason belongs in structured details.

## 8. Transition Events

### `transition.started`

Reports creation of a transition toward a semantic destination.

Required correlation fields:

```text
command_id
transition_id
from_step
to_step
```

### `transition.cancelled`

Reports that a pending transition was cancelled or superseded.

A cancellation is expected behavior during semantic navigation and is not automatically an error.

### `transition.settled`

Reports successful stable renderer settlement for the destination.

`transition.settled` precedes the canonical `step.changed` event for a semantic step destination.

### `transition.failed`

Reports that stable renderer settlement failed.

The runtime may then attempt restoration of the last committed boundary.

## 9. Step Events

### `step.changed`

Reports canonical semantic position commit.

Example:

```json
{
  "schema": "localis.cim.event/v1",
  "instance_id": "cim-17",
  "sequence": 17,
  "timestamp_ms": 2840,
  "component": "core",
  "event": "step.changed",
  "command_id": "cmd-42",
  "transition_id": "txn-19",
  "from_step": "step-02",
  "to_step": "step-03",
  "step_id": "step-03",
  "result": "success"
}
```

An observation step may emit `step.changed` even when state and render digests are unchanged.

### `step.initial`

Optional initialization evidence indicating settlement at the initial boundary.

Implementations may instead represent initialization through instance and renderer events as long as replay evidence can prove the initial state deterministically.

## 10. Commentary Events

### `commentary.active.changed`

Reports that the active commentary projection moved to a new semantic step.

### `commentary.frontier.changed`

Reports an increase or explicit restart reset of the reveal frontier.

Backward seeks do not emit a frontier decrease.

A restart reset may set the frontier to the initial value and should state the reason in details.

### `commentary.autofollow.changed`

Optional UI-observation event for harness accessibility/interaction coverage. It has no authority over semantic position.

## 11. Renderer Events

### `renderer.mounted`

Reports successful renderer mount for the instance.

### `renderer.settled`

Optional renderer-level evidence that a specific render call completed stable output.

The runtime-level `transition.settled` remains the semantic settlement event.

### `renderer.cancelled`

Optional evidence that an in-flight render honored cancellation.

### `renderer.error`

Reports a renderer-owned failure.

Example:

```json
{
  "schema": "localis.cim.event/v1",
  "instance_id": "cim-17",
  "sequence": 23,
  "timestamp_ms": 3310,
  "component": "renderer",
  "event": "renderer.error",
  "transition_id": "txn-19",
  "step_id": "step-03",
  "error_code": "CIM-RND-004",
  "result": "failed"
}
```

### `renderer.disposed`

Reports completed renderer disposal.

## 12. Recovery and Fault Events

### `recovery.started`

Reports that runtime began restoration to a known committed stable boundary.

### `recovery.succeeded`

Reports successful restoration.

Result is `recovered`.

### `recovery.failed`

Reports that restoration failed and the instance cannot resume normal playback.

### `instance.faulted`

Reports transition to the terminal runtime fault state for normal playback.

### `host.fallback.shown`

Reports that the host exposed the static fallback or unavailable presentation for the failed instance.

The surrounding page must remain usable.

## 13. Validation and Loading Events

### `experience.validation.succeeded`

Optional runtime diagnostic confirming that the shared schema gate passed.

### `experience.validation.failed`

Reports failure of the shared experience validation gate.

Include stable validation code(s) or structured diagnostics in `details`.

### `renderer.resolve.failed`

Reports that the requested renderer identifier could not be resolved.

### `experience.load.failed`

Reports host/runtime inability to obtain the experience definition.

## 14. Accessibility Evidence

Accessibility is a cross-cutting contract rather than a control subsystem.

The harness may record semantic accessibility evidence such as:

```text
accessibility.focus.changed
accessibility.announcement
accessibility.reduced_motion.applied
```

These events are intended for verification and diagnostics. They cannot command playback or semantic navigation.

The exact required accessibility event subset may expand as the accessibility module is specified.

## 15. Render and State Digests

Harness evidence may associate canonical state and render digests with settlement events or assertion records.

Recommended evidence shape:

```json
{
  "step_id": "step-03",
  "state_digest": "...",
  "render_digest": "..."
}
```

Digests are evidence, not semantic identifiers.

Two different semantic positions may intentionally have the same digest values.

The harness canonicalizer owns `render_digest` normalization. Renderer code does not provide its own conformance digest.

## 16. Frame-Level Data

Animation-frame events, per-frame transforms, and high-frequency renderer ticks are outside the normal semantic event stream.

A specialized performance profiler may capture such data separately, but that stream must not redefine semantic ordering or replay authority.

## 17. Replay Contract

Deterministic replay stores or reconstructs:

```text
scenario
seed
engine version
experience version
validated experience
command sequence
command timing on the virtual clock
```

Replay reissues commands through the same runtime interfaces used by normal operation.

The resulting semantic event stream and evidence are compared with expected or recorded results.

Replay does not drive runtime by feeding prior semantic events back into the engine.

## 18. Initial Event Catalog

The initial v1 catalog is:

```text
command.received               optional
command.accepted
command.rejected
playback.started
playback.paused
playback.resumed
playback.stopped
transition.started
transition.cancelled
transition.settled
transition.failed
step.changed
step.initial                   optional
commentary.active.changed
commentary.frontier.changed
commentary.autofollow.changed  optional
renderer.mounted
renderer.settled               optional
renderer.cancelled             optional
renderer.error
renderer.disposed
recovery.started
recovery.succeeded
recovery.failed
instance.faulted
host.fallback.shown
experience.validation.succeeded optional
experience.validation.failed
renderer.resolve.failed
experience.load.failed
accessibility.focus.changed     verification
accessibility.announcement      verification
accessibility.reduced_motion.applied verification
```

Adding an event in v1 must not change the meaning or required ordering of an already published event.

## 19. Harness Assertions

The harness must be able to assert from the event stream that:

- command order is deterministic;
- transition start precedes settlement or cancellation;
- stale cancelled transitions cannot settle successfully;
- semantic commit occurs only after stable settlement;
- observation steps advance semantic position even when digests remain equal;
- pause and resume preserve transition identity and progress semantics;
- faults precede recovery attempts;
- recovery outcome is explicit;
- unrecoverable failures lead to instance fault/fallback evidence;
- multiple instance streams remain independently ordered.
