# Git Renderer v1

## Purpose

`git/v1` renders the Git subject state used by `git-basic-cycle`.

The stable visual model has four repository places:

1. Working Tree
2. Index
3. Local Repository
4. Remote

Reflog is rendered separately as an evidence timeline. It is not a fifth repository place.

## State ownership

The renderer consumes complete absolute Git state supplied by the experience. Core and Runtime do not inspect Git-specific fields.

Observation boundaries may carry byte-equivalent Git state while changing semantic position. Renderer focus comes from step-level renderer configuration, so commands such as `git status` and `git diff` can advance the lesson without inventing a repository-state change.

## R27 staging scope

The interactive cycle demonstrates the plain `git add` path.

`git add -p` and `git add -N <path>` remain canonical page-3227 reference guidance in R27. Demonstrating partial staging would require additional authored boundaries and absolute states and is outside the current experience.

## Visual grammar

The four repository places live inside `data-role="git-lanes"`.

Reflog uses:

`data-git-grammar="evidence-timeline"`

and is rendered outside the lane container. This keeps recovery evidence visually distinct from repository location.

## Motion scope

`git/v1` has deterministic animated-settlement timing but no intermediate visual animation.

When `context.animate` is true and `context.reducedMotion` is false, the renderer waits for the configured frame count before replacing the prior stable subtree. It does not render intermediate frames, transforms, opacity changes, or other visible motion during that wait.

When `context.animate` is false or `context.reducedMotion` is true, the destination subtree is installed immediately.

The stable output is identical in both paths. Reduced motion therefore changes settlement timing for this renderer, not the appearance of a visible animation.

## Contract

The renderer implements the v1 `mount / render / dispose` interface, uses only the injected clock and abort capabilities for animated settlement, and settles the same destination to canonically equivalent output across animated and absolute arrival paths.
