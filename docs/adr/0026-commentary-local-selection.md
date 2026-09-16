# ADR 0026: Commentary-Local Selection

Status: Accepted

Date: 2026-09-16

## Context

Commentary checkpoint 1 projects canonical visibility from Core-owned `revealFrontier`. The learner also needs to select one visible Commentary entry for local presentation and later native interaction.

Visibility and selection represent different facts. Visibility is canonical semantic history. Selection is a learner-facing Commentary preference and has no reason to alter Runtime state, reveal progression, Transport position, or renderer output.

## Decision

1. Commentary checkpoint 2 layers local selection over the exact checkpoint 1 `{ read }` reveal capability.

2. The exact frozen public surface is:

```text
read
select
clear
```

3. Local state contains only `selectedStepId`, initially `null`.

4. Every `read()`, `select()`, and `clear()` validates a fresh checkpoint 1 reveal state before returning projected state.

5. The projected state contains exactly:

```text
revealFrontier
selectedStepId
entries
```

6. Each projected visible entry preserves checkpoint 1 data and adds exactly one Commentary-local presentation flag:

```text
selected
```

7. `select(stepId)` accepts only a currently visible Commentary entry. Hidden, unknown, blank, or malformed identities fail closed and do not change local selection.

8. Re-selecting the current entry is idempotent local state. Commentary emits no command-style outcome envelope, transition identity, or semantic event.

9. Backward navigation and Home preserve local selection while the selected entry remains revealed.

10. When a fresh reveal projection no longer contains the selected entry, including after Restart resets the frontier to `initial`, Commentary reconciles `selectedStepId` to `null`.

11. Reconciliation occurs only after the fresh reveal state validates successfully. Malformed observation cannot silently erase valid local selection.

12. `clear()` clears only Commentary-local selection and returns a fresh projected visibility state.

13. Checkpoint 2 receives no Runtime, Transport, command, event, renderer, DOM, disposal, or Core authority.

## Consequences

Canonical reveal history and learner selection remain independent. Later DOM interaction can select a Commentary entry without issuing semantic navigation or changing the reveal frontier.

Restart naturally clears selection because the selected entry is no longer visible, while backward navigation and Home preserve selection because revealed history remains visible.

A later feature that intentionally makes Commentary activation navigate the semantic timeline would require a separate narrow command capability and a separate decision. It is not implied by selection.

## Verification

Checkpoint 2 verification pins:

- exact frozen controller, state, and entry records;
- independent visibility and selection axes;
- selection limited to currently visible entries;
- idempotent repeated selection without command-style outcome data;
- preservation across backward navigation and Home while visibility remains;
- automatic clearing after Restart-shaped visibility reset;
- reconciliation only after valid fresh reveal data;
- local clear semantics;
- exact frozen checkpoint 1 `{ read }` capability;
- fail-closed malformed reveal state without corrupting existing selection;
- absence of Runtime, Transport, command, event, renderer, DOM, and Core authority;
- repository schema, architecture, Core-authority, and full test gates on Node 20 and Node 22.
