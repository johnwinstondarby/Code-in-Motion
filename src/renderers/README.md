# Renderer Interface and Implementations

## Purpose

This directory defines the public renderer lifecycle and contains renderer implementations that satisfy it.

The detailed normative v1 renderer contract is `docs/RENDERER-CONTRACT.md`.

## Owns

- Renderer interface
- Renderer mount and disposal contracts
- Exact frozen render-context shape
- Read-only abort facade
- Transition-scoped renderer clock facade
- Absolute-state rendering contract
- Stable-state restoration
- Transition presentation
- Reduced-motion rendering
- Renderer error and expected-cancellation reporting
- Inspectable DOM/SVG conformance surface

## Does not own

- Playback policy
- Canonical semantic position
- Runtime status control
- Transport controls
- Commentary state
- Experience schema control logic
- Harness canonicalization policy

## Allowed dependencies

Renderers may depend on dependency-free shared contracts and explicitly approved renderer utilities.

Renderers receive validated frozen opaque state, separate experience-level and step-level renderer configuration, transition identity, reduced-motion state, a read-only abort facade, and a transition-scoped clock facade through the public interface.

## Prohibited dependencies

Renderers must not import or receive live Runtime, Core, transport, commentary, host, telemetry implementation, harness implementation, or semantic-control authority.

Renderers must not require prior visual history to reproduce a stable semantic boundary. Renderers must not use wall-clock scheduling for semantically significant animation progress. Renderer implementations must not define their own conformance digest rules.

## Verification

The renderer-interface gate must prove:

- exact context key set and frozen context;
- explicit `null` predecessor fields for absolute arrivals;
- separate opaque renderer-configuration surfaces;
- read-only cancellation and transition-scoped timing capabilities;
- no reachable unapproved function capability through context or prototypes;
- deep-frozen validated experience input;
- paused transitions emit no delayed or frame callbacks;
- settled, aborted, and disposed transitions revoke clock authority;
- direct seek, sequential arrival, restoration, reverse arrival, and reduced-motion arrival at the same semantic boundary produce canonically equivalent rendered output;
- evidence identifies both `render_digest` and `canonicalizer_id`;
- every new rule includes a near-miss test.
