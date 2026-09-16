# Architecture Decision Records

## Purpose

ADRs preserve decisions that constrain multiple CiM components or future implementations.

## Accepted decisions

| ADR | Decision | Date | Status |
|---|---|---|---|
| [`0001`](0001-canonical-runtime-ownership.md) | Canonical Runtime Ownership | 2026-09-12 | Accepted |
| [`0002`](0002-control-vs-observation.md) | Control Versus Observation | 2026-09-12 | Accepted |
| [`0003`](0003-absolute-state-rendering.md) | Absolute-State Rendering | 2026-09-12 | Accepted |
| [`0004`](0004-authoring-ingestion.md) | Authoring and Experience Ingestion | 2026-09-12 | Accepted |
| [`0005`](0005-semantic-navigation-and-abort.md) | Semantic Navigation and In-Flight Transition Handling | 2026-09-12 | Accepted |
| [`0006`](0006-transition-pacing-and-dwell.md) | Transition Pacing and Dwell Ownership | 2026-09-12 | Accepted |
| [`0007`](0007-semantic-scrub-contract.md) | Semantic Scrub Contract | 2026-09-12 | Accepted |
| [`0008`](0008-shared-contracts-and-privileged-core-control.md) | Shared Contracts and Privileged Core Control | 2026-09-13 | Accepted |
| [`0009`](0009-renderer-capability-boundary.md) | Renderer Capability Boundary | 2026-09-13 | Accepted |
| [`0010`](0010-runtime-pause-observability.md) | Runtime Pause Observability and Clock Freeze | 2026-09-14 | Accepted |
| [`0011`](0011-targeted-initialization-and-entry-evidence.md) | Targeted Initialization and Session-Entry Evidence | 2026-09-15 | Accepted |
| [`0012`](0012-initial-anchor-and-same-boundary-seek.md) | Initial Rail Anchor and Same-Boundary Seek Settlement | 2026-09-15 | Accepted |
| [`0013`](0013-playback-presentation-projection.md) | Playback Presentation Projection | 2026-09-15 | Accepted |
| [`0014`](0014-space-playback-keyboard-integration.md) | Space Playback Keyboard Integration | 2026-09-15 | Accepted |
| [`0015`](0015-native-range-presentation-and-semantic-labels.md) | Native Range Presentation and Semantic Labels | 2026-09-15 | Accepted |
| [`0016`](0016-native-range-dom-binding-and-refresh-ownership.md) | Native Range DOM Binding and Refresh Ownership | 2026-09-15 | Accepted |
| [`0017`](0017-native-range-interaction-and-release-only-commit.md) | Native Range Interaction and Release-Only Commit | 2026-09-15 | Accepted |
| [`0018`](0018-visual-rail-projection-and-preview-state.md) | Visual Rail Projection and Preview State | 2026-09-15 | Accepted |
| [`0019`](0019-native-visual-rail-dom-projection.md) | Native Visual Rail DOM Projection | 2026-09-15 | Accepted |
| [`0020`](0020-native-marker-activation.md) | Native Marker Activation | 2026-09-15 | Accepted |
| [`0021`](0021-transport-button-presentation-and-labels.md) | Transport Button Presentation and Labels | 2026-09-15 | Accepted |
| [`0022`](0022-native-transport-button-binding-and-activation.md) | Native Transport Button Binding and Activation | 2026-09-15 | Accepted |
| [`0023`](0023-same-boundary-navigation-consistency.md) | Same-Boundary Navigation Consistency | 2026-09-16 | Accepted |
| [`0024`](0024-selectable-text-and-native-range-pointer-ownership.md) | Selectable Text and Native Range Pointer Ownership | 2026-09-16 | Accepted |
| [`0025`](0025-commentary-reveal-projection.md) | Commentary Reveal Projection | 2026-09-16 | Accepted |
| [`0026`](0026-commentary-local-selection.md) | Commentary-Local Selection | 2026-09-16 | Accepted |
| [`0027`](0027-commentary-native-presentation-and-entry-navigation.md) | Commentary Native Presentation and Entry Navigation | 2026-09-16 | Accepted |
| [`0028`](0028-complete-learner-path-harness-composition.md) | Complete Learner Path Harness Composition | 2026-09-16 | Accepted |

## Owns

- Decision context
- Chosen rule
- Consequences and rejected alternatives
- Supersession history

## Does not own

- Routine implementation notes
- Feature-specific TODO lists

## Allowed dependencies

ADRs may reference normative files under `docs/` and affected component READMEs.

## Prohibited dependencies

An ADR must not silently redefine a public contract without updating the corresponding normative specification.

## Verification

Each ADR is numbered, dated in this index, assigned a status, and linked to the normative specification or component boundary it affects.

A superseding ADR must identify the prior ADR and the normative documents changed by the new decision.
