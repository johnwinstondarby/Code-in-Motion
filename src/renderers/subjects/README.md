# Subject-Specific Renderers

## Purpose

This directory contains renderers whose visual model belongs to a particular teaching subject or visualization family.

## Owns

- Subject visual representation
- Subject animation between absolute stable states
- Renderer-specific configuration interpretation
- Subject-specific accessible visual descriptions

## Does not own

- CiM playback policy
- Experience loading
- Semantic timeline control
- Shared engine state

## Allowed dependencies

Subject renderers implement the public renderer interface and may use shared presentation or accessibility helpers.

## Prohibited dependencies

A subject renderer must not add subject knowledge to core, transport, commentary, or the common experience schema.

## Verification

Each renderer has interface-conformance tests plus subject-specific tests. The synthetic renderer lands before the Git renderer and remains the neutral conformance target.
