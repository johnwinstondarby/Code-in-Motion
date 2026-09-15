# Runtime / CiMInstance

## Purpose

Runtime creates one isolated CiM instance and coordinates commands across production components.

## Owns

- `CiMInstance` lifecycle
- Instance identity and composition
- Command sequencing
- Cross-component orchestration
- Continuous playback intent
- Transition correlation, phase, cancellation, and abort coordination
- Dwell scheduling
- Multi-instance isolation
- Initial deep-link dispatch
- Renderer settlement sequencing
- Requesting canonical semantic commit from Core after stable settlement
- Retaining privileged Core mutation capability inside the Runtime composition root

The normative Core/Runtime state split is `docs/CIM-SPEC.md` §3.

## Core composition seam

`src/runtime/core-session.mjs` is private Runtime infrastructure.

`createRuntimeCoreSession(options)` constructs Core and returns one frozen composition object:

```text
session
  read
  navigation

controls
  semanticControl
  faultControl
  statusControl
```

`session` is the shareable projection. `controls` belongs only to the Runtime composition root and is never placed on a public Runtime or CiMInstance projection.

The composition root must retain the controls directly. Runtime modules must not re-export them, return them from helper APIs, pass them to peer components, or wrap their methods in callbacks or helper functions that are then handed to Transport, Commentary, Renderers, Host, Telemetry, Accessibility, or Experience code. Delegation carries the same mutation authority even when the privileged property names disappear at the eventual call site.

Non-Runtime production code is prohibited from importing `src/runtime/core-session.mjs`. `tools/check-core-authority.mjs` enforces this rule and also prohibits direct non-Runtime imports of `src/core/`.

The static authority gates verify import and identifier boundaries. They cannot prove semantic non-delegation through a renamed Runtime wrapper. `tests/core-authority.test.mjs` contains an explicit near-miss documenting that edge. The structural guarantee therefore rests on composition-root retention of `controls`; the scanners remain defense in depth.

Runtime determines activity-status changes from Runtime-owned operational facts and requests canonical changes through the retained Core controls. Shared vocabulary from `src/contracts/` grants no mutation authority.

## Runtime checkpoint 1: composition and evidence foundation

`src/runtime/cim-instance.mjs` establishes the public composition shell before navigation settlement is wired.

`createCiMInstance()` accepts an instance ID, frozen validated `localis.cim/v1` experience data, and an injected clock. The instance retains the validated experience and all privileged Core controls privately. Its public data surface exposes:

```text
identity
read
  snapshot()
  boundaryIds()
events
  subscribe(listener)
```

Runtime-owned operational state is represented separately from Core canonical state:

```text
playbackIntent = false
transitionId = null
transitionPhase = idle
dwellRemainingMs = 0
activeAbortState = null
```

`read.snapshot()` returns frozen `canonical` and `operational` projections. It carries no mutation authority.

`src/runtime/correlation.mjs` provides deterministic per-instance command and transition identities. Command IDs use `cmd-N`; transition IDs use `txn-N`. Counters are instance-local and never use randomness or wall-clock data.

`src/runtime/event-stream.mjs` implements the ordered observational stream defined by `docs/EVENTS.md`. Sequence is positive and monotonic per instance, semantic timestamps come only from the injected clock, event records and structured details are frozen copies, and observer failures are isolated from production control flow.

## Runtime checkpoint 2: initial settlement and discrete navigation

Checkpoint 2 adds the first complete command execution path.

`initialize()` mounts the injected renderer and absolute-renders the reserved `initial` boundary before semantic navigation is accepted. The initial arrival uses `animate:false`, null predecessor fields, the validated experience-level renderer configuration, and a transition-scoped abort and clock facade. Initial settlement emits renderer evidence and optional `step.initial` evidence without claiming a semantic movement.

The discrete command surface is:

```text
next(source)
previous(source)
seek(stepId, source)
home(source)
end(source)
restart(source)
```

The default source is `host`; Transport, Commentary, marker selection, scrub commit, deep-link initialization, and replay can supply their documented source value when routed through this surface.

For a successful discrete movement Runtime performs this order:

```text
resolve through Core
emit command.accepted
clear playback intent and dwell state
cancel and settle any superseded transition
Core.beginTarget(destination)
create transition identity
set canonical status to transitioning
emit transition.started
absolute-render destination
emit renderer.settled
emit transition.settled
Core.commitTarget(destination) or Core.commitRestart()
set canonical status to idle
emit step.changed only when the committed boundary changed
```

Absolute navigation always uses `animate:false`, `fromState:null`, and `fromStepId:null`. Runtime selects the complete validated state for the requested boundary but does not inspect its subject contents.

A valid stable-boundary limit remains `command.accepted` with `result:no_change` and does not render. An unknown seek is `command.rejected` and does not cancel active work or mutate canonical state. Commands submitted before initial settlement are rejected with `invalid_state`.

A newly accepted navigation command supersedes active renderer work rather than joining a queue. Runtime resolves while Core still exposes the pending target, requests renderer abort, abandons the superseded Core target, waits for renderer cancellation settlement, and then absolute-renders the newest accepted destination. A superseded transition cannot commit even if stale renderer work later completes.

The mid-transition `previous()` rule therefore holds: while committed B is moving toward C, `previous()` cancels C, absolute-renders B, and returns accepted `no_change` without emitting `step.changed`.

Renderer failure during this checkpoint clears the pending Core target and preserves the last committed boundary. Full recovery restoration and canonical recover/fallback fault handling remain a later Runtime checkpoint.

## Runtime checkpoint 3: continuous playback and animated continuity

Checkpoint 3 adds the first continuous-playback path through `play(source)`.

At a stable non-final boundary, `play()` allocates one command ID, sets `playbackIntent`, requests canonical `playing`, emits `playback.started`, and begins the immediately following semantic transition. The renderer receives `animate:true` with complete `fromState` and `fromStepId` continuity context. Each semantic destination receives a new transition ID while all automatic transitions caused by the same play command retain the original command ID.

A successful playback transition preserves transactional settlement ordering:

```text
Core.beginTarget(destination)
create transition identity
set canonical status to transitioning
emit transition.started
animated renderer settlement
emit renderer.settled
emit transition.settled
Core.commitTarget(destination)
set canonical status to playing
emit step.changed
consume authored dwell when present
continue to the following boundary or stop at end
```

Semantic movement remains independent from subject-state identity, so observation steps still commit and emit `step.changed` when adjacent states are equivalent.

Continuous playback honors `steps[].dwell_ms` as required by ADR 0006. Runtime records the authored dwell on the boundary model, emits `dwell.started`, waits on the injected scheduler, emits `dwell.completed`, then begins the next transition. `read.snapshot()` reports remaining dwell from virtual time. Discrete navigation during dwell cancels the scheduled work, emits `dwell.cancelled`, clears playback intent, and proceeds through the existing absolute-navigation path.

At the final boundary, `play()` is accepted with `no_change` and reason `at_end`. When continuous playback reaches the final step, playback stops with reason `at_end` after any required final dwell. Repeated `play()` while playback is already active is rejected with `invalid_state`.

Renderer failure during continuous playback abandons the pending Core target, preserves the last committed semantic boundary, and stops playback with fault evidence. Restoration and canonical recover/fallback fault handling remain a later Runtime checkpoint.

## Runtime checkpoint 4: pause/resume and provable time freeze

Checkpoint 4 deliberately corrects the Runtime operational contract. `transitionProgress` is removed and replaced by `transitionPhase` with the values `idle`, `in_flight`, and `settled`. Runtime can prove transition lifecycle phase and transition identity, but the renderer contract supplies no authoritative fractional progress value. Runtime therefore does not infer fractional transition progress from elapsed time or renderer internals. ADR 0010 records this correction and supersedes the prior fractional-progress wording in the v1 specification, event contract, and ADR 0005.

This contract change intentionally touches the operational key list in `runtime-data.mjs`, the snapshot key-set assertion, and this README. Those changes are one coordinated correction rather than incidental churn.

`pause(source)` is a continuity command. During an in-flight transition Runtime pauses the transition-scoped renderer clock, preserves the same `transitionId` and Core `targetStepId`, requests canonical `paused`, and emits `playback.paused` with `details.transition_phase: "in_flight"`. While paused, renderer `schedule` and `onFrame` callbacks remain dormant even if the underlying scheduler advances. No semantic commit occurs.

`play(source)` resumes a paused transition through the same renderer task and the same semantic transition identity. Runtime resumes the private clock controller, requests canonical `transitioning`, and emits `playback.resumed`. A renderer completion that arrives while paused cannot commit until the resume gate opens.

During authored dwell, `pause()` computes and preserves exact `dwellRemainingMs`, cancels the active source timer, and requests canonical `paused`. Advancing source time while paused does not consume the remainder. `play()` resumes the preserved dwell and schedules only the remaining interval. Dwell completion therefore occurs after the exact remainder rather than restarting the authored duration.

The renderer-facing clock facade remains exactly `now`, `schedule`, `cancel`, and `onFrame`. Pause and resume are Runtime-only controller operations and are not exposed to renderer code.

## Runtime checkpoint 5: renderer recovery and canonical fault settlement

Checkpoint 5 connects destination-renderer failure handling to Core's canonical fault lifecycle and the recovery evidence defined by `FAULTS.md` and `EVENTS.md`.

When destination rendering fails, Runtime emits renderer and transition failure evidence with `CIM-RND-004`, abandons the pending Core target, clears playback and dwell activity, records the recoverable renderer fault in Core, and begins one absolute non-animated restoration render of the last committed semantic boundary. The restoration render receives a new transition correlation identity but does not create a semantic target or emit `step.changed`.

While restoration is active, `pause()`, `play()`, and discrete navigation reject with `invalid_state`. Recovery therefore remains a single deterministic settlement path rather than another supersedable learner transition.

If restoration succeeds, Runtime clears the matching recoverable Core fault, returns canonical status to `idle`, emits `recovery.succeeded`, and leaves the instance usable at the unchanged committed boundary. A discrete command whose destination render failed still rejects with the original renderer error after recovery completes; continuous playback stops with reason `fault` and remains stopped.

If restoration fails, Runtime emits renderer and `recovery.failed` evidence with `CIM-RND-006`, clears operational transition state, escalates the Core fault from `recover` to `fallback`, and only then emits `instance.faulted`. Core atomically stores the fallback record and canonical `faulted` status. The host owns subsequent static-fallback presentation.

The checkpoint deliberately uses Core's `faultControl.recordFault()` path rather than direct status mutation. Canonical `faulted` status cannot exist without the corresponding fallback fault record.

## Runtime checkpoint 6: terminal disposal and stale-work prevention

Checkpoint 6 implements `dispose()` as the terminal Runtime lifecycle operation.

Disposal cancels active lifecycle rendering, playback transitions, and dwell work; releases pause gates; revokes transition-scoped renderer clock and abort capabilities; abandons any pending semantic target; clears transient recoverable fault context; and clears Runtime operational state. A fallback fault record remains preserved when a faulted instance advances to canonical `disposed`.

Initialization and renderer-recovery work are tracked as lifecycle renders so disposal can abort them and wait for their settlement before final teardown. Disposal during active recovery does not convert cancellation into `recovery.failed` or fallback fault evidence.

Runtime stores canonical `disposed` status and marks the instance terminal before awaiting `renderer.dispose()`. This ordering prevents event subscribers or reentrant command calls from creating new semantic work during renderer teardown. Commands submitted after terminalization return the stable `disposed` rejection without publishing to the closing event stream.

Successful renderer teardown emits `renderer.disposed` as the final semantic event and then closes the event stream. If `renderer.dispose()` fails, Runtime emits `renderer.error` with `details.operation: "dispose"`, closes the event stream, rejects the disposal promise, and leaves Core in terminal `disposed` status. Repeated successful disposal is idempotent and does not call the renderer again.

## Does not own

- Canonical semantic commit authority
- Canonical session-state storage
- Subject-state interpretation
- Renderer internals
- Commentary DOM internals
- Harness behavior

## Allowed dependencies

Runtime may call documented Core interfaces, import `src/contracts/`, and use transport integration points, commentary, renderer interfaces, accessibility helpers, experience loading, telemetry, and fault services.

## Prohibited dependencies

Runtime does not import harness code or expose, delegate, re-export, wrap, or otherwise distribute privileged Core mutation controls beyond the Runtime composition root.

## Verification

Integration tests must prove command ordering, instance isolation, navigation cancellation, playback-intent clearing, pause/resume continuity, ordered status writes, deep-link dispatch, scrub-originated single-seek flow, clean disposal, Runtime-only Core-control retention, lifecycle command rejection, and the documented boundary of static authority analysis.

Checkpoint 1 verification proves frozen public projections, initial separation of canonical and operational state, inert validated-experience ingestion, deterministic correlation identities, virtual-clock event timestamps, monotonic per-instance event sequence, immutable event publication, descriptor-safe event input, and observer-failure isolation.

Checkpoint 2 verification proves initial absolute settlement, reject-before-initialize behavior, absolute discrete navigation, command/transition/step event ordering, semantic movement across equal subject state, boundary `no_change`, unknown-seek rejection, Home versus Restart reveal policy, superseding cancellation without a navigation queue, and preservation of the last committed Core boundary when destination rendering fails.

Checkpoint 3 verification proves animated forward continuity, one command ID across automatic transition IDs, semantic advancement across equal subject state, continuous-playback stop at end, stable-boundary `play()` no-change behavior, repeated-play rejection while active, authored dwell scheduling and virtual-time remaining-dwell reporting, navigation cancellation during dwell or animation, stale-transition commit prevention, and recovery-anchor preservation when playback rendering fails.

Checkpoint 4 verification proves transition-clock freeze while source time advances, dormant renderer frame and delay callbacks while paused, stable transition identity and Core pending target, absence of semantic commit while paused, exact dwell-remainder preservation, same-transition resume, and completion after only the preserved dwell remainder.

Checkpoint 5 verification proves target abandonment before recoverable fault storage, absolute restoration to the last committed anchor, command rejection during active recovery, recoverable fault clearing after successful restoration, recover-to-fallback escalation when restoration fails, complete operational-state clearing before canonical fallback settlement, ordered `recovery.failed` then `instance.faulted` evidence, and continued command usability after successful recovery.

Checkpoint 6 verification proves terminal disposal from idle, paused transition, active dwell, initialization, active recovery, and canonical faulted states; exact transition and dwell cancellation; pending-target abandonment; recoverable-fault cleanup with fallback-fault preservation; renderer teardown ordering; closed-stream stale-work suppression; idempotent successful disposal; and terminal Core settlement even when renderer disposal fails.
