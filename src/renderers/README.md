# Renderer Interface and Implementations

## Purpose

This directory defines the public renderer lifecycle and contains renderer implementations that satisfy it.

## Owns

- Renderer interface
- Renderer mount and disposal contracts
- Absolute-state rendering contract
- Stable-state restoration
- Transition presentation
- Reduced-motion rendering
- Renderer error reporting

## Does not own

- Playback policy
- Canonical semantic position
- Transport controls
- Commentary state
- Experience schema control logic

## Allowed dependencies

Renderers receive validated opaque state, renderer configuration, runtime context, cancellation signals, and approved clock/progress information through the public interface.

## Prohibited dependencies

Renderers must not require prior visual history to reproduce a stable semantic boundary. Renderers must not own semantically significant wall-clock scheduling. Renderer implementations must not define their own conformance digest rules.

## Verification

The harness must prove that direct seek, sequential arrival, restoration, reverse arrival, and reduced-motion arrival at the same semantic boundary produce canonically equivalent rendered output.
