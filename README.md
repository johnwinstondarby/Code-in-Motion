# Code in Motion (CiM)

Code in Motion is a WordPress teaching plugin for people who teach coding through step-by-step demonstrations. A learner controls a Console and running Explanation: Play pauses at each completed beat, Next finishes the current beat before advancing, and Copy provides the authored command. Examples are displayed, never executed.

Git in Motion is the first real experience and reference implementation. The synthetic operations harness proves the platform independently of Git, WordPress, and other subject-specific integrations.

## Development status

The live baseline is 0.2.6. The first public release and its packaging are **v1.0** (SemVer 1.0.0), currently a candidate pending an outsider dry run and independent release review. Engine capability remains 1.0.1 and frozen authoring formats are unchanged. The public Player supports beat-paced reading, three themes, whole-line evidence cues, risk guidance, native Copy, desktop keyboard navigation and a phone fallback notice.

Teachers can add their own lessons using the standalone authoring tool and companion lesson-pack plugins, without rebuilding CiM. Read the [install guide](docs/INSTALL.md), [write-your-first-lesson guide](docs/AUTHORING-GUIDE.md) and [packaging decision](docs/adr/0060-packaging-for-teaching-sites.md).

## Quick start

1. Download and verify the named Code in Motion plugin ZIP from [GitHub Releases](https://github.com/johnwinstondarby/Code-in-Motion/releases). Until v1.0 is published, use the reviewed dry-run candidate; do not assume the automatically generated source archive is installable.
2. In WordPress 6.5+ (PHP 7.4+), install and activate the ZIP through **Plugins → Add Plugin → Upload Plugin**.
3. Add a Shortcode block to a draft page: `[cim experience="python-first-steps"]`. Preview on a desktop or laptop, then press Play.
4. Check **Code in Motion → Static health** if fallback text appears. The install guide explains each check.
5. To write your own lesson, download the separate authoring-tool ZIP, run `node tools/cim-author.mjs init my-lesson.json`, edit it, then follow the authoring guide to validate, pack, install and preview it.

Acceptance targets: a working starter on a fresh site in under 15 minutes; an unfamiliar teacher's own three-beat lesson in about 30 minutes. These targets require an actual timed outsider run before v1.0 publication.

## Building your own version

Fork [johnwinstondarby/Code-in-Motion](https://github.com/johnwinstondarby/Code-in-Motion), check out the exact release tag and use the Node version in `.nvmrc` (22.23.2 for this release). Run `npm ci --ignore-scripts`, `npm run verify`, then `npm run build:wordpress` and `npm run build:authoring` from a clean committed checkout. The named ZIPs and checksums appear in `dist/`. Repeating the build on the same pinned Node version must produce identical bytes.

Bundled authored sources are in `experiences/`; registered compile jobs are in `tools/compile-authoring.mjs`; the WordPress registry is `wordpress/experiences/registry.json`. Run `npm run compile:authoring` and the registry projection generators after a deliberate bundled-lesson change. Ordinary teachers should use a companion pack instead.

A separately installable fork must rename the plugin directory, header/name and identifiers/handles/hooks that could collide, and update the packaging gates/build paths consistently. Merely changing the title does not allow two copies to coexist. Keep required copyright/license notices. Fork maintainers support their own versions; Localis supports the official release.

## License

CiM and the authoring tool are GPLv3-only (SPDX `GPL-3.0-only`), with the exact [LICENSE](LICENSE) included in the plugin, authoring-tool and generated integration ZIPs. WordPress headers/readme use the matching GPLv3 declaration and GNU license URI. No new “or later” grant is made. Teachers retain rights in their original lesson content.

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
7. All authoring paths converge on validated `localis.cim/v1` or `localis.cim/v2` data before runtime initialization.
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
