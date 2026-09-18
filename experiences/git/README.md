# Git in Motion Experiences

## Purpose

This directory contains Git-specific CiM experiences. Git in Motion is the first real experience and the reference implementation for subject integration.

## Owns

- Git instructional step sequences
- Git commentary
- Git renderer state
- Git renderer configuration
- Links to related Localis and authoritative Git reference material

## Does not own

- Shared CiM engine behavior
- Transport policy
- Common experience-schema semantics

## Allowed dependencies

Git experiences conform to `localis.cim/v1` and target an approved Git renderer ID.

## Prohibited dependencies

Git-specific concepts must not force changes into core merely to support this experience.

## Verification

The first basic cycle demonstrates state-changing and observation-only Git commands while using the same public contracts already proven by the synthetic harness.

## R27 basic-cycle source boundary

`git-basic-cycle.json` is generated output. Direct edits are rejected by the R27 freshness gate.

The source split is deliberate:

- shared Git facts live in `authoring/git/git-subject-facts.json`;
- experience-only ordering, commentary, renderer focus, and absolute states live in `authoring/git/git-basic-cycle.plan.json`;
- the generator composes the validated `localis.cim/v1` experience.

Observation commands preserve the preceding subject state exactly. Mutating commands change it. This keeps semantic step identity independent from subject-state equality: `git status`, `git diff`, `git rev-parse HEAD`, and `git reflog` remain distinct learner boundaries even when the underlying Git state is unchanged.

