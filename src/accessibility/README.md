# Accessibility

## Purpose

This directory holds shared accessibility contracts, helpers, and automated support used across CiM components.

## Owns

- Shared focus-management helpers
- Reduced-motion capability interfaces
- Shared ARIA utilities where appropriate
- Accessibility test helpers used by production components
- Cross-component accessibility requirements documented by the platform

## Does not own

- Another component's accessible output
- A separate accessibility DOM layered over inaccessible components

## Allowed dependencies

Production components may consume shared accessibility helpers through documented interfaces.

## Prohibited dependencies

Accessibility code must not reach into private DOM owned by another module to repair semantics after rendering.

## Verification

Each visual component remains responsible for its own accessible output. Automated conformance tests cover keyboard operation, focus behavior, reduced motion, active-state communication, and fallback presentation.
