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
10. When final-step dwell is non-zero during continuous playback, `dwell.completed` precedes `playback.stopped` with `details.reason: "at_end"`.
11. Disposal cancels outstanding lifecycle, transition, and dwell work before the event stream closes. An initialization or recovery lifecycle opened before disposal closes with `initialization.cancelled` or `recovery.cancelled`.
12. An honored in-flight renderer abort emits `renderer.cancelled`. If disposal-time abort acknowledgement exceeds the bounded injected-time window, `renderer.error` with `CIM-RND-002` is emitted instead and any later renderer completion is silent.
13. Core reaches canonical `disposed` before Runtime awaits `renderer.dispose()`. Successful renderer teardown ends the semantic stream with `renderer.disposed`. A renderer teardown rejection ends it with `renderer.error` carrying `details.operation: "dispose"`. A teardown acknowledgement timeout ends it with `renderer.error`, `CIM-RND-003`, and `details.operation: "dispose_acknowledgement"`.
14. Stale transition, dwell, initialization, recovery, render, or renderer-dispose callbacks cannot publish semantic events after terminal disposal closes the stream.
15. Successful initialization emits exactly one `step.initial` for the resolved entry boundary. Initialization does not emit `step.changed`.

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

After terminal disposal, command APIs may return a stable `disposed` rejection without emitting `command.rejected` because the semantic event stream is already closed.

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

If pause occurs during an in-flight transition, include `transition_id` and:

```text
details.transition_phase = in_flight
```

V1 does not publish fractional transition progress because Runtime has no authoritative fractional transition-progress source. Pause conformance is demonstrated by frozen renderer clock work, preserved transition identity, preserved Core target, and absence of semantic commit while paused.

If pause occurs during dwell, include `details.dwell_remaining_ms`. `dwell_remaining_ms` is the exact Runtime-owned resumable quantity.

### `playback.resumed`

A paused transition or dwell resumes.

When a transition resumes, include the preserved `transition_id` and `details.transition_phase: "in_flight"`. When dwell resumes, include `details.dwell_remaining_ms` for the preserved remainder.

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

If continuous playback reaches the final step with non-zero authored dwell, `playback.stopped` with reason `at_end` is emitted only after the required final `dwell.completed` event. With zero final dwell, the stop follows final-step settlement directly.

### `dwell.started`

Required whenever a non-zero effective authored dwell interval begins after a stable commit during continuous playback.

Required fields:

```text
step_id
details.dwell_ms
```

### `dwell.completed`

Required whenever a non-zero dwell interval expires normally.

On a non-final step it precedes the following transition start. On the final step it precedes `playback.stopped` with reason `at_end`.

### `dwell.cancelled`

Required whenever an active or pause-preserved non-zero dwell is cancelled by navigation, restart, fault, or disposal.

Include the cancellation reason and remaining dwell when available in structured details.

Dwell events are Runtime-owned. A v1 implementation with non-zero authored dwell cannot omit the applicable dwell events.

## 8. Transition and Initialization Events

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

### `initialization.cancelled`

Reports that instance initialization was intentionally abandoned by terminal disposal before initialization completed.

When an entry renderer transition exists, include:

```text
transition_id
step_id = requested entry boundary
result = cancelled
details.reason = dispose
```

If disposal arrives after renderer mount but before the entry render transition exists, `transition_id` may be omitted. `step_id` still identifies the requested entry boundary. `initialization.cancelled` closes the opened initialization lifecycle for replay and diagnostic reconstruction.

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

Required exactly once after successful instance initialization. `step.initial` identifies the session entry boundary; the v1 event name is retained even when the entry boundary is an authored step rather than the literal `initial` boundary.

Required fields:

```text
step_id = resolved entry boundary
component = core
details.source = host | deep_link | replay
```

Initialization is a lifecycle operation rather than a learner command, so `step.initial` carries no `command_id`. Direct entry at an authored boundary does not emit `step.changed` and does not imply a predecessor semantic boundary.

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

Required whenever an in-flight render honors an expected abort/cancellation request.

The event must carry the applicable `transition_id` and `result: "cancelled"`. Expected abort is not `renderer.error` and does not trigger fault recovery by itself.

An honored abort is recognized only through the renderer cancellation contract. The renderer rejects with `RendererCancelledError` carrying the same reason exposed by the aborted renderer signal. A plain renderer exception after an abort request remains `renderer.error`.

If cancellation is requested but the renderer has no in-flight work to abort, no `renderer.cancelled` event is required.

If a renderer does not acknowledge a disposal-time abort within 1000 ms of injected CiM time, Runtime emits `renderer.error` with:

```text
error_code = CIM-RND-002
details.operation = abort_acknowledgement
details.reason = dispose
details.timeout_ms = 1000
```

Runtime then completes disposal without waiting for later renderer cooperation. A late completion is silent.

### `renderer.error`

Reports a renderer-owned failure.

A failure from terminal renderer teardown includes `details.operation: "dispose"`. Runtime still stores canonical `disposed` status and closes the semantic event stream after publishing the teardown error.

A renderer-dispose acknowledgement timeout emits `renderer.error` with:

```text
error_code = CIM-RND-003
details.operation = dispose_acknowledgement
details.timeout_ms = 1000
```

The timeout is measured by injected CiM time. Runtime then closes the event stream and ignores any late teardown completion.

### `renderer.disposed`

Reports completed renderer disposal.

On successful terminal disposal acknowledged within the bounded teardown window, this is the final semantic event for the instance. Core is already in canonical `disposed` status when this event is published, so reentrant command attempts cannot create new semantic work after renderer teardown evidence.

A renderer-dispose acknowledgement timeout does not emit `renderer.disposed`.

## 12. Recovery and Fault Events

### `recovery.started`

Runtime began restoration to a known committed stable boundary.

### `recovery.succeeded`

Restoration succeeded. Result is `recovered`.

### `recovery.cancelled`

Terminal disposal intentionally interrupted active recovery. Result is `cancelled`, `details.reason` is `dispose`, and the event uses the recovery transition identity and committed recovery anchor.

`recovery.cancelled` closes an opened `recovery.started` lifecycle without misclassifying disposal as restoration failure. It does not create `CIM-RND-006` and does not imply `instance.faulted`.

### `recovery.failed`

Restoration failed and normal playback cannot continue.

Disposal that cancels an active recovery render does not emit `recovery.failed`; disposal cancellation is terminal lifecycle control rather than failed restoration.

### `instance.faulted`

Reports that Core has stored canonical `faulted` status after Runtime cleared active playback/transition/dwell operational state.

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

### `host.deeplink.invalid`

Reports an unresolvable CiM deep-link target. The resolver falls back to the applicable experience's `initial` boundary when an experience can be initialized, according to `FAULTS.md`.

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

Animation-frame events, per-frame transforms, high-frequency renderer ticks, fractional renderer progress, and pointer-level scrub-preview changes are outside the semantic event stream.

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
initialization boundary and source
effective runtime configuration
command sequence
command source where semantically relevant
command timing on the virtual clock
```

Replay reissues commands through normal runtime interfaces.

The resulting semantic event stream and evidence are compared with expected or recorded results.

Replay does not drive Runtime by feeding prior semantic events back into the engine.

A replay stream cannot leave initialization or recovery logically open at disposal. `initialization.cancelled` and `recovery.cancelled` provide the terminal lifecycle evidence needed to close those sequences.

## 18. Initial Event Catalog

```text
command.received                optional
command.accepted
command.rejected
playback.started
playback.paused
playback.resumed
playback.stopped
dwell.started                   required when non-zero dwell begins
dwell.completed                 required when non-zero dwell completes
dwell.cancelled                 required when active non-zero dwell is cancelled
transition.started
transition.cancelled
transition.settled
transition.failed
initialization.cancelled        required when disposal interrupts initialization
step.changed
step.initial                    required exactly once after successful initialization
commentary.active.changed
commentary.frontier.changed
commentary.autofollow.changed   optional
renderer.mounted
renderer.settled                optional
renderer.cancelled              required when renderer honors an in-flight abort
renderer.error
renderer.disposed
recovery.started
recovery.succeeded
recovery.cancelled              required when disposal interrupts active recovery
recovery.failed
instance.faulted
host.fallback.shown
experience.validation.succeeded optional
experience.validation.failed
renderer.resolve.failed
experience.load.failed
host.deeplink.invalid
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
- honored renderer aborts produce required `renderer.cancelled` evidence and stale cancelled transitions cannot settle successfully;
- semantic commit occurs only after stable settlement and is Core-owned;
- observation steps advance semantic position even when digests remain equal;
- valid start/end boundary commands are accepted `no_change` results rather than rejections;
- navigation clears continuous playback intent;
- non-zero dwell produces required start/completion/cancellation evidence as applicable;
- pause freezes renderer delayed/frame work while preserving transition identity and Core pending target, and no `step.changed` occurs while paused;
- paused dwell preserves exact `dwell_remaining_ms`, and resume consumes only that remainder;
- final-step dwell completes before `playback.stopped` with reason `at_end`;
- scrub commit emits one seek and drag preview emits no semantic seek;
- invalid deep links produce diagnostic evidence and deterministic fallback to `initial` when an experience is available;
- faults precede recovery attempts;
- recovery outcome is explicit;
- unrecoverable failures lead to ordered instance fault/fallback evidence;
- disposal cancels transition, dwell, initialization, and recovery work before terminal stream closure;
- disposal closes interrupted initialization and recovery with explicit `initialization.cancelled` and `recovery.cancelled` evidence;
- successful disposal acknowledged inside the teardown window ends with `renderer.disposed`, while renderer teardown rejection ends with `renderer.error` carrying `details.operation: "dispose"`;
- a disposal-time render that does not acknowledge abort within the bounded window produces `CIM-RND-002` and cannot hold Core out of terminal `disposed`;
- `renderer.dispose()` cannot hold terminal disposal open beyond its bounded acknowledgement window and timeout produces `CIM-RND-003`;
- no stale semantic event can publish after disposal closes the stream, including late render and late renderer-dispose completions;
- fallback fault evidence survives the canonical `faulted` to `disposed` lifecycle transition;
- multiple instance streams remain independently ordered.
