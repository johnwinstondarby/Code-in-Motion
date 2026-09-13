# Shared Styles

## Purpose

This directory holds presentation assets shared by the CiM shell, transport, commentary, and common accessibility states.

## Owns

- CiM shell styling
- Transport styling
- Commentary styling
- Shared focus and reduced-motion presentation rules
- Common visual tokens

## Does not own

- Subject-specific renderer geometry or artwork
- Runtime behavior

## Allowed dependencies

Renderer-specific styles may consume documented shared tokens where appropriate.

## Prohibited dependencies

Shared styles must not rely on private renderer DOM structure.

## Verification

Visual regression and accessibility checks verify stable shell behavior without coupling common CSS to a specific subject renderer.
