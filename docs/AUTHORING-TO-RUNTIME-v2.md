# Code in Motion Authoring-to-Runtime Compilation Contract v2

Status: Frozen upon PR #80 merge (ADR 0054). Subsequent authoring changes require a new identifier; ADR 0048 Part B limn is reserved for authoring/v3.

All numbered clauses of the frozen [Compilation Contract v1](AUTHORING-TO-RUNTIME-v1.md) apply unchanged except for the explicit amendments here. The original v1 compiler and its output/provenance remain byte-identical. The CLI dispatches by the explicit source schema, accepting v1 and v2 without silently upgrading sources.

## Schema and presentation projection

The source identifier is `localis.cim/authoring/v2`; the runtime target remains `localis.cim/v2`. Compiler identity remains `localis.cim/authoring-compiler`, with version 1.0.1 for v2 compilation. Provenance records authoring/v2, compiler 1.0.1 and the actual runtime minimum.

Optional validated `presentation.command_window.cli` is emitted under the same path in runtime presentation metadata. Emit `kind`, then `label`, in fixed field order. Omitted metadata emits no additional key. Source formatting and key order do not change compiled bytes or provenance. All existing beat segmentation, renderer configuration, opaque Console state, evidence relationships and canonical IDs remain unchanged.

## Engine requirement

With CLI metadata, emit `engine_min: "1.0.1"`. Without it, retain the existing 0.2.0 minimum. Defensive compilation options may request a higher minimum but cannot underdeclare the CLI floor; a lower request fails with CIM-COMP-RUNTIME-INVALID. Runtime validation still rejects malformed versions. The engine declares capability version 1.0.1 independently of WordPress/plugin 0.1.11.

Production loading and registry admission enforce engine compatibility before renderer/Runtime construction. The v2 gate remains limited to the complete Console Player. No package release bump, Core authority change or Console renderer output change accompanies this authoring version.
