# Code in Motion (CiM) Event Model

Status: Normative v1 event contract

## 1. Purpose

CiM uses one ordered semantic event model for runtime diagnostics, harness evidence, replay comparison, and analysis.

Events are observational. They do not participate in production control flow.

Commands enter through direct runtime interfaces. Events report what Runtime and Core accepted, attempted, settled, rejected, cancelled, or recovered.

## 2. Event Envelope

Every semantic event must provide:

```json
{
  "schema": "localis.cim.event/v1",
  "instance_id": "cim-17",
  "sequence": 17,
  "timestamp_ms": 2840,
  "component": "core",
  "event": "step.changed",
  "result": "success"
}
```

### `schema`

Required string. V1 value: `localis.cim.event/v1`.

### `instance_id`

Required string identifying the mounted CiM instance.

### `sequence`

Required positive integer, monotonic and unique within one instance event stream.

Ordering is determined by `sequence`, not timestamp.

### `timestamp_ms`

Required non-negative number from the injected CiM clock for **all semantic events**.

Wall-clock UTC may be added by a telemetry sink as external metadata, but it never defines semantic ordering or replay timing.

### `component`

Required string naming the component that owns the reported operation.

Initial component names include:

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

Canonical semantic commits are Core-owned and therefore `step.changed` uses `component: "core"`.

### `event`

Required stable dotted lower-case event name.

### `result`

Required stable result string. Initial shared values:

```text
success
rejected
cancelled
failed
recovered
no_change
```

## 3. Correlation Fields

Events include these fields when applicable:

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

`command_id` correlates events caused by one command.

`transition_id` correlates one semantic destination transition. A cancelled transition ID cannot later commit a step.

`from_step`, `to_step`, and `step_id` use canonical semantic boundary IDs. The initial boundary is always represented by the literal string `initial`, never `null`.

`details` carries structured event-specific diagnostic data. It cannot become an undocumented alternate control or state channel.

## 4. Run Metadata

Harness and replay systems may associate event streams with metadata such as:

```json
{
  "run_id": "cim-test-00042",
  "scenario": "transport-basic-01",
  "seed": 12345,
  "engine_version": "1.0.0",
  "experience_id": "synthetic-basic",
  "experience_version": "1.0.0",
  "runtime_config": {}
}
```

Runtime configuration is included when site policy changes effective semantic timing, such as clamping authored dwell.

## 5. Ordering Rules

1. Each instance owns one monotonic semantic `sequence` counter.
2. `sequence` determines total order within the instance.
3. Timestamps may be equal for multiple deterministic events.
4. A transition cannot settle before it starts.
5. A cancelled transition cannot emit a later successful settlement for the same transition ID.
6. `step.changed` occurs only after stable destination settlement succeeds and Core commits the destination.
7. A rejected command cannot emit a successful transition for that command ID.
8. Recovery events follow the fault that triggered them.
9. Disposal is terminal for the instance event stream except sink-side archival metadata.

## 6. Command Events

### `command.received`

Optional diagnostic event indicating a command request arrived. It does not imply acceptance.

### `command.accepted`

Reports that Runtime accepted a command.

Accepted commands may produce `result: "no_change"`, including valid navigation that reaches a semantic boundary limit.

Boundary examples:

```json
{
  "event": "command.accepted",
  "result": "no_change",
  "details": {
    "command": "next",
    "reason": "at_end",
    "source": "transport"
  }
}
```

or:

```json
{
  "event": "command.accepted",
  "result": "no_change",
  "details": {
    "command": "previous",
    "reason": "at_start",
    "source": "transport"
  }
}
```

### `command.rejected`

Reports that Runtime rejected a genuinely invalid command without changing canonical semantic state.

Initial `details.reason` values may include:

```text
unknown_step
faulted
disposed
invalid_state
reserved_step_id
```

`at_start` and `at_end` are not rejection reasons in v1.

### Command source

`details.source` should identify the initiating control surface when useful:

```text
transport
marker
commentary
scrub
deep_link
host
replay
```

Scrub commit uses `source: "scrub"` and produces exactly one semantic `seek()` command event sequence.

## 7. Playback and Dwell Events

### `playback.started`

Continuous playback intent begins.

### `playback.paused`

Learner-controlled time is paused.

If pause occurs during an in-flight transition, include `transition_id` and `details.transition_progress`.

If pause occurs during dwell, include `details.dwell_remaining_ms`.

### `playback.resumed`

A paused transition or dwell resumes.

### `playback.stopped`

Continuous playback intent ends.

Initial reason values include:

```text
navigation
restart
at_end
fault
dispose
```

Every discrete navigation command clears continuous playback intent. If playback was active, `playback.stopped` precedes the new navigation settlement sequence.

### `dwell.started`

Optional but recommended runtime evidence that an authored dwell interval began after a stable commit during continuous playback.

Suggested fields:

```text
step_id
details.dwell_ms
```

### `dwell.completed`

Optional evidence that dwell expired normally and Runtime may begin the next transition.

### `dwell.cancelled`

Optional evidence that pause-preserved or active dwell was cancelled by navigation, restart, fault, or disposal.

Dwell events are Runtime-owned.

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

Reports that a pending transition was cancelled or superseded. Expected semantic navigation cancellation is not an error.

### `transition.settled`

Reports successful stable renderer settlement for the destination.

It precedes the Core-owned `step.changed` event when semantic position moves.

### `transition.failed`

Reports stable renderer settlement failure.

## 9. Step Events

### `step.changed`

Reports a canonical semantic position commit owned by Core.

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

An observation step emits `step.changed` even when state and render digests are unchanged.

A valid no-movement command does not emit `step.changed` because no canonical commit occurred.

### `step.initial`

Optional initialization evidence indicating stable settlement at the canonical `initial` boundary.

When emitted:

```text
step_id = initial
component = core
```

## 10. Commentary Events

### `commentary.active.changed`

Reports movement of the active authored commentary entry.

At `initial`, there is no authored active commentary entry in v1. A transition to `initial` may therefore report the active entry clearing through structured details.

### `commentary.frontier.changed`

Reports an increase or explicit restart reset of the reveal frontier.

The initial frontier is `initial`.

Backward seeks do not reduce the frontier. Restart may reset it to `initial`.

### `commentary.autofollow.changed`

Optional UI-observation event with no semantic authority.

## 11. Renderer Events

### `renderer.mounted`

Reports successful renderer mount.

### `renderer.settled`

Optional renderer-level evidence that a render call completed stable output. Runtime-level `transition.settled` remains the semantic settlement event.

### `renderer.cancelled`

Reports or optionally records that an in-flight render honored expected cancellation.

Expected abort is not `renderer.error` and does not trigger fault recovery by itself.

### `renderer.error`

Reports a renderer-owned failure.

### `renderer.disposed`

Reports completed renderer disposal.

## 12. Recovery and Fault Events

### `recovery.started`

Runtime began restoration to a known committed stable boundary.

### `recovery.succeeded`

Restoration succeeded. Result is `recovered`.

### `recovery.failed`

Restoration failed and normal playback cannot continue.

### `instance.faulted`

Core entered terminal runtime fault state for normal playback.

### `host.fallback.shown`

Host exposed the static fallback or unavailable presentation while preserving the surrounding page.

## 13. Validation and Loading Events

### `experience.validation.succeeded`

Optional evidence that the shared schema gate passed.

### `experience.validation.failed`

Reports schema-gate failure, including stable validation diagnostics.

### `renderer.resolve.failed`

Reports unresolved renderer identifier.

### `experience.load.failed`

Reports inability to obtain the experience definition.

## 14. Accessibility Evidence

Accessibility is cross-cutting rather than a control subsystem.

The harness may record evidence such as:

```text
accessibility.focus.changed
accessibility.announcement
accessibility.reduced_motion.applied
```

These events cannot command playback or semantic navigation.

## 15. Render and State Digests

Harness evidence may associate canonical state and render digests with settlement events or assertion records:

```json
{
  "step_id": "step-03",
  "state_digest": "...",
  "render_digest": "..."
}
```

Digests are evidence, not semantic identifiers.

Two different semantic positions may intentionally have identical digest values.

The harness canonicalizer owns render-digest normalization. Renderer code does not provide its own conformance digest.

## 16. Frame-Level and Scrub-Preview Data

Animation-frame events, per-frame transforms, high-frequency renderer ticks, and pointer-level scrub-preview changes are outside the semantic event stream.

A specialized profiler may capture such data separately, but that data cannot redefine semantic ordering or replay authority.

V1 scrub emits semantic events only when the gesture commits its single `seek()`.

## 17. Replay Contract

Deterministic replay stores or reconstructs:

```text
scenario
seed
engine version
renderer identifier/version
experience version
validated experience
effective runtime configuration
command sequence
command source where semantically relevant
command timing on the virtual clock
```

Replay reissues commands through normal runtime interfaces.

The resulting semantic event stream and evidence are compared with expected or recorded results.

Replay does not drive Runtime by feeding prior semantic events back into the engine.

## 18. Initial Event Catalog

```text
command.received                optional
command.accepted
command.rejected
playback.started
playback.paused
playback.resumed
playback.stopped
dwell.started                   optional/recommended
dwell.completed                 optional/recommended
dwell.cancelled                 optional/recommended
transition.started
transition.cancelled
transition.settled
transition.failed
step.changed
step.initial                    optional
commentary.active.changed
commentary.frontier.changed
commentary.autofollow.changed   optional
renderer.mounted
renderer.settled                optional
renderer.cancelled              optional
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
accessibility.focus.changed      verification
accessibility.announcement       verification
accessibility.reduced_motion.applied verification
```

Adding an event in v1 must not change the meaning or required ordering of an already published event.

## 19. Harness Assertions

The harness must be able to assert that:

- command order is deterministic;
- all semantic timestamps come from the injected clock;
- `initial` is represented consistently rather than as `null`;
- transition start precedes settlement or cancellation;
- stale cancelled transitions cannot settle successfully;
- semantic commit occurs only after stable settlement and is Core-owned;
- observation steps advance semantic position even when digests remain equal;
- valid start/end boundary commands are accepted `no_change` results rather than rejections;
- navigation clears continuous playback intent;
- pause and resume preserve transition or dwell timing semantics;
- scrub commit emits one seek and drag preview emits no semantic seek;
- faults precede recovery attempts;
- recovery outcome is explicit;
- unrecoverable failures lead to instance fault/fallback evidence;
- multiple instance streams remain independently ordered.
