# Host and WordPress Adapter

## Purpose

The host layer connects a page to the canonical CiM runtime without embedding platform logic in publication content.

## Owns

- Host invocation discovery
- WordPress plugin integration
- External asset enqueue
- Experience-ID handoff
- Initialization boundary
- Host-level static fallback when CiM cannot initialize

## Does not own

- Engine semantics
- Subject renderer logic
- Inline authored JavaScript in publication pages

## Allowed dependencies

May create and configure `CiMInstance` through its public initialization contract.

## Prohibited dependencies

Publication pages must not contain substantial CiM runtime JavaScript. The WordPress adapter uses enqueued external assets rather than runtime code embedded in Custom HTML content.

## Verification

Tests prove multiple-instance initialization, failed-load isolation, static-page survival, asset-version handling, and clean fallback behavior.
