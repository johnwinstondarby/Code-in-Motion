# Code in Motion (CiM) Architecture

Status: Normative architecture for v1 development

## 1. Purpose

Code in Motion (CiM) is a reusable Localis teaching platform for demonstrating technical processes under learner-controlled time. A CiM experience combines a subject-specific visual representation with semantic transport, persistent running commentary, linked reference material, accessibility behavior, and deterministic runtime evidence.

Git in Motion is the first real experience and reference implementation. Shared platform architecture must remain independent of Git.

This document defines component ownership, dependency direction, composition rules, runtime authority, ingestion boundaries, and harness separation. Detailed runtime semantics belong in `CIM-SPEC.md`. Experience shape belongs in `EXPERIENCE-SCHEMA.md`. Observable event records belong in `EVENTS.md`.

## 2. Architectural Principles

The v1 platform follows these rules.

1. `CiMInstance` owns runtime orchestration for one mounted experience.
2. Core owns canonical semantic session state.
3. Core does not inspect subject-specific state or renderer configuration.
4. Renderers produce stable semantic boundaries from absolute state rather than accumulated deltas.
5. Semantic position and subject-state identity are independent.
6. Commands use direct interfaces. Events are observational.
7. Cross-component orchestration occurs through `CiMInstance`; peer modules do not control one another laterally.
8. Semantic timing uses an injected CiM clock and scheduler.
9. Pause preserves an in-flight transition. Navigation commands cancel the transition and resolve deterministically to a stable semantic boundary.
10. All generated and hand-authored experience inputs converge on validated `localis.cim/v1` before engine initialization.
11. Experience-authored content is untrusted data and cannot inject executable page content.
12. The synthetic harness may observe production behavior and inject documented dependencies, but production code never imports harness code.
13. Telemetry is observational. Replay reissues recorded inputs and compares resulting evidence.
14. Previously revealed commentary remains revealed while navigating backward within a session.
15. Stable semantic boundaries are deep-linkable.
16. Multiple CiM instances on the same page remain isolated.

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
         +--> semantic timeline
         +--> clock / scheduler interface
         +--> renderer contract
         +--> event / diagnostics interfaces

Harness -> injected dependencies + observation only
Telemetry -> observation only
```

`CiMInstance` wires concrete modules together, sequences commands, coordinates stable-state settlement, and scopes runtime behavior to one mounted experience. Core remains a semantic state component rather than an application container.

## 4. Component Ownership

### 4.1 Runtime / CiMInstance

Runtime owns composition and orchestration for one CiM instance.

Runtime may:

- accept commands from transport, deep links, commentary navigation, or host initialization;
- validate whether a command can execute in the current session status;
- sequence core state changes and renderer settlement;
- coordinate commentary projection for the committed semantic position;
- create transition and correlation identifiers;
- scope faults, events, and cleanup to one instance.

Runtime does not own subject-specific state interpretation, visual representation, commentary content, transport presentation, or host-page business logic.

### 4.2 Core

Core owns canonical semantic session state and semantic timeline rules.

Core may know:

- experience identity and version metadata;
- semantic step IDs and ordering;
- initial position;
- current committed step;
- pending target step;
- playback and transition status;
- transition progress;
- reveal frontier;
- fault state required for session semantics.

Core must not inspect the internal structure of experience `state` or `renderer_config` values.

### 4.3 Transport

Transport owns learner-facing progress and playback controls, including semantic markers and keyboard interaction assigned to transport.

Transport sends commands to `CiMInstance`. It does not call renderers, commentary, telemetry, or subject implementations directly.

### 4.4 Commentary

Commentary owns the persistent event-history presentation, active commentary state, auto-follow behavior, newer-step indication, and commentary link presentation.

Commentary receives semantic position and reveal information through runtime-controlled interfaces. It does not infer canonical position from its DOM or independently advance the session.

### 4.5 Accessibility

Accessibility is a cross-cutting contract. Shared helpers may live under `src/accessibility/`, but each component that emits interactive or visual output owns the accessibility of that output.

Accessibility requirements include keyboard scope, focus behavior, semantic names and states, reduced-motion behavior, announcements where required, and accessible fallback representation.

Accessibility helpers do not gain control authority over runtime state.

### 4.6 Renderer Interface

The renderer interface defines the lifecycle shared by all renderers.

A renderer receives complete absolute state for a semantic boundary. Arrival at the same boundary through sequential playback, direct seek, restoration, reverse navigation, reduced motion, or replay must settle to an equivalent canonical render.

A renderer may use the prior state as animation context, but prior rendered history cannot be required to construct the destination boundary.

Renderers do not own playback policy, semantic navigation, commentary progression, URL history, or canonical runtime position.

### 4.7 Subject-Specific Renderers

Subject renderers implement visual representation for a domain such as Git. They depend on the public renderer contract and subject data passed through the experience definition.

Subject renderers must not introduce direct dependencies on transport, commentary, host adapters, harness code, or another subject renderer.

### 4.8 Experience Data and Schema

Experience definitions describe instructional data rather than engine control logic.

The shared schema owns version metadata, renderer identity, semantic steps, commentary structure, links, opaque state, and opaque renderer configuration. Subject state remains opaque to Core.

Experience definitions contain no executable JavaScript, raw HTML, or engine-control callbacks.

### 4.9 Host / WordPress Adapter

The host adapter resolves an experience ID, loads production assets, mounts CiM instances, and preserves a usable surrounding page if CiM initialization fails.

The WordPress implementation should be a plugin that enqueues external assets. Publication pages invoke an experience through stable markup or shortcode rather than embedded runtime code.

The host adapter does not own semantic playback behavior or subject rendering.

### 4.10 Runtime Fault Management

Fault taxonomy and common diagnostic shape are shared, but recovery authority remains with the component that owns the failed operation.

Runtime coordinates cross-component settlement after a failure. It does not conceal an unresolved component failure by independently mutating subject state.

Recoverable faults return the instance to a documented usable state. Unrecoverable faults stop playback and expose the standard static fallback while leaving the surrounding page usable.

### 4.11 Telemetry, Evidence, Replay, and Analysis

Runtime telemetry records ordered semantic behavior and faults without participating in control.

The evidence model supports deterministic comparison of expected and observed behavior. Replay reissues recorded commands against the same versioned inputs and controlled clock, then compares resulting evidence.

Frame-level animation activity does not belong in the normal semantic event stream.

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

The intended dependency direction is one-way.

```text
host -> runtime -> core
                -> transport
                -> commentary
                -> renderer interface -> subject renderer
                -> telemetry interface

experience adapter -> schema validation -> validated experience -> runtime

harness -> public production interfaces
production -X-> harness
```

Peer presentation modules do not control one another. In particular:

- transport does not call renderers;
- transport does not advance commentary;
- commentary does not move transport;
- renderers do not command runtime navigation;
- telemetry does not command runtime behavior;
- subject renderers do not inspect another module's DOM or private state.

## 6. Canonical Runtime Authority

Canonical semantic position has one owner.

At minimum, a session model must be able to represent:

```text
instanceId
experienceId
experienceVersion
status
currentStepId
targetStepId
transitionId
transitionProgress
revealFrontier
error
```

`currentStepId` identifies the last committed stable semantic boundary. `targetStepId` identifies a pending destination during a transition. A subject-state digest or render digest must never be used to infer semantic position because two distinct semantic steps may intentionally carry equivalent subject state.

## 7. Absolute-State Rendering

For every semantic boundary, the experience supplies enough state for the selected renderer to reproduce that boundary independently of navigation history.

The following paths to the same step must settle to equivalent canonical output:

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

For v1, conforming renderers should expose inspectable DOM or SVG under their assigned renderer root so the harness can independently assess stable output. Renderer technologies requiring a different observable conformance surface require a later contract extension.

## 8. Semantic Position Versus Subject State

A semantic operation can advance the instructional timeline without changing subject state.

The neutral synthetic fixture must include an observation step such as:

```text
INITIAL -> A
step-01 -> B
step-02 -> B   observation
step-03 -> C
step-04 -> D
```

After moving from `step-01` to `step-02`, the state and render digests may remain equal while canonical position, active commentary, marker state, and semantic event sequence advance.

No optimization may skip semantic settlement solely because a state or render digest is unchanged.

## 9. Time and Transition Ownership

CiM controls semantic time through an injected clock and scheduler.

Renderers must not depend on unmanaged wall-clock timing for semantically significant transitions.

A pause command freezes an active transition at its current progress without committing the target step. A subsequent play command resumes that transition.

A navigation command received during an active transition cancels the in-flight animation and resolves deterministically to the requested semantic destination through absolute rendering. Detailed navigation semantics belong in `CIM-SPEC.md`.

## 10. Commentary Reveal Model

The active commentary entry follows canonical semantic position.

`revealFrontier` is a monotonic high-water mark during a session. Seeking backward changes the active entry but does not re-hide commentary already revealed.

A deep-link entry initializes the frontier to the requested step so preceding commentary is available as context while later commentary remains unrevealed.

## 11. Deep Linking and Instance Isolation

Stable semantic boundaries use the canonical fragment shape:

```text
#cim/{experience-id}/{step-id}
```

Only a mounted instance whose experience ID matches the fragment responds. Other instances ignore it.

Learner-driven stepping should replace the current semantic URL rather than create a browser-history entry for every step. An explicit link-to-this-step affordance may create or expose a shareable canonical URL.

Every mount receives a unique `instanceId`. Mutable runtime state, event sequencing, listeners, timers, faults, and cleanup remain instance-scoped.

## 12. Experience Ingestion

CiM has one runtime experience contract: `localis.cim/v1`.

Multiple authoring paths may produce that contract:

```text
Human-authored .cim -> parser -----+
                                   |
Localis subject source -> generator+--> localis.cim/v1 validation -> runtime
```

The engine never receives an unvalidated alternate authoring representation.

Site-level plugin configuration and per-experience instructional content are separate concerns. Site configuration may define asset locations, theme, engine version policy, and site defaults. Per-experience files define one demonstration.

The exact `.cim` authoring grammar is deferred to a dedicated specification or ADR. That grammar must preserve source line information so validation tools can report actionable errors.

## 13. Content Safety Boundary

Experience-authored content is untrusted input regardless of provenance.

The platform contract requires:

- authored terminal and code content rendered as text nodes;
- no raw HTML in experience content;
- no experience-supplied JavaScript;
- no `innerHTML` path for authored content;
- structured commentary links rather than arbitrary markup;
- URL scheme validation and allowlisting appropriate to link type;
- renderer configuration interpreted as data rather than executable instructions.

## 14. WordPress Boundary

WordPress integration is a host adapter around the canonical engine.

Expected publication invocation is stable and storage-independent, for example:

```html
<div class="cim" data-cim-experience="git-basic-cycle"></div>
```

or:

```text
[cim id="git-basic-cycle"]
```

The plugin owns asset enqueue, experience resolution, initialization, cache/version handling, authoring validation surfaces, and fallback markup. Runtime JavaScript should remain in enqueued external assets rather than page-authored inline scripts.

## 15. Fault Isolation

A failure in one CiM instance must not destabilize another CiM instance or the surrounding Localis page.

Fault records identify the owning component, operation, semantic position or transition when applicable, stable error code, and recovery outcome.

The harness may inject faults. Fault-handling logic belongs to production components.

## 16. Branch and Merge Boundary

Feature branches must preserve the ownership rules in this document and the README in their target component directory.

A branch changing a public interface must update the corresponding normative document and tests in the same review set or in a prerequisite architecture branch.

`main` should remain releasable. Subject-specific implementation work cannot redefine a shared platform contract implicitly.

## 17. Architecture-v1 Acceptance Gate

Before `docs/architecture-v1` merges:

- canonical state ownership is explicit;
- command and event direction is explicit;
- absolute-state rendering is normative;
- time, pause, transition cancellation, and stable settlement are defined;
- semantic position is independent from state digest;
- renderer lifecycle responsibilities are documented;
- commentary reveal behavior is documented;
- experience ingestion converges on one validated schema;
- deep-link and multi-instance behavior are documented;
- fault ownership and fallback boundaries are documented;
- telemetry and replay remain observational;
- harness dependencies cannot leak into production;
- no unresolved public-interface decision blocks independent component implementation.
