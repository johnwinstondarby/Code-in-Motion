# Synthetic Operations Harness

## Purpose

The harness proves CiM platform behavior under controlled, deterministic conditions without depending on Git, WordPress, or wall-clock timing.

## Owns

- Virtual clock and scheduler test control
- Synthetic command scenarios
- Fault injection
- Independent expected outcomes
- Evidence capture
- Renderer-agnostic canonicalization for conformance checks
- Deterministic replay and comparison

## Does not own

- Production fault recovery
- Production command flow
- Renderer implementation

## Allowed dependencies

The harness may instantiate production modules through their documented public seams and subscribe to production telemetry.

## Prohibited dependencies

Production code must never import harness code. The harness must never participate in normal production control flow. Renderers cannot supply their own conformance-normalization rules.

## DOM/SVG canonicalization

`canonicalize-dom-svg.mjs` implements the harness-owned `cim-dom-svg/v1` canonicalizer and `render_digest` evidence surface used by renderer conformance.

The concrete v1 normalization policy is normative in `docs/DOM-SVG-CANONICALIZER-v1.md`. A renderer cannot alter that policy. Any change to canonicalization semantics requires a new `canonicalizer_id`.

The canonicalizer is intentionally conservative. Undocumented DOM/SVG differences remain evidence differences.

## Verification

A run is reproducible from scenario, seed, engine version, experience version, and virtual clock. Expected results are declared independently from the implementation being tested.
