# Code in Motion (CiM)

Code in Motion is a reusable Localis teaching platform for showing technical processes under learner-controlled time. A CiM experience pairs a process visualization with persistent running commentary, semantic navigation, linked reference material, and subject-specific rendering.

Git in Motion is the first real experience and reference implementation. The synthetic operations harness proves the platform independently of Git, WordPress, and other subject-specific integrations.

## Development status

CiM v1 architecture contracts are merged to `main`. The current implementation branch is `feat/schema-v1`, which instantiates the machine-readable experience schema and the first automated architecture fences.

## Repository map

```text
Code-in-Motion/
├── .github/workflows/     Automated contract verification
├── docs/                  Architecture, specifications, events, faults, and ADRs
├── src/                   Production runtime modules
│   ├── contracts/         Dependency-free shared value/interface vocabulary
│   ├── runtime/           CiMInstance composition and orchestration
│   ├── core/              Canonical semantic session state and commits
│   ├── transport/         Learner controls and semantic timeline UI
│   ├── commentary/        Persistent running commentary projection
│   ├── accessibility/     Shared accessibility contracts and helpers
│   ├── renderers/         Renderer interface and implementations
│   ├── experience/        Experience loading and schema-gated ingestion
│   ├── host/              Host and WordPress adapter
│   ├── faults/            Shared runtime fault taxonomy and evidence shape
│   ├── telemetry/         Observation, evidence, replay, and analysis interfaces
│   └── styles/            Shared CiM presentation assets
├── experiences/           Validated experience data
├── schemas/               Machine-readable CiM schemas and fixtures
├── authoring/             Human and generated authoring adapters
├── harness/               Synthetic operations and fault-injection system
├── tests/                 Unit, integration, architecture, and conformance tests
├── tools/                 Repository contract and boundary verification
└── examples/              Minimal integration examples
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
12. Production references to the privileged Core `setStatus` seam originate only from `src/runtime/`; Core may declare the seam but does not derive activity status from Runtime-owned fields.
13. Cross-component value vocabulary belongs in dependency-free `src/contracts/` rather than creating exceptions to component fences.

## Verification

`npm run verify` runs the repository contract gates:

- the published Draft 2020-12 JSON Schema against valid and invalid fixtures;
- cross-item semantic checks that JSON Schema does not conveniently express;
- architecture import-boundary enforcement;
- the Runtime-only privileged `setStatus` seam rule;
- Node test suites for schema and boundary behavior.

Ajv is a development/CI-only dependency used to execute the published JSON Schema. It is not a production `src/` dependency. The same `npm run verify` command runs in GitHub Actions for pull requests and pushes to `main`.

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
