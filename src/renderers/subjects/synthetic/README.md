# Synthetic Renderer

Renderer ID: `synthetic/v1`

## Purpose

The synthetic renderer is the subject-neutral conformance target for the renderer interface. It exists to prove platform behavior before a Git-specific renderer is introduced.

## Mount surface

The renderer consumes the assigned renderer root from `mount(context).root`. It does not retain or require Runtime, Core, transport, commentary, host, telemetry, or harness authority.

## State contract

Synthetic state is deliberately small:

- `node`: required non-empty string;
- `detail`: optional string.

The complete destination state is sufficient to reproduce the stable visual output.

## Renderer configuration

The renderer interprets the two opaque configuration surfaces separately:

- `rendererConfig.prefix`: optional string placed before the stable node label;
- `stepRendererConfig.suffix`: optional string placed after the stable node label.

Runtime does not merge these objects.

## Timing

When `animate:false`, the renderer settles immediately.

When `animate:true` and `reducedMotion:false`, the default conformance animation waits for two callbacks from the injected transition-scoped `clock.onFrame()` surface before stable settlement. The frame count is configurable only when the synthetic renderer factory is created for a test.

When `reducedMotion:true`, the renderer settles directly to the same stable output.

The renderer uses no wall-clock API.

## Absolute-state invariant

Stable output depends only on destination state, destination `stepId`, and the renderer's two configuration objects. It does not encode `transitionId`, predecessor state, predecessor step, animation mode, reduced-motion mode, replay identity, or arrival history.

An animated render does not replace the prior stable DOM until settlement. If Runtime aborts the transition first, the renderer rejects with `RendererCancelledError` and leaves the prior stable output in place for recovery.

## Verification

`tests/conformance/synthetic-absolute-state.test.mjs` proves canonical equivalence for sequential animated arrival, direct seek, reverse absolute navigation, restart then seek, recovery restoration, reduced-motion arrival, and deterministic replay-equivalent arrival using `cim-dom-svg/v1`.
