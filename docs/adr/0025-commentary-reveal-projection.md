# ADR 0025: Commentary Reveal Projection

Status: Accepted

Date: 2026-09-16

## Context

Commentary is the persistent learner-facing instructional stream associated one-for-one with authored semantic steps. Core already owns the monotonic `revealFrontier`, including targeted-entry initialization and Restart reset semantics. Commentary needs to answer which authored entries are visible without acquiring canonical-state, Transport, renderer, or command authority.

The first Commentary checkpoint should establish visibility before local selection, DOM projection, scrolling behavior, or commentary-entry activation are introduced.

## Decision

1. Commentary checkpoint 1 is observation-only and exposes exactly:

```text
read
```

2. Composition injects exactly one frozen observation capability:

```text
snapshot
```

Commentary receives neither a complete `CiMInstance` nor command, event, disposal, renderer, or Transport authority.

3. Composition also supplies the frozen canonical `boundaryIds` order and frozen authored commentary metadata aligned one-for-one with authored semantic boundaries. `initial` has no commentary entry.

4. Every read obtains a fresh Runtime snapshot and selects only canonical `revealFrontier`.

5. The projected state contains exactly:

```text
revealFrontier
entries
```

`entries` is the ordered authored prefix through `revealFrontier`. At `initial`, it is empty.

6. Each visible entry contains exactly:

```text
stepId
index
text
links
```

The index is the single canonical semantic boundary ordinal. Links retain only validated structured `id`, `label`, and `href` data.

7. Backward navigation and Home do not re-hide entries while the monotonic reveal frontier remains advanced. A targeted initialization exposes the prefix through its target. Restart hides authored entries only after Core resets the frontier to `initial`.

8. Checkpoint 1 has no concept of local selection or canonical active styling. Visibility and learner selection remain separate concerns for the next Commentary checkpoint.

9. Authored commentary text remains inert text data. No HTML execution surface enters the projection.

## Consequences

Commentary visibility is a deterministic function of the canonical reveal frontier and authored semantic order. It cannot advance the frontier, move Runtime, or infer visibility from event history.

Later Commentary checkpoints may layer local selection and native presentation over this exact observation surface without redefining reveal ownership.

## Verification

Checkpoint 1 verification pins:

- exact frozen observation and projection surfaces;
- empty commentary at `initial`;
- ordered prefix reveal through any authored frontier;
- preserved reveal history during backward canonical movement;
- fresh observation on every read;
- targeted-entry and Restart-shaped frontier behavior;
- exact frozen structured commentary and link data;
- rejection of malformed, mutable, widened, accessor-backed, or ordinal-misaligned inputs;
- no selection, command, event, DOM, Transport, renderer, or complete Runtime authority;
- repository schema, architecture, Core-authority, and full test gates on Node 20 and Node 22.
