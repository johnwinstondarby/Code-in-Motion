# Code in Motion (CiM) Architecture

Status: Normative architecture for v1 development

## 1. Purpose

Code in Motion (CiM) is a reusable Localis teaching platform for demonstrating technical processes under learner-controlled time. A CiM experience combines a subject-specific visual representation with semantic transport, persistent running commentary, linked reference material, accessibility behavior, and deterministic runtime evidence.

Git in Motion is the first real experience and reference implementation. Shared platform architecture remains independent of Git.

This document defines component ownership, dependency direction, composition rules, runtime authority, ingestion boundaries, timing ownership, and harness separation. Detailed runtime semantics belong in `CIM-SPEC.md`. Experience shape belongs in `EXPERIENCE-SCHEMA.md`. Observable event records belong in `EVENTS.md`.

## 2. Architectural Principles

1. `CiMInstance` owns runtime composition and orchestration for one mounted experience.
2. **Core owns and mutates canonical semantic session state. Runtime sequences and asks Core to commit only after stable renderer settlement.**
3. The reserved semantic boundary ID `initial` identifies the stable boundary before the first authored step.
4. Core does not inspect subject-specific state or renderer configuration.
5. Renderers produce stable semantic boundaries from absolute state rather than accumulated deltas.
6. Semantic position and subject-state identity are independent.
7. Commands use direct interfaces. Events are observational.
8. Cross-component orchestration occurs through `CiMInstance`; peer modules do not control one another laterally.
9. Semantic timing uses an injected CiM clock and scheduler.
10. Renderers own transition duration. Runtime owns authored dwell scheduling during continuous playback.
11. Pause preserves in-flight transition or dwell. Discrete navigation clears playback intent and resolves deterministically to a stable semantic boundary.
12. V1 scrub is a transport-local preview followed by one semantic seek on commit.
13. All generated and hand-authored experience inputs converge on validated `localis.cim/v1` before runtime initialization.
14. Experience-authored content is untrusted data and cannot inject executable page content.
15. The synthetic harness may observe production behavior and inject documented dependencies, but production code never imports harness code.
16. Telemetry is observational. Replay reissues recorded inputs and compares resulting evidence.
17. Previously revealed commentary remains revealed while navigating backward within a session.
18. Stable semantic boundaries, including `initial`, are deep-linkable.
19. Multiple CiM instances on the same page remain isolated.

## 3. Composition Model

The runtime composition root is `CiMInstance`.

```text
Host / WordPress adapter
          |
          v
   Runtime / CiMInstance
     |      |       |
     |      |       +--> Renderer implementation
     |      +----------> Commentary
     +-----------------> Transport / shell
          |
          v
        Core
         |
         +--> semantic timeline and canonical commit
         +--> validated experience structure

Runtime --> clock / scheduler interface
Runtime --> event / diagnostics interfaces
Renderer --> clock / scheduler interface

Harness -> injected dependencies + observation only
Telemetry -> observation only
```

`CiMInstance` wires concrete modules together, sequences commands, owns operational transition mechanics and playback intent, coordinates stable-state settlement, and scopes runtime behavior to one mounted experience.

Core owns canonical semantic authority. Runtime does not replace that authority merely because it orchestrates the surrounding work.

## 4. Component Ownership

### 4.1 Runtime / CiMInstance

Runtime owns composition and orchestration for one CiM instance.

Runtime may:

- accept commands from transport, deep links, commentary navigation, scrub commit, replay, or host initialization;
- determine when operational preconditions permit command execution;
- sequence Core validation, renderer settlement, commentary projection, and telemetry;
- own continuous playback intent;
- own transition identity, normalized transition progress, cancellation, abort coordination, and dwell scheduling;
- create command and correlation identifiers;
- scope faults, events, and cleanup to one instance;
- ask Core to commit a semantic destination only after stable renderer settlement.

Runtime does not own canonical semantic commit authority, subject-specific state interpretation, visual representation, commentary content, transport presentation, or host-page business logic.

### 4.2 Core

Core owns and mutates canonical semantic session state and semantic timeline rules.

Core owns at least:

- canonical current semantic boundary;
- pending semantic target;
- canonical session status;
- reveal frontier;
- canonical semantic fault state;
- semantic validation against the loaded experience;
- commit of semantic position after Runtime reports successful stable settlement.

The normative session model and Runtime/Core state split are defined once in `CIM-SPEC.md` §3. This document does not maintain a duplicate field list.

Core must not inspect the internal structure of experience `state` or `renderer_config` values.

### 4.3 Transport

Transport owns learner-facing progress and playback controls, semantic markers, keyboard interaction assigned to transport, and transport-local scrub preview.

Transport sends commands to `CiMInstance`. It does not call renderers, commentary, telemetry, or subject implementations directly.

V1 scrub drag does not change canonical position or renderer state. Scrub commit submits one `seek(stepId)`.

### 4.4 Commentary

Commentary owns persistent event-history presentation, active commentary presentation, auto-follow behavior, newer-step indication, and commentary link presentation.

Commentary receives canonical position and reveal information through runtime-controlled interfaces. It does not infer canonical position from its DOM or independently advance the session.

At `initial`, no authored commentary entry or semantic marker is active in v1.

### 4.5 Accessibility

Accessibility is a cross-cutting contract. Shared helpers may live under `src/accessibility/`, but each component that emits interactive or visual output owns the accessibility of that output.

Accessibility helpers do not gain control authority over runtime state.

### 4.6 Renderer Interface

A renderer receives complete absolute state for a semantic boundary. Arrival at the same boundary through sequential playback, direct seek, restoration, reverse navigation, reduced motion, or replay settles to equivalent canonical output.

Renderers own transition duration and may use prior state as animation context, but prior rendered history cannot be required to construct the destination.

Renderers use the injected CiM clock/scheduler for semantically significant animation timing.

Renderers do not own playback policy, semantic navigation, commentary progression, dwell scheduling, URL history, or canonical semantic position.

### 4.7 Subject-Specific Renderers

Subject renderers implement visual representation for a domain such as Git. They depend on the public renderer contract and subject data passed through the experience definition.

Subject renderers must not introduce direct dependencies on transport, commentary, host adapters, harness code, or another subject renderer.

### 4.8 Experience Data and Schema

Experience definitions describe instructional data rather than engine control logic.

The shared schema owns version metadata, renderer identity, semantic steps, required commentary structure, links, opaque state, opaque renderer configuration, and optional `dwell_ms`.

`initial` is reserved by the shared schema and cannot be used as an authored step ID.

Experience definitions contain no executable JavaScript, raw HTML, or engine-control callbacks.

### 4.9 Host / WordPress Adapter

The host adapter resolves an experience ID, loads production assets, mounts CiM instances, and preserves a usable surrounding page if CiM initialization fails.

The WordPress implementation should be a plugin that enqueues external assets. Publication pages invoke an experience through stable markup or shortcode rather than embedded runtime code.

### 4.10 Runtime Fault Management

Fault taxonomy and common diagnostic shape are shared, but recovery authority remains with the component that owns the failed operation.

Runtime coordinates cross-component settlement after a failure. Core retains the last committed semantic boundary as the canonical recovery anchor.

Recoverable faults return the instance to a documented usable state. Unrecoverable faults stop playback and expose the standard static fallback while leaving the surrounding page usable.

The normative fault ownership matrix is `FAULTS.md`.

### 4.11 Telemetry, Evidence, Replay, and Analysis

Runtime telemetry records ordered semantic behavior and faults without participating in control.

All semantic event timestamps come from the injected CiM clock. Replay reissues recorded commands against the same versioned inputs and effective runtime configuration, then compares resulting evidence.

Frame-level animation and pointer-level scrub-preview activity do not belong in the semantic event stream.

### 4.12 Synthetic Operations Harness

The harness proves platform behavior without Git, WordPress, or another subject implementation.

The harness may provide:

- a virtual clock and scheduler;
- synthetic experiences;
- synthetic and faulting renderers;
- deterministic command scenarios;
- injected runtime failures through documented seams;
- telemetry sinks;
- harness-owned render canonicalization;
- expected-state and expected-event assertions;
- replay and evidence comparison.

The harness is never imported by production runtime code.

## 5. Dependency Direction

```text
host -> runtime -> core
                -> transport integration
                -> commentary
                -> renderer interface -> subject renderer
                -> telemetry interface

experience adapter -> schema validation -> validated experience -> runtime/core

harness -> public production interfaces
production -X-> harness
```

Peer presentation modules do not control one another:

- transport does not call renderers;
- transport does not advance commentary;
- commentary does not move transport;
- renderers do not command runtime navigation;
- telemetry does not command runtime behavior;
- subject renderers do not inspect another module's DOM or private state.

## 6. Canonical Runtime Authority

**Core is the sole owner of canonical semantic position and the semantic commit operation.**

`CiMInstance` is the sole production orchestration root for one mounted experience.

The distinction is deliberate:

```text
Runtime decides when settlement work occurs.
Renderer proves stable destination output.
Core decides and records canonical semantic commit.
```

`currentStepId` identifies the last committed stable semantic boundary and is always either `initial` or an authored step ID. A subject-state digest or render digest never substitutes for that identity.

Operational transition identity, progress, abort state, dwell scheduling, and continuous playback intent belong to Runtime and do not independently redefine canonical semantic position.

The authoritative session-model field list is `CIM-SPEC.md` §3.

## 7. Absolute-State Rendering

For every semantic boundary, the experience supplies enough state for the selected renderer to reproduce that boundary independently of navigation history.

The following paths to the same step settle to equivalent canonical output:

```text
sequential playback
seek(step)
restart -> seek(step)
reverse navigation
recovery restoration
reduced-motion navigation
replay
```

The conformance harness owns render canonicalization. Renderer implementations cannot provide or alter their own conformance digest rules.

For v1, conforming renderers expose inspectable DOM or SVG under their assigned renderer root. Renderer technologies requiring a different observable conformance surface require a later contract extension.

## 8. Semantic Position Versus Subject State

A semantic operation can advance the instructional timeline without changing subject state.

The neutral synthetic fixture includes:

```text
initial -> A
step-01 -> B
step-02 -> B   observation
step-03 -> C
step-04 -> D
```

After moving from `step-01` to `step-02`, state and render digests may remain equal while canonical position, active commentary, marker state, and event sequence advance.

No optimization may skip semantic settlement solely because a state or render digest is unchanged.

## 9. Time, Transition, and Dwell Ownership

CiM controls semantic time through an injected clock and scheduler.

Renderer owns transition duration. Runtime owns optional authored dwell scheduling through `steps[].dwell_ms` during continuous playback.

Pause freezes active transition or dwell without committing a new destination.

Discrete navigation clears continuous playback intent. Navigation received during transition cancels animation and resolves to the requested absolute destination. Navigation during dwell cancels remaining dwell.

Reduced motion may suppress renderer animation but preserves authored dwell.

See ADR 0006.

## 10. Commentary Reveal Model

The active commentary entry follows canonical authored semantic position.

`revealFrontier` is a monotonic high-water mark during a session. Seeking backward changes the active entry but does not re-hide commentary already revealed.

A deep-link entry initializes the frontier to the requested target. `restart()` resets it to `initial`.

At `initial`, no authored commentary entry is active.

## 11. Semantic Scrub

V1 scrub is transport-local until commit.

Pointer/touch drag may update only transport preview state. It does not issue semantic commands, change commentary, move the reveal frontier, or alter renderer output.

Release or equivalent commit resolves the nearest valid semantic boundary and submits exactly one `seek(stepId)` with observational command source `scrub`.

Continuous arbitrary-time renderer scrubbing is outside v1. See ADR 0007.

## 12. Deep Linking and Instance Isolation

Stable semantic boundaries use:

```text
#cim/{experience-id}/{step-id}
```

The initial boundary is:

```text
#cim/{experience-id}/initial
```

Only a mounted instance whose experience ID matches the fragment responds. Other instances ignore it.

Learner-driven stepping should replace the current semantic URL rather than create a browser-history entry for every step.

Every mount receives a unique `instanceId`. Mutable runtime state, event sequencing, listeners, timers, faults, and cleanup remain instance-scoped.

## 13. Experience Ingestion

CiM has one runtime experience contract: `localis.cim/v1`.

```text
Human-authored .cim -> parser -----+
                                   |
Localis subject source -> generator+--> localis.cim/v1 validation -> runtime
```

The engine never receives an unvalidated alternate authoring representation.

Site-level plugin configuration and per-experience instructional content are separate concerns.

The exact `.cim` authoring grammar is deferred to a dedicated specification or ADR and must preserve source locations for actionable diagnostics.

## 14. Content Safety Boundary

Experience-authored content is untrusted input regardless of provenance.

The platform requires:

- authored terminal and code content rendered as text nodes;
- no raw HTML in experience content;
- no experience-supplied JavaScript;
- no `innerHTML` path for authored content;
- structured commentary links rather than arbitrary markup;
- URL scheme validation;
- renderer configuration interpreted as data rather than executable instructions.

## 15. WordPress Boundary

WordPress integration is a host adapter around the canonical engine.

Expected invocation is storage-independent, for example:

```html
<div class="cim" data-cim-experience="git-basic-cycle"></div>
```

or:

```text
[cim id="git-basic-cycle"]
```

The plugin owns asset enqueue, experience resolution, initialization, cache/version handling, authoring validation surfaces, and fallback markup. Runtime JavaScript remains in enqueued external assets rather than page-authored inline scripts.

## 16. Fault Isolation

A failure in one CiM instance must not destabilize another CiM instance or the surrounding Localis page.

Fault records identify owning component, operation, semantic boundary or transition when applicable, stable error code, and recovery outcome.

The harness may inject faults. Fault-handling logic belongs to production components.

## 17. Branch and Merge Boundary

Feature branches preserve the ownership rules in this document and the README in their target component directory.

A branch changing a public interface updates the corresponding normative document and tests in the same review set or prerequisite architecture branch.

`main` remains releasable. Subject-specific implementation work cannot redefine a shared platform contract implicitly.

## 18. Architecture-v1 Acceptance Gate

Before `docs/architecture-v1` merges:

- Core ownership of canonical semantic state is explicit and consistent;
- `initial` is reserved and represented consistently across schema, runtime, deep links, and events;
- start/end boundary commands use accepted `no_change` semantics;
- navigation clears continuous playback intent;
- transition duration and authored dwell have explicit owners;
- semantic scrub has an explicit low-volume contract;
- absolute-state rendering is normative;
- semantic position is independent from state digest;
- renderer lifecycle responsibilities are documented;
- commentary reveal behavior is documented;
- experience ingestion converges on one validated schema;
- deep-link and multi-instance behavior are documented;
- fault ownership and fallback boundaries are documented;
- telemetry and replay remain observational;
- harness dependencies cannot leak into production;
- no unresolved public-interface decision blocks independent component implementation.
