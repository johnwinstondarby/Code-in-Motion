# ADR 0027: Commentary Native Presentation and Entry Navigation

Status: Accepted

Date: 2026-09-16

## Context

Commentary checkpoint 1 establishes canonical visibility from `revealFrontier`. Checkpoint 2 adds Commentary-local selection without navigation authority. The original Commentary component contract also assigns active-entry presentation, structured link activation, and Commentary-entry seek requests through the Runtime interface.

These facts require separate ownership. Canonical active position follows Runtime `currentStepId`. Local selection remains Commentary-owned. Entry activation may request semantic navigation, but that command capability must not broaden local selection into Runtime authority or derive semantic identity from mutable DOM.

Selectable Commentary prose must also preserve ADR 0024: drag-selection remains browser-owned and cannot enter Transport scrub interaction.

## Decision

1. Commentary checkpoint 3 adds a headless presentation projection over checkpoint 2 selection plus one exact frozen snapshot-only position observation.

2. The presentation exposes exactly:

```text
read
```

and returns:

```text
revealFrontier
currentStepId
selectedStepId
entryCount
entries
```

3. Every visible entry preserves validated Commentary content and local `selected`, and adds canonical `active`:

```text
active = entry.stepId === currentStepId
```

At `initial`, no Commentary entry is active even when previously revealed history remains visible after Home.

4. `active` and `selected` remain independent. Semantic movement changes `active`; learner Commentary selection changes `selected`.

5. Commentary semantic navigation is granted through an exact frozen one-function command port containing only raw `seek`. `createCommentaryNavigation()` returns an exact frozen `{ seek }` surface that always forwards:

```text
seek(stepId, "commentary")
```

The adapter returns the exact Runtime outcome reference and cannot select another provenance.

6. The native Commentary binding receives fixed native entry controls, the exact checkpoint 3 presentation, a narrow local-selection function, and the narrowed Commentary navigation function. It receives no complete Runtime or Transport object.

7. Each entry control separates:

```text
root
text
select
links
```

`text` remains a non-interactive text container. `select` is a native `button[type="button"]`. `links` are native anchor controls. This structure preserves text selection and native keyboard behavior.

8. The binding writes authored Commentary prose only through `textContent`. It never uses `innerHTML` for authored experience data.

9. Structured links project only validated `label`, `href`, and link identity onto native anchors. Commentary installs no link click handler; ordinary browser link activation remains native.

10. Native selection buttons receive one `click` listener only. Commentary installs no synthetic Enter/Space activation, pointer-drag listener, document listener, window listener, or selection listener.

11. Semantic step identity is captured only after an entry appears in a validated presentation read. The native listener closes over that validated identity. `data-cim-step-id` is presentation data and is never read to choose a command.

12. On activation, the binding revalidates fresh presentation, confirms the captured entry is still visible at the same ordinal, updates Commentary-local selection, forwards one narrowed Commentary seek, and refreshes local DOM selection presentation. It does not debounce, coalesce, serialize, or interpret Runtime outcomes.

13. A stale programmatic click on an entry hidden by Restart performs no local selection and no navigation.

14. `aria-current="step"` reflects canonical active position. `data-cim-selected` reflects Commentary-local selection. The two are never conflated.

15. Native DOM refresh validates the complete visible presentation before writes. Owned DOM fields are restored after write or listener-installation failure. Disposal removes only Commentary selection-button listeners, is idempotent after complete success, and prevents new refresh or activation after disposal begins.

## Consequences

The original Commentary responsibilities are restored without collapsing selection, active semantic position, and navigation into one state variable.

Commentary entry activation may move the semantic session, but only through one narrowed seek capability with fixed `commentary` provenance. Runtime still owns acceptance, same-boundary no-change, supersession, rendering, and settlement.

The checkpoint 12 Transport pattern carries forward: semantic command identity originates in validated presentation rather than mutable DOM.

Selectable prose and native structured links remain ordinary browser content beside the separate native selection button.

## Verification

Checkpoint 3 verification pins:

- exact frozen headless presentation and native binding surfaces;
- independent canonical `active` and local `selected` flags;
- no active entry at `initial` while revealed history may remain visible;
- fresh position and selection projection on every read;
- fixed Commentary command provenance and exact outcome pass-through;
- DOM identity mutation cannot redirect entry navigation;
- newly revealed entries capture semantic identity only from validated presentation;
- stale hidden controls cannot navigate after Restart;
- authored text uses `textContent` and structured links use native anchor fields;
- no broad pointer, synthetic keyboard, or link-activation listeners;
- exact link-count and control-shape validation;
- scoped disposal and fail-closed presentation validation;
- repository schema, architecture, Core-authority, and full test gates on Node 20 and Node 22.
