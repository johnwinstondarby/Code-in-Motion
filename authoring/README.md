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
