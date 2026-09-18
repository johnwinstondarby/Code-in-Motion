# Authoring and Ingestion Adapters

## Purpose

This directory contains tools that convert human-authored or generated source material into the validated CiM runtime experience contract.

## Owns

- Human-friendly `.cim` authoring adapter
- Generator adapters used by Localis source data
- Source-location-aware parse diagnostics
- Conversion into `localis.cim/v1`

## Does not own

- Runtime experience semantics beyond the schema
- Site-wide WordPress configuration
- Engine behavior

## Allowed dependencies

Authoring adapters may depend on the common schema validator and source-specific parsers/generators.

## Prohibited dependencies

No adapter may create a second unvalidated runtime path. Raw HTML and executable JavaScript are not accepted as authored experience content.

## Verification

Both hand-authored and generated paths must converge on the same validated runtime representation before engine initialization. Exact `.cim` grammar remains a separate documented decision.

## R27 Git shared-source path

The first production-content adapter uses two authored inputs:

- `authoring/git/git-subject-facts.json` owns the canonical page-3227 Git facts.
- `authoring/git/git-basic-cycle.plan.json` owns CiM ordering, commentary, absolute Git states, and renderer focus.

`tools/generate-git-basic-cycle.mjs` projects those inputs into:

- `authoring/generated/page-3227-git-reference.json`;
- `experiences/git/git-basic-cycle.json`.

Shared command text, verbs, descriptions, state-effect classification, and authoritative Git references originate only in the subject-facts file. The generated page projection also carries the corresponding CiM step ID for stable `#cim/git-basic-cycle/<step-id>` integration.

`npm run check:git-content` fails when either generated projection drifts from its authored inputs.

