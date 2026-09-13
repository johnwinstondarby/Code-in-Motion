# Code in Motion (CiM)

Code in Motion is a reusable Localis teaching platform for showing technical processes under learner-controlled time. A CiM experience pairs a process visualization with persistent running commentary, semantic navigation, linked reference material, and subject-specific rendering.

Git in Motion is the first real experience and reference implementation. The synthetic operations harness proves the platform independently of Git, WordPress, and other subject-specific integrations.

## Development status

CiM is in architecture definition. Runtime implementation begins only after the public component contracts and dependency rules are settled and reviewed.

Current architecture branch: `docs/architecture-v1`

## Repository map

```text
Code-in-Motion/
├── docs/                 Architecture, specifications, events, faults, and ADRs
├── src/                  Production runtime modules
│   ├── runtime/          CiMInstance composition and orchestration
│   ├── core/             Canonical semantic session state and commits
│   ├── transport/        Learner controls and semantic timeline UI
│   ├── commentary/       Persistent running commentary projection
│   ├── accessibility/    Shared accessibility contracts and helpers
│   ├── renderers/        Renderer interface and implementations
│   ├── experience/       Experience loading and schema-gated ingestion
│   ├── host/             Host and WordPress adapter
│   ├── faults/           Shared runtime fault taxonomy and evidence shape
│   ├── telemetry/        Observation, evidence, replay, and analysis interfaces
│   └── styles/           Shared CiM presentation assets
├── experiences/          Validated experience data
├── schemas/              Machine-readable CiM schemas
├── authoring/            Human and generated authoring adapters
├── harness/              Synthetic operations and fault-injection system
├── tests/                Unit, integration, and conformance tests
└── examples/             Minimal integration examples
```

Normative cross-component contracts live under `docs/`, including `CIM-ARCHITECTURE.md`, `CIM-SPEC.md`, `EXPERIENCE-SCHEMA.md`, `EVENTS.md`, `FAULTS.md`, and the ADR set.

## Architectural rules

1. `CiMInstance` owns runtime composition, command sequencing, transition mechanics, and playback intent. Core owns and mutates canonical semantic session state through its documented interface.
2. Core does not inspect subject-specific renderer state or renderer configuration.
3. Renderers reproduce stable semantic boundaries from absolute state.
4. Semantic position is independent from subject-state or render-digest equality.
5. Control flows through documented interfaces. Observation flows through ordered events.
6. Production code never imports harness code.
7. All authoring paths converge on validated `localis.cim/v1` data before runtime initialization.
8. Experience-authored content is untrusted data and cannot inject executable page content.
9. Semantic timing uses the injected CiM clock rather than renderer-owned wall-clock timing.
10. The reserved semantic boundary ID `initial` identifies the stable state before `steps[0]`.
11. Git-specific behavior remains outside the shared engine and core contracts.

## Branch model

Feature branches define their contract, tests, and acceptance conditions before merge. `main` remains releasable. The initial sequence begins with architecture and schema work, followed by renderer interface, core engine, harness core, and the synthetic renderer before Git-specific implementation.

## Documentation convention

Each component directory contains a README defining its boundary. Component READMEs use the same headings:

- Purpose
- Owns
- Does not own
- Allowed dependencies
- Prohibited dependencies
- Verification

A code change that crosses one of these boundaries requires an explicit architecture decision rather than an undocumented dependency.
